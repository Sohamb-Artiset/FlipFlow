/**
 * AuthError Classification System
 * 
 * This module provides comprehensive error classification, handling, and recovery
 * mechanisms for authentication-related errors with user-friendly messaging.
 */

// Auth error types and severity levels
type AuthErrorType = 'network' | 'validation' | 'session' | 'storage' | 'corruption' | 'permission' | 'unknown';
type AuthErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Auth error interface
interface AuthError {
  type: AuthErrorType;
  severity: AuthErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  technicalDetails: string;
  code?: string;
  timestamp: number;
  context?: Record<string, any>;
}

// Recovery action interface
interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  priority: number;
}

// Error classification result
interface ErrorClassificationResult {
  authError: AuthError;
  recoveryActions: RecoveryAction[];
  shouldRetry: boolean;
  retryDelay?: number;
}

// Error pattern matching
interface ErrorPattern {
  matcher: (error: any) => boolean;
  classifier: (error: any) => Partial<AuthError>;
}

/**
 * AuthErrorHandler class for comprehensive error management
 */
class AuthErrorHandler {
  private errorPatterns: ErrorPattern[] = [];
  private errorHistory: AuthError[] = [];
  private maxHistorySize = 100;

  constructor() {
    this.initializeErrorPatterns();
  }

  /**
   * Classify and handle an authentication error
   */
  public classifyAndHandle(
    error: any,
    context?: Record<string, any>
  ): ErrorClassificationResult {
    try {
      const authError = this.classifyError(error, context);
      const recoveryActions = this.generateRecoveryActions(authError);
      const shouldRetry = this.shouldRetryError(authError);
      const retryDelay = this.calculateRetryDelay(authError);

      // Add to error history
      this.addToHistory(authError);

      return {
        authError,
        recoveryActions,
        shouldRetry,
        retryDelay,
      };
    } catch (classificationError) {
      console.error('Error classification failed:', classificationError);
      
      // Return fallback error classification
      return this.createFallbackClassification(error, context);
    }
  }

  /**
   * Classify an error into AuthError structure
   */
  public classifyError(error: any, context?: Record<string, any>): AuthError {
    const baseError: AuthError = {
      type: 'unknown',
      severity: 'medium',
      recoverable: false,
      userMessage: 'An authentication error occurred',
      technicalDetails: this.extractTechnicalDetails(error),
      timestamp: Date.now(),
      context,
    };

    // Try to match against known patterns
    for (const pattern of this.errorPatterns) {
      if (pattern.matcher(error)) {
        const classification = pattern.classifier(error);
        return { ...baseError, ...classification };
      }
    }

    // Fallback classification based on error properties
    return this.performFallbackClassification(error, baseError);
  }

  /**
   * Generate user-friendly error message
   */
  public generateUserMessage(authError: AuthError): string {
    const baseMessages = {
      network: 'Connection issue occurred. Please check your internet connection.',
      validation: 'Authentication validation failed. Please try signing in again.',
      session: 'Your session has expired or become invalid.',
      storage: 'Local storage issue detected. Please clear your browser data.',
      corruption: 'Session data corruption detected. Signing out for security.',
      permission: 'Permission denied. Please check your account status.',
      unknown: 'An unexpected authentication error occurred.',
    };

    let message = baseMessages[authError.type] || baseMessages.unknown;

    // Add severity-specific context
    switch (authError.severity) {
      case 'critical':
        message = `Critical: ${message} Immediate action required.`;
        break;
      case 'high':
        message = `Important: ${message}`;
        break;
      case 'low':
        // Keep base message for low severity
        break;
    }

    return message;
  }

