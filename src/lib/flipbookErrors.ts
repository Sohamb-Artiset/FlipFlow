/**
 * Comprehensive error classification system for flipbook operations
 * Provides structured error handling with recovery strategies
 */

export type FlipbookErrorType = 
  | 'network'
  | 'pdf_processing'
  | 'authentication'
  | 'timeout'
  | 'cors'
  | 'not_found'
  | 'permission_denied'
  | 'invalid_pdf'
  | 'server_error'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RecoveryStrategy {
  canRetry: boolean;
  maxRetries?: number;
  retryDelayMs?: number[];
  fallbackAction?: 'download_original' | 'show_cached' | 'redirect_home' | 'contact_support';
  userMessage: string;
  actionLabel?: string;
}

export interface FlipbookErrorContext {
  flipbookId?: string;
  userId?: string;
  pdfUrl?: string;
  operation?: string;
  phase?: string;
  userAgent?: string;
  timestamp: string;
  additionalData?: Record<string, any>;
}

export class FlipbookError extends Error {
  public readonly type: FlipbookErrorType;
  public readonly severity: ErrorSeverity;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly context: FlipbookErrorContext;
  public readonly originalError?: Error;
  public readonly debugInfo: Record<string, any>;

  constructor(
    type: FlipbookErrorType,
    message: string,
    context: Partial<FlipbookErrorContext> = {},
    originalError?: Error,
    debugInfo: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'FlipbookError';
    this.type = type;
    this.severity = this.determineSeverity(type);
    this.recoveryStrategy = this.determineRecoveryStrategy(type);
    this.context = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ...context,
    };
    this.originalError = originalError;
    this.debugInfo = {
      ...debugInfo,
      errorType: type,
      severity: this.severity,
      stack: this.stack,
      originalStack: originalError?.stack,
    };
  }

  private determineSeverity(type: FlipbookErrorType): ErrorSeverity {
    const severityMap: Record<FlipbookErrorType, ErrorSeverity> = {
      network: 'medium',
      pdf_processing: 'high',
      authentication: 'high',
      timeout: 'medium',
      cors: 'high',
      not_found: 'high',
      permission_denied: 'high',
      invalid_pdf: 'high',
      server_error: 'critical',
      unknown: 'medium',
    };

    return severityMap[type];
  }

  private determineRecoveryStrategy(type: FlipbookErrorType): RecoveryStrategy {
    const strategies: Record<FlipbookErrorType, RecoveryStrategy> = {
      network: {
        canRetry: true,
        maxRetries: 3,
        retryDelayMs: [1000, 2000, 4000],
        userMessage: 'Network connection issue. Please check your internet connection and try again.',
        actionLabel: 'Retry',
      },
      pdf_processing: {
        canRetry: true,
        maxRetries: 2,
        retryDelayMs: [2000, 5000],
        fallbackAction: 'download_original',
        userMessage: 'There was an issue processing the PDF. You can try again or download the original file.',
        actionLabel: 'Retry',
      },
      authentication: {
        canRetry: false,
        fallbackAction: 'redirect_home',
        userMessage: 'Authentication required. Please sign in to view this flipbook.',
        actionLabel: 'Sign In',
      },
      timeout: {
        canRetry: true,
        maxRetries: 1,
        retryDelayMs: [5000],
        userMessage: 'The operation is taking longer than expected. You can wait a bit more or try again.',
        actionLabel: 'Try Again',
      },
      cors: {
        canRetry: true,
        maxRetries: 1,
        retryDelayMs: [1000],
        fallbackAction: 'download_original',
        userMessage: 'There was a security issue loading the PDF. Please try again or download the original file.',
        actionLabel: 'Retry',
      },
      not_found: {
        canRetry: false,
        fallbackAction: 'redirect_home',
        userMessage: 'This flipbook could not be found. It may have been deleted or moved.',
        actionLabel: 'Go Home',
      },
      permission_denied: {
        canRetry: false,
        fallbackAction: 'redirect_home',
        userMessage: 'You do not have permission to view this flipbook.',
        actionLabel: 'Go Home',
      },
      invalid_pdf: {
        canRetry: false,
        fallbackAction: 'contact_support',
        userMessage: 'The PDF file appears to be corrupted or invalid. Please contact support for assistance.',
        actionLabel: 'Contact Support',
      },
      server_error: {
        canRetry: true,
        maxRetries: 2,
        retryDelayMs: [3000, 10000],
        fallbackAction: 'contact_support',
        userMessage: 'A server error occurred. Please try again in a moment or contact support if the issue persists.',
        actionLabel: 'Retry',
      },
      unknown: {
        canRetry: true,
        maxRetries: 1,
        retryDelayMs: [2000],
        fallbackAction: 'contact_support',
        userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
        actionLabel: 'Retry',
      },
    };

    return strategies[type];
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      context: this.context,
      debugInfo: this.debugInfo,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}

