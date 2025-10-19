import { toast } from 'sonner';
import { errorNotificationManager } from './errorNotification';
import { errorRecoveryManager, retryWithRecovery } from './errorRecovery';

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

export interface ErrorClassification {
  type: 'network' | 'auth' | 'validation' | 'permission' | 'server' | 'client' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  retryable: boolean;
  retryDelay: number;
  maxRetries: number;
}

export interface RecoveryStrategy {
  canRecover: (error: Error | unknown, context: ErrorContext) => boolean;
  recover: (error: Error | unknown, context: ErrorContext) => Promise<RecoveryResult>;
  retryDelay: number;
  maxRetries: number;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  shouldRetry: boolean;
  data?: any;
}

/**
 * Enhanced error classification and handling with recovery strategies
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReports: ErrorReport[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.set('network', {
      canRecover: (error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        return message.includes('network') || message.includes('fetch') || message.includes('connection');
      },
      recover: async (error, context) => {
        // Attempt to retry the network operation
        return {
          success: false,
          message: 'Network connection restored. Please try again.',
          shouldRetry: true,
        };
      },
      retryDelay: 2000,
      maxRetries: 3,
    });

    // Authentication error recovery
    this.recoveryStrategies.set('auth', {
      canRecover: (error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        return message.includes('auth') || message.includes('unauthorized') || message.includes('token');
      },
      recover: async (error, context) => {
        // Clear auth state and redirect to login
        return {
          success: false,
          message: 'Please sign in again to continue.',
          shouldRetry: false,
        };
      },
      retryDelay: 0,
      maxRetries: 0,
    });

    // Server error recovery
    this.recoveryStrategies.set('server', {
      canRecover: (error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        return message.includes('server') || message.includes('database') || message.includes('supabase');
      },
      recover: async (error, context) => {
        return {
          success: false,
          message: 'Server is temporarily unavailable. Please try again.',
          shouldRetry: true,
        };
      },
      retryDelay: 5000,
      maxRetries: 2,
    });
  }

  /**
   * Classify error type and severity with enhanced recovery information
   */
  classifyError(error: Error | unknown): ErrorClassification {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: 'Connection problem. Please check your internet connection.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: true,
        retryable: true,
        retryDelay: 2000,
        maxRetries: 3,
      };
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
      return {
        type: 'auth',
        severity: 'high',
        userMessage: 'Authentication failed. Please sign in again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: true,
        retryable: false,
        retryDelay: 0,
        maxRetries: 0,
      };
    }

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || errorMessage.includes('access denied')) {
      return {
        type: 'permission',
        severity: 'medium',
        userMessage: 'You don\'t have permission to perform this action.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: false,
        retryable: false,
        retryDelay: 0,
        maxRetries: 0,
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
      return {
        type: 'validation',
        severity: 'low',
        userMessage: 'Please check your input and try again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: true,
        retryable: false,
        retryDelay: 0,
        maxRetries: 0,
      };
    }

    // Server errors
    if (errorMessage.includes('server') || errorMessage.includes('database') || errorMessage.includes('supabase') || errorMessage.includes('500')) {
      return {
        type: 'server',
        severity: 'high',
        userMessage: 'Server error occurred. Please try again in a moment.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: true,
        retryable: true,
        retryDelay: 5000,
        maxRetries: 2,
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: 'Request timed out. Please try again.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        recoverable: true,
        retryable: true,
        retryDelay: 3000,
        maxRetries: 2,
      };
    }

    // Client-side errors (JavaScript errors, etc.)
    if (error instanceof Error && (error.name === 'TypeError' || error.name === 'ReferenceError')) {
      return {
        type: 'client',
        severity: 'critical',
        userMessage: 'An application error occurred. Please refresh the page.',
        technicalMessage: error.message,
        recoverable: false,
        retryable: false,
        retryDelay: 0,
        maxRetries: 0,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error instanceof Error ? error.message : String(error),
      recoverable: true,
      retryable: true,
      retryDelay: 2000,
      maxRetries: 1,
    };
  }

  /**
   * Attempt to recover from an error using registered recovery patterns
   */
  async attemptRecovery(
    error: Error | unknown,
    context: ErrorContext = {}
  ): Promise<RecoveryResult> {
    const classification = this.classifyError(error);
    
    if (!classification.recoverable) {
      return {
        success: false,
        message: 'This error cannot be automatically recovered.',
        shouldRetry: false,
      };
    }

    // Use the enhanced recovery manager
    return await errorRecoveryManager.attemptRecovery(error, context, {
      maxRetries: classification.maxRetries,
      baseDelay: classification.retryDelay,
    });
  }

  /**
   * Handle error with appropriate user feedback, logging, and recovery attempts
   */
  handleError(
    error: Error | unknown,
    context: ErrorContext = {},
    options: {
      showToast?: boolean;
      logError?: boolean;
      reportError?: boolean;
      attemptRecovery?: boolean;
    } = {}
  ): ErrorReport {
    const { showToast = true, logError = true, reportError = true, attemptRecovery = false } = options;
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

    // Attempt recovery if requested
    if (attemptRecovery && classification.recoverable) {
      this.attemptRecovery(error, context).then(recoveryResult => {
        if (recoveryResult.success) {
          toast.success('Recovery Successful', {
            description: recoveryResult.message,
          });
        }
      }).catch(recoveryError => {
        console.error('Recovery attempt failed:', recoveryError);
      });
    }

    return errorReport;
  }

  /**
   * Show appropriate user feedback based on error classification
   */
  private showUserFeedback(
    classification: ErrorClassification,
    errorId: string
  ) {
    const duration = classification.severity === 'critical' ? 10000 : 5000;

    switch (classification.type) {
      case 'network':
        errorNotificationManager.showError(
          errorId,
          'Connection Problem',
          classification.userMessage,
          {
            action: {
              label: 'Retry',
              onClick: () => {
                console.log('Retry requested for network error');
              },
            },
            duration,
          }
        );
        break;

      case 'auth':
        errorNotificationManager.showError(
          errorId,
          'Authentication Required',
          classification.userMessage,
          {
            action: {
              label: 'Sign In',
              onClick: () => {
                window.location.href = '/auth';
              },
            },
            duration,
          }
        );
        break;

      case 'permission':
        errorNotificationManager.showError(
          errorId,
          'Access Denied',
          classification.userMessage,
          {
            action: {
              label: 'Contact Support',
              onClick: () => {
                window.open('mailto:support@flipflow.com', '_blank');
              },
            },
            duration,
          }
        );
        break;

      case 'validation':
        errorNotificationManager.showWarning(
          'Input Error',
          classification.userMessage,
          { duration }
        );
        break;

      case 'server':
        errorNotificationManager.showError(
          errorId,
          'Server Error',
          classification.userMessage,
          {
            action: {
              label: 'Try Again',
              onClick: () => {
                console.log('Retry requested for server error');
              },
            },
            duration,
          }
        );
        break;

      case 'client':
        errorNotificationManager.showError(
          errorId,
          'Application Error',
          classification.userMessage,
          {
            action: {
              label: 'Refresh Page',
              onClick: () => {
                window.location.reload();
              },
            },
            duration,
          }
        );
        break;

      default:
        errorNotificationManager.showError(
          errorId,
          'Unexpected Error',
          classification.userMessage,
          {
            action: {
              label: 'Try Again',
              onClick: () => {
                console.log('Retry requested for unknown error');
              },
            },
            duration,
          }
        );
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
    attemptRecovery?: boolean;
    onError?: (error: ErrorReport) => void;
    onRecovery?: (result: RecoveryResult) => void;
  } = {}
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, options);
    options.onError?.(errorReport);

    // Attempt recovery if requested
    if (options.attemptRecovery) {
      try {
        const recoveryResult = await errorHandler.attemptRecovery(error, context);
        options.onRecovery?.(recoveryResult);
        
        if (recoveryResult.success && recoveryResult.shouldRetry) {
          // Retry the operation once after successful recovery
          try {
            return await operation();
          } catch (retryError) {
            console.warn('Operation failed after recovery attempt:', retryError);
          }
        }
      } catch (recoveryError) {
        console.error('Recovery attempt failed:', recoveryError);
      }
    }

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
    attemptRecovery?: boolean;
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
 * React hook for error handling with recovery capabilities
 */
export const useErrorHandler = () => {
  const handleError = (
    error: Error | unknown,
    context: ErrorContext = {},
    options: {
      showToast?: boolean;
      logError?: boolean;
      reportError?: boolean;
      attemptRecovery?: boolean;
    } = {}
  ) => {
    return errorHandler.handleError(error, context, options);
  };

  const handleAsyncOperation = async <T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    options: {
      attemptRecovery?: boolean;
      maxRetries?: number;
      onRecovery?: (result: RecoveryResult) => void;
    } = {}
  ): Promise<T | null> => {
    if (options.attemptRecovery) {
      try {
        return await retryWithRecovery(operation, context, {
          maxRetries: options.maxRetries || 3,
          onSuccess: (result) => console.log('Operation succeeded after recovery'),
          onFailure: (error, attempt) => console.warn(`Attempt ${attempt} failed:`, error),
        });
      } catch (error) {
        const errorReport = errorHandler.handleError(error, context);
        return null;
      }
    } else {
      return handleAsyncError(operation, context, {
        attemptRecovery: options.attemptRecovery,
        onRecovery: options.onRecovery,
      });
    }
  };

  const attemptRecovery = async (
    error: Error | unknown,
    context: ErrorContext = {}
  ): Promise<RecoveryResult> => {
    return errorHandler.attemptRecovery(error, context);
  };

  const classifyError = (error: Error | unknown): ErrorClassification => {
    return errorHandler.classifyError(error);
  };

  const retryWithRecoveryPattern = async <T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    options: {
      maxRetries?: number;
      baseDelay?: number;
    } = {}
  ): Promise<T | null> => {
    try {
      return await retryWithRecovery(operation, context, options);
    } catch (error) {
      handleError(error, context);
      return null;
    }
  };

  return {
    handleError,
    handleAsyncOperation,
    attemptRecovery,
    classifyError,
    retryWithRecoveryPattern,
    getErrorStats: () => errorHandler.getErrorStats(),
    clearErrors: () => errorHandler.clearErrorReports(),
  };
};