  /**
   * Get error history for debugging
   */
  public getErrorHistory(): AuthError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  public clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<AuthErrorType, number>;
    errorsBySeverity: Record<AuthErrorSeverity, number>;
    recentErrors: AuthError[];
  } {
    const errorsByType = this.errorHistory.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<AuthErrorType, number>);

    const errorsBySeverity = this.errorHistory.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<AuthErrorSeverity, number>);

    const recentErrors = this.errorHistory
      .filter(error => Date.now() - error.timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
      .slice(-10); // Last 10 errors

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors,
    };
  }

  /**
   * Initialize error pattern matching
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // Network errors
      {
        matcher: (error) => 
          error?.message?.includes('fetch') ||
          error?.message?.includes('network') ||
          error?.code === 'NETWORK_ERROR' ||
          error?.name === 'NetworkError',
        classifier: (error) => ({
          type: 'network',
          severity: 'medium',
          recoverable: true,
          userMessage: 'Network connection issue. Please check your internet and try again.',
          code: 'NETWORK_ERROR',
        }),
      },

      // Session expiration
      {
        matcher: (error) =>
          error?.message?.includes('expired') ||
          error?.message?.includes('invalid_token') ||
          error?.code === 'TOKEN_EXPIRED',
        classifier: (error) => ({
          type: 'session',
          severity: 'medium',
          recoverable: true,
          userMessage: 'Your session has expired. Please sign in again.',
          code: 'SESSION_EXPIRED',
        }),
      },

      // Permission/Authorization errors
      {
        matcher: (error) =>
          error?.message?.includes('unauthorized') ||
          error?.message?.includes('forbidden') ||
          error?.status === 401 ||
          error?.status === 403,
        classifier: (error) => ({
          type: 'permission',
          severity: 'high',
          recoverable: false,
          userMessage: 'Access denied. Please check your account permissions.',
          code: 'PERMISSION_DENIED',
        }),
      },

      // Validation errors
      {
        matcher: (error) =>
          error?.message?.includes('validation') ||
          error?.message?.includes('invalid') ||
          error?.code === 'VALIDATION_ERROR',
        classifier: (error) => ({
          type: 'validation',
          severity: 'medium',
          recoverable: true,
          userMessage: 'Authentication validation failed. Please try again.',
          code: 'VALIDATION_ERROR',
        }),
      },

      // Storage errors
      {
        matcher: (error) =>
          error?.message?.includes('localStorage') ||
          error?.message?.includes('storage') ||
          error?.name === 'QuotaExceededError',
        classifier: (error) => ({
          type: 'storage',
          severity: 'medium',
          recoverable: true,
          userMessage: 'Browser storage issue. Please clear your browser data and try again.',
          code: 'STORAGE_ERROR',
        }),
      },

      // Corruption errors
      {
        matcher: (error) =>
          error?.message?.includes('corrupt') ||
          error?.message?.includes('malformed') ||
          error?.code === 'CORRUPTION_DETECTED',
        classifier: (error) => ({
          type: 'corruption',
          severity: 'critical',
          recoverable: false,
          userMessage: 'Session corruption detected. Signing out for security.',
          code: 'CORRUPTION_DETECTED',
        }),
      },

      // Supabase specific errors
      {
        matcher: (error) =>
          error?.message?.includes('supabase') ||
          error?.message?.includes('Invalid JWT'),
        classifier: (error) => ({
          type: 'session',
          severity: 'high',
          recoverable: true,
          userMessage: 'Authentication service error. Please sign in again.',
          code: 'SUPABASE_ERROR',
        }),
      },
    ];
  }

  /**
   * Generate recovery actions based on error type
   */
  private generateRecoveryActions(authError: AuthError): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (authError.type) {
      case 'network':
        actions.push({
          label: 'Retry',
          action: () => window.location.reload(),
          priority: 1,
        });
        actions.push({
          label: 'Check Connection',
          action: () => window.open('https://www.google.com', '_blank'),
          priority: 2,
        });
        break;

      case 'session':
        actions.push({
          label: 'Sign In Again',
          action: () => window.location.href = '/auth',
          priority: 1,
        });
        break;

      case 'storage':
        actions.push({
          label: 'Clear Browser Data',
          action: () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          },
          priority: 1,
        });
        break;

      case 'corruption':
        actions.push({
          label: 'Sign Out Safely',
          action: async () => {
            try {
              // Perform safe sign out
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/auth';
            } catch (error) {
              console.error('Safe sign out failed:', error);
            }
          },
          priority: 1,
        });
        break;

      case 'validation':
        actions.push({
          label: 'Retry Authentication',
          action: () => window.location.href = '/auth',
          priority: 1,
        });
        break;

      default:
        actions.push({
          label: 'Refresh Page',
          action: () => window.location.reload(),
          priority: 1,
        });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Determine if error should trigger retry
   */
  private shouldRetryError(authError: AuthError): boolean {
    const retryableTypes: AuthErrorType[] = ['network', 'validation', 'session'];
    const retryableSeverities: AuthErrorSeverity[] = ['low', 'medium'];

    return (
      authError.recoverable &&
      retryableTypes.includes(authError.type) &&
      retryableSeverities.includes(authError.severity)
    );
  }

  /**
   * Calculate retry delay based on error type and history
   */
  private calculateRetryDelay(authError: AuthError): number | undefined {
    if (!this.shouldRetryError(authError)) {
      return undefined;
    }

    // Count recent similar errors
    const recentSimilarErrors = this.errorHistory.filter(
      error => 
        error.type === authError.type &&
        Date.now() - error.timestamp < 5 * 60 * 1000 // Last 5 minutes
    ).length;

    // Exponential backoff
    const baseDelay = 1000; // 1 second
    return Math.min(baseDelay * Math.pow(2, recentSimilarErrors), 30000); // Max 30 seconds
  }

  /**
   * Extract technical details from error
   */
  private extractTechnicalDetails(error: any): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      return JSON.stringify(error, null, 2);
    }

    return 'Unknown error type';
  }

  /**
   * Perform fallback classification for unmatched errors
   */
  private performFallbackClassification(error: any, baseError: AuthError): AuthError {
    // Check error message for keywords
    const errorMessage = error?.message?.toLowerCase() || '';

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return { ...baseError, type: 'network', recoverable: true };
    }

    if (errorMessage.includes('token') || errorMessage.includes('session')) {
      return { ...baseError, type: 'session', recoverable: true };
    }

    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return { ...baseError, type: 'permission', severity: 'high', recoverable: false };
    }

    // Default unknown error
    return baseError;
  }

  /**
   * Create fallback classification when classification itself fails
   */
  private createFallbackClassification(
    error: any,
    context?: Record<string, any>
  ): ErrorClassificationResult {
    const authError: AuthError = {
      type: 'unknown',
      severity: 'medium',
      recoverable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: 'Error classification failed',
      timestamp: Date.now(),
      context,
    };

    return {
      authError,
      recoveryActions: [{
        label: 'Retry',
        action: () => window.location.reload(),
        priority: 1,
      }],
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  /**
   * Add error to history
   */
  private addToHistory(authError: AuthError): void {
    this.errorHistory.push(authError);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }
}

// Export singleton instance
export const authErrorHandler = new AuthErrorHandler();

// Export types and class for external use
export type { 
  AuthError, 
  AuthErrorType, 
  AuthErrorSeverity, 
  RecoveryAction, 
  ErrorClassificationResult 
};
export { AuthErrorHandler };