/**
 * Error classification utility functions
 */
export class FlipbookErrorClassifier {
  /**
   * Classify an error based on its characteristics
   */
  static classifyError(error: Error, context: Partial<FlipbookErrorContext> = {}): FlipbookError {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Network-related errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorName.includes('networkerror') ||
      errorMessage.includes('failed to fetch')
    ) {
      return new FlipbookError('network', error.message, context, error);
    }

    // CORS errors
    if (
      errorMessage.includes('cors') ||
      errorMessage.includes('cross-origin') ||
      errorMessage.includes('access-control-allow-origin')
    ) {
      return new FlipbookError('cors', error.message, context, error);
    }

    // Authentication errors
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('login') ||
      errorMessage.includes('token') ||
      errorName.includes('autherror')
    ) {
      return new FlipbookError('authentication', error.message, context, error);
    }

    // Timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorName.includes('timeouterror')
    ) {
      return new FlipbookError('timeout', error.message, context, error);
    }

    // Not found errors
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('does not exist')
    ) {
      return new FlipbookError('not_found', error.message, context, error);
    }

    // Permission errors
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('403') ||
      errorMessage.includes('private')
    ) {
      return new FlipbookError('permission_denied', error.message, context, error);
    }

    // PDF processing errors
    if (
      errorMessage.includes('pdf') ||
      errorMessage.includes('invalid format') ||
      errorMessage.includes('corrupted') ||
      errorMessage.includes('parsing')
    ) {
      return new FlipbookError('pdf_processing', error.message, context, error);
    }

    // Server errors
    if (
      errorMessage.includes('server error') ||
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    ) {
      return new FlipbookError('server_error', error.message, context, error);
    }

    // Default to unknown
    return new FlipbookError('unknown', error.message, context, error);
  }

  /**
   * Create a specific error type with context
   */
  static createNetworkError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('network', message, context);
  }

  static createPDFProcessingError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('pdf_processing', message, context);
  }

  static createTimeoutError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('timeout', message, context);
  }

  static createAuthenticationError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('authentication', message, context);
  }

  static createCORSError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('cors', message, context);
  }

  static createNotFoundError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('not_found', message, context);
  }

  static createPermissionError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('permission_denied', message, context);
  }

  static createInvalidPDFError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('invalid_pdf', message, context);
  }

  static createServerError(message: string, context?: Partial<FlipbookErrorContext>): FlipbookError {
    return new FlipbookError('server_error', message, context);
  }
}

/**
 * Utility functions for error handling
 */
export const getErrorDisplayMessage = (error: FlipbookError): string => {
  return error.recoveryStrategy.userMessage;
};

export const getErrorActionLabel = (error: FlipbookError): string => {
  return error.recoveryStrategy.actionLabel || 'Try Again';
};

export const canRetryError = (error: FlipbookError): boolean => {
  return error.recoveryStrategy.canRetry;
};

export const getRetryDelay = (error: FlipbookError, attemptNumber: number): number => {
  const delays = error.recoveryStrategy.retryDelayMs || [1000];
  return delays[Math.min(attemptNumber, delays.length - 1)];
};

export const shouldShowFallbackAction = (error: FlipbookError): boolean => {
  return !!error.recoveryStrategy.fallbackAction;
};

export const getFallbackActionLabel = (error: FlipbookError): string => {
  const fallbackLabels = {
    download_original: 'Download Original PDF',
    show_cached: 'Show Cached Version',
    redirect_home: 'Go to Dashboard',
    contact_support: 'Contact Support',
  };

  return fallbackLabels[error.recoveryStrategy.fallbackAction!] || 'Alternative Action';
};