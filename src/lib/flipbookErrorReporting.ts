/**
 * Client-side error reporting system for flipbook operations
 * Provides structured error logging with context and stack traces
 * Implements error aggregation for debugging recurring issues
 */

import { flipbookLogger, type LogContext, type FlipbookLoadingPhase } from './flipbookLogger';
import { FlipbookError, type FlipbookErrorType, type ErrorSeverity } from './flipbookErrors';

export interface ErrorReportContext extends LogContext {
  errorId: string;
  errorType: FlipbookErrorType;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  retryCount?: number;
  stackTrace?: string;
  breadcrumbs?: ErrorBreadcrumb[];
  userActions?: UserAction[];
  performanceMetrics?: PerformanceMetrics;
}

export interface ErrorBreadcrumb {
  timestamp: string;
  category: 'navigation' | 'user_action' | 'api_call' | 'state_change' | 'error';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface UserAction {
  timestamp: string;
  action: string;
  target?: string;
  data?: Record<string, any>;
}

export interface PerformanceMetrics {
  loadingStartTime: number;
  errorOccurredAt: number;
  timeToError: number;
  memoryUsage?: number;
  networkLatency?: number;
  pdfSize?: number;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  context: ErrorReportContext;
  aggregationKey: string;
  fingerprint: string;
  environment: {
    userAgent: string;
    url: string;
    viewport: { width: number; height: number };
    connectionType?: string;
    language: string;
  };
}

export interface ErrorAggregation {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  errorType: FlipbookErrorType;
  severity: ErrorSeverity;
  commonContext: Partial<ErrorReportContext>;
  samples: ErrorReport[];
}

class FlipbookErrorReporter {
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private userActions: UserAction[] = [];
  private errorReports: ErrorReport[] = [];
  private errorAggregations: Map<string, ErrorAggregation> = new Map();
  private maxBreadcrumbs = 50;
  private maxUserActions = 20;
  private maxReports = 100;

  /**
   * Add a breadcrumb for error context
   */
  addBreadcrumb(
    category: ErrorBreadcrumb['category'],
    message: string,
    level: ErrorBreadcrumb['level'] = 'info',
    data?: Record<string, any>
  ): void {
    const breadcrumb: ErrorBreadcrumb = {
      timestamp: new Date().toISOString(),
      category,
      message,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    // Log breadcrumb for development
    flipbookLogger.debug(`Breadcrumb: ${message}`, {
      component: 'ErrorReporter',
    }, {
      category,
      level,
      data,
    });
  }

  /**
   * Track user actions for error context
   */
  trackUserAction(action: string, target?: string, data?: Record<string, any>): void {
    const userAction: UserAction = {
      timestamp: new Date().toISOString(),
      action,
      target,
      data,
    };

    this.userActions.push(userAction);

    // Keep only the most recent actions
    if (this.userActions.length > this.maxUserActions) {
      this.userActions = this.userActions.slice(-this.maxUserActions);
    }

    this.addBreadcrumb('user_action', `User ${action}${target ? ` on ${target}` : ''}`, 'info', {
      action,
      target,
      data,
    });
  }

  /**
   * Generate error fingerprint for aggregation
   */
  private generateFingerprint(error: FlipbookError, context: Partial<LogContext>): string {
    const components = [
      error.type,
      error.message.replace(/\d+/g, 'N'), // Replace numbers with N for better grouping
      context.phase || 'unknown',
      context.operation || 'unknown',
    ];

    return components.join('|');
  }

  /**
   * Generate aggregation key for grouping similar errors
   */
  private generateAggregationKey(error: FlipbookError, context: Partial<LogContext>): string {
    return `${error.type}:${context.phase || 'unknown'}:${context.operation || 'unknown'}`;
  }

  /**
   * Collect environment information for error reports
   */
  private collectEnvironmentInfo(): ErrorReport['environment'] {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      language: navigator.language,
    };
  }

  /**
   * Collect performance metrics at error time
   */
  private collectPerformanceMetrics(startTime?: number): PerformanceMetrics {
    const now = performance.now();
    return {
      loadingStartTime: startTime || now,
      errorOccurredAt: now,
      timeToError: startTime ? now - startTime : 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || undefined,
    };
  }

