import { toast } from 'sonner';

/**
 * Comprehensive error handling utilities for the application
 */

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Enhanced error classification and handling
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReports: ErrorReport[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Classify error type and severity
   */
  classifyError(error: Error | unknown): {
    type: 'network' | 'auth' | 'validation' | 'permission' | 'server' | 'client' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    userMessage: string;
    technicalMessage: string;
    shouldRetry: boolean;
    retryDelay: number;
  } {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: 'Connection problem. Please check your internet connection.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: true,
        retryDelay: 2000,
      };
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
      return {
        type: 'auth',
        severity: 'high',
        userMessage: 'Authentication failed. Please sign in again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: false,
        retryDelay: 0,
      };
    }

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || errorMessage.includes('access denied')) {
      return {
        type: 'permission',
        severity: 'medium',
        userMessage: 'You don\'t have permission to perform this action.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: false,
        retryDelay: 0,
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
      return {
        type: 'validation',
        severity: 'low',
        userMessage: 'Please check your input and try again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: false,
        retryDelay: 0,
      };
    }

    // Server errors
    if (errorMessage.includes('server') || errorMessage.includes('database') || errorMessage.includes('supabase') || errorMessage.includes('500')) {
      return {
        type: 'server',
        severity: 'high',
        userMessage: 'Server error occurred. Please try again in a moment.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: true,
        retryDelay: 5000,
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: 'Request timed out. Please try again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        shouldRetry: true,
        retryDelay: 3000,
      };
    }

    // Client-side errors (JavaScript errors, etc.)
    if (error instanceof Error && (error.name === 'TypeError' || error.name === 'ReferenceError')) {
      return {
        type: 'client',
        severity: 'critical',
        userMessage: 'An application error occurred. Please refresh the page.',
        technicalMessage: error.message,
        shouldRetry: false,
        retryDelay: 0,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error instanceof Error ? error.message : String(error),
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  /**
   * Handle error with appropriate user feedback and logging
   */
  handleError(
    error: Error | unknown,
    context: ErrorContext = {},
    options: {
      showToast?: boolean;
      logError?: boolean;
      reportError?: boolean;
    } = {}
  ): ErrorReport {
    const { showToast = true, logError = true, reportError = true } = options;
    const classification = this.classifyError(error);
    
    // Generate error report
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: classification.technicalMessage,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity: classification.severity,
    };

    // Log error
    if (logError) {
      this.logError(errorReport, classification);
    }

    // Report error to external service
    if (reportError && classification.severity !== 'low') {
      this.reportError(errorReport);
    }

    // Show user feedback
    if (showToast) {
      this.showUserFeedback(classification, errorReport.id);
    }

    // Store error report
    this.errorReports.push(errorReport);

    return errorReport;
  }

  /**
   * Show appropriate user feedback based on error classification
   */
  private showUserFeedback(
    classification: ReturnType<typeof this.classifyError>,
    errorId: string
  ) {
    const baseToastOptions = {
      id: errorId,
      duration: classification.severity === 'critical' ? 10000 : 5000,
    };

    switch (classification.type) {
      case 'network':
        toast.error('Connection Problem', {
          description: classification.userMessage,
          action: {
            label: 'Retry',
            onClick: () => {
              // Retry will be handled by the calling component
              console.log('Retry requested for network error');
            },
          },
          ...baseToastOptions,
        });
        break;

      case 'auth':
        toast.error('Authentication Required', {
          description: classification.userMessage,
          action: {
            label: 'Sign In',
            onClick: () => {
              window.location.href = '/auth';
            },
          },
          ...baseToastOptions,
        });
        break;

      case 'permission':
        toast.error('Access Denied', {
          description: classification.userMessage,
          action: {
            label: 'Contact Support',
            onClick: () => {
              window.open('mailto:support@flipflow.com', '_blank');
            },
          },
          ...baseToastOptions,
        });
        break;

      case 'validation':
        toast.warning('Input Error', {
          description: classification.userMessage,
          ...baseToastOptions,
        });
        break;

      case 'server':
        toast.error('Server Error', {
          description: classification.userMessage,
          action: {
            label: 'Try Again',
            onClick: () => {
              console.log('Retry requested for server error');
            },
          },
          ...baseToastOptions,
        });
        break;

      case 'client':
        toast.error('Application Error', {
          description: classification.userMessage,
          action: {
            label: 'Refresh Page',
            onClick: () => {
              window.location.reload();
            },
          },
          ...baseToastOptions,
        });
        break;

      default:
        toast.error('Unexpected Error', {
          description: classification.userMessage,
          action: {
            label: 'Try Again',
            onClick: () => {
              console.log('Retry requested for unknown error');
            },
          },
          ...baseToastOptions,
        });
    }
  }

  /**
   * Log error to console with structured format
   */
  private logError(
    errorReport: ErrorReport,
    classification: ReturnType<typeof this.classifyError>
  ) {
    const logLevel = classification.severity === 'critical' ? 'error' : 
                    classification.severity === 'high' ? 'error' :
                    classification.severity === 'medium' ? 'warn' : 'info';

    console.group(`🚨 ${classification.severity.toUpperCase()} ERROR - ${classification.type.toUpperCase()}`);
    console[logLevel]('Error ID:', errorReport.id);
    console[logLevel]('Message:', errorReport.message);
    console[logLevel]('Context:', errorReport.context);
    console[logLevel]('Classification:', classification);
    
    if (errorReport.stack) {
      console[logLevel]('Stack:', errorReport.stack);
    }
    
    console.groupEnd();
  }

  /**
   * Report error to external monitoring service
   */
  private reportError(errorReport: ErrorReport) {
    // In a real application, send to error monitoring service
    // Examples: Sentry, LogRocket, Bugsnag, DataDog, etc.
    
    if (process.env.NODE_ENV === 'development') {
      console.info('📊 Error would be reported to monitoring service:', errorReport);
      return;
    }

    // Example implementation for Sentry:
    // Sentry.captureException(new Error(errorReport.message), {
    //   tags: {
    //     errorId: errorReport.id,
    //     severity: errorReport.severity,
    //     component: errorReport.context.component,
    //   },
    //   extra: errorReport,
    // });

    // Example implementation for custom API:
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport),
    // }).catch(err => {
    //   console.error('Failed to report error:', err);
    // });
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Get error reports for debugging
   */
  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  /**
   * Clear error reports
   */
  clearErrorReports(): void {
    this.errorReports = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: ErrorReport[];
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    this.errorReports.forEach(report => {
      const classification = this.classifyError(new Error(report.message));
      byType[classification.type] = (byType[classification.type] || 0) + 1;
      bySeverity[report.severity] = (bySeverity[report.severity] || 0) + 1;
    });

    const recent = this.errorReports
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      total: this.errorReports.length,
      byType,
      bySeverity,
      recent,
    };
  }
}