  /**
   * Report an error with full context and aggregation
   */
  reportError(
    error: FlipbookError,
    context: Partial<LogContext> = {},
    performanceStartTime?: number
  ): ErrorReport {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fingerprint = this.generateFingerprint(error, context);
    const aggregationKey = this.generateAggregationKey(error, context);
    
    const errorContext: ErrorReportContext = {
      ...context,
      errorId,
      errorType: error.type,
      severity: error.severity,
      recoverable: error.recoveryStrategy.canRetry,
      retryable: error.recoveryStrategy.canRetry,
      stackTrace: error.stack,
      breadcrumbs: [...this.breadcrumbs],
      userActions: [...this.userActions],
      performanceMetrics: this.collectPerformanceMetrics(performanceStartTime),
      timestamp: new Date().toISOString(),
      sessionId: flipbookLogger['sessionId'], // Access private property
    };

    const report: ErrorReport = {
      id: errorId,
      timestamp: new Date().toISOString(),
      context: errorContext,
      aggregationKey,
      fingerprint,
      environment: this.collectEnvironmentInfo(),
    };

    // Store the report
    this.errorReports.push(report);
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(-this.maxReports);
    }

    // Update aggregation
    this.updateErrorAggregation(report);

    // Log the error report
    flipbookLogger.error('Error reported', {
      component: 'ErrorReporter',
      errorId,
    }, {
      errorType: error.type,
      severity: error.severity,
      fingerprint,
      aggregationKey,
    }, error);

    // Add breadcrumb for the error
    this.addBreadcrumb('error', `Error reported: ${error.message}`, 'error', {
      errorId,
      errorType: error.type,
      severity: error.severity,
    });

    return report;
  }

  /**
   * Update error aggregation statistics
   */
  private updateErrorAggregation(report: ErrorReport): void {
    const { fingerprint } = report;
    const existing = this.errorAggregations.get(fingerprint);

    if (existing) {
      existing.count++;
      existing.lastSeen = report.timestamp;
      existing.samples.push(report);
      
      // Keep only the most recent samples
      if (existing.samples.length > 5) {
        existing.samples = existing.samples.slice(-5);
      }
    } else {
      const aggregation: ErrorAggregation = {
        fingerprint,
        count: 1,
        firstSeen: report.timestamp,
        lastSeen: report.timestamp,
        errorType: report.context.errorType,
        severity: report.context.severity,
        commonContext: {
          phase: report.context.phase,
          operation: report.context.operation,
          component: report.context.component,
        },
        samples: [report],
      };
      
      this.errorAggregations.set(fingerprint, aggregation);
    }
  }

  /**
   * Get error reports for a specific flipbook
   */
  getErrorReportsForFlipbook(flipbookId: string): ErrorReport[] {
    return this.errorReports.filter(report => 
      report.context.flipbookId === flipbookId
    );
  }

  /**
   * Get error aggregations sorted by frequency
   */
  getErrorAggregations(): ErrorAggregation[] {
    return Array.from(this.errorAggregations.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get recent error reports
   */
  getRecentErrorReports(limit: number = 10): ErrorReport[] {
    return this.errorReports
      .slice(-limit)
      .reverse();
  }

  /**
   * Export error data for debugging
   */
  exportErrorData(): {
    reports: ErrorReport[];
    aggregations: ErrorAggregation[];
    breadcrumbs: ErrorBreadcrumb[];
    userActions: UserAction[];
  } {
    return {
      reports: [...this.errorReports],
      aggregations: this.getErrorAggregations(),
      breadcrumbs: [...this.breadcrumbs],
      userActions: [...this.userActions],
    };
  }

  /**
   * Clear all error data
   */
  clearErrorData(): void {
    this.errorReports = [];
    this.errorAggregations.clear();
    this.breadcrumbs = [];
    this.userActions = [];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<FlipbookErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    mostCommonErrors: ErrorAggregation[];
  } {
    const errorsByType: Record<FlipbookErrorType, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    this.errorReports.forEach(report => {
      const type = report.context.errorType;
      const severity = report.context.severity;
      
      errorsByType[type] = (errorsByType[type] || 0) + 1;
      errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;
    });

    return {
      totalErrors: this.errorReports.length,
      errorsByType,
      errorsBySeverity,
      mostCommonErrors: this.getErrorAggregations().slice(0, 5),
    };
  }
}

// Create singleton instance
export const flipbookErrorReporter = new FlipbookErrorReporter();

// Convenience functions for common error reporting patterns
export const reportFlipbookError = (
  error: FlipbookError,
  flipbookId: string,
  phase: FlipbookLoadingPhase,
  operation?: string,
  performanceStartTime?: number
): ErrorReport => {
  return flipbookErrorReporter.reportError(error, {
    flipbookId,
    phase,
    operation,
    component: 'FlipbookView',
  }, performanceStartTime);
};

export const addFlipbookBreadcrumb = (
  category: ErrorBreadcrumb['category'],
  message: string,
  level: ErrorBreadcrumb['level'] = 'info',
  data?: Record<string, any>
): void => {
  flipbookErrorReporter.addBreadcrumb(category, message, level, data);
};

export const trackFlipbookUserAction = (
  action: string,
  target?: string,
  data?: Record<string, any>
): void => {
  flipbookErrorReporter.trackUserAction(action, target, data);
};