/**
 * Convenience functions for common error handling scenarios
 */
export const errorHandler = ErrorHandler.getInstance();

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
  options: {
    showToast?: boolean;
    logError?: boolean;
    reportError?: boolean;
    onError?: (error: ErrorReport) => void;
  } = {}
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, options);
    options.onError?.(errorReport);
    return null;
  }
};

export const handleSyncError = <T>(
  operation: () => T,
  context: ErrorContext = {},
  options: {
    showToast?: boolean;
    logError?: boolean;
    reportError?: boolean;
    onError?: (error: ErrorReport) => void;
  } = {}
): T | null => {
  try {
    return operation();
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, options);
    options.onError?.(errorReport);
    return null;
  }
};

/**
 * React hook for error handling
 */
export const useErrorHandler = () => {
  const handleError = (
    error: Error | unknown,
    context: ErrorContext = {},
    options: {
      showToast?: boolean;
      logError?: boolean;
      reportError?: boolean;
    } = {}
  ) => {
    return errorHandler.handleError(error, context, options);
  };

  const handleAsyncOperation = async <T>(
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T | null> => {
    return handleAsyncError(operation, context);
  };

  return {
    handleError,
    handleAsyncOperation,
    getErrorStats: () => errorHandler.getErrorStats(),
    clearErrors: () => errorHandler.clearErrorReports(),
  };
};