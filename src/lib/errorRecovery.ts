import { ErrorClassification, ErrorContext, RecoveryResult } from './errorHandling';
import { errorNotificationManager } from './errorNotification';

/**
 * Error recovery patterns with exponential backoff and user guidance
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
  jitter?: boolean;
  onRetry?: (attempt: number, delay: number) => void;
  onSuccess?: (result: any) => void;
  onFailure?: (error: Error, attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

export interface RecoveryPattern {
  name: string;
  canHandle: (error: Error | unknown, context: ErrorContext) => boolean;
  recover: (error: Error | unknown, context: ErrorContext, options?: RetryOptions) => Promise<RecoveryResult>;
  userGuidance: {
    title: string;
    description: string;
    actions: Array<{
      label: string;
      action: () => void | Promise<void>;
      primary?: boolean;
    }>;
  };
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  exponentialBackoff: boolean = true,
  jitter: boolean = true
): number {
  let delay = exponentialBackoff ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;
  
  // Add jitter to prevent thundering herd
  if (jitter) {
    delay += Math.random() * 0.1 * delay;
  }
  
  return Math.min(delay, maxDelay);
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    exponentialBackoff = true,
    jitter = true,
    onRetry,
    onSuccess,
    onFailure,
    onMaxRetriesReached,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      onSuccess?.(result);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      onFailure?.(lastError, attempt);
      
      if (attempt === maxRetries) {
        onMaxRetriesReached?.();
        throw lastError;
      }
      
      const delay = calculateRetryDelay(attempt, baseDelay, maxDelay, exponentialBackoff, jitter);
      onRetry?.(attempt, delay);
      
      // Show retry notification
      errorNotificationManager.showInfo(
        `Retrying... (${attempt}/${maxRetries})`,
        `Waiting ${Math.round(delay / 1000)}s before retry`,
        { duration: delay }
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Network error recovery pattern
 */
export const networkRecoveryPattern: RecoveryPattern = {
  name: 'network',
  canHandle: (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('network') || 
           message.includes('fetch') || 
           message.includes('connection') ||
           message.includes('timeout');
  },
  recover: async (error, context, options) => {
    try {
      // Check network connectivity
      if (!navigator.onLine) {
        return {
          success: false,
          message: 'No internet connection detected. Please check your network.',
          shouldRetry: false,
        };
      }

      // Attempt to ping a reliable endpoint
      try {
        await fetch('/api/health', { method: 'HEAD', cache: 'no-cache' });
      } catch {
        // If health check fails, suggest waiting
        return {
          success: false,
          message: 'Server is temporarily unavailable. Please try again in a moment.',
          shouldRetry: true,
        };
      }

      return {
        success: true,
        message: 'Network connection restored.',
        shouldRetry: true,
      };
    } catch (recoveryError) {
      return {
        success: false,
        message: 'Unable to restore network connection.',
        shouldRetry: false,
      };
    }
  },
  userGuidance: {
    title: 'Connection Problem',
    description: 'We\'re having trouble connecting to our servers. This might be due to a network issue.',
    actions: [
      {
        label: 'Check Connection',
        action: () => {
          window.open('https://www.google.com', '_blank');
        },
      },
      {
        label: 'Retry',
        action: () => {
          window.location.reload();
        },
        primary: true,
      },
    ],
  },
};

/**
 * Authentication error recovery pattern
 */
export const authRecoveryPattern: RecoveryPattern = {
  name: 'auth',
  canHandle: (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('auth') || 
           message.includes('unauthorized') || 
           message.includes('token') ||
           message.includes('session');
  },
  recover: async (error, context) => {
    try {
      // Clear potentially corrupted auth data
      localStorage.removeItem('sb-wpqetuxkjsmzxzuvybes-auth-token');
      
      return {
        success: false,
        message: 'Authentication session expired. Please sign in again.',
        shouldRetry: false,
      };
    } catch (recoveryError) {
      return {
        success: false,
        message: 'Unable to clear authentication data.',
        shouldRetry: false,
      };
    }
  },
  userGuidance: {
    title: 'Authentication Required',
    description: 'Your session has expired or is invalid. Please sign in again to continue.',
    actions: [
      {
        label: 'Sign In',
        action: () => {
          window.location.href = '/auth';
        },
        primary: true,
      },
    ],
  },
};

/**
 * Server error recovery pattern
 */
export const serverRecoveryPattern: RecoveryPattern = {
  name: 'server',
  canHandle: (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('server') || 
           message.includes('database') || 
           message.includes('supabase') ||
           message.includes('500') ||
           message.includes('502') ||
           message.includes('503');
  },
  recover: async (error, context) => {
    try {
      // Check server status
      const response = await fetch('/api/health', { 
        method: 'HEAD', 
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'Server is responding normally.',
          shouldRetry: true,
        };
      } else {
        return {
          success: false,
          message: 'Server is experiencing issues. Please try again later.',
          shouldRetry: true,
        };
      }
    } catch (recoveryError) {
      return {
        success: false,
        message: 'Server is temporarily unavailable.',
        shouldRetry: true,
      };
    }
  },
  userGuidance: {
    title: 'Server Error',
    description: 'Our servers are experiencing issues. This is usually temporary.',
    actions: [
      {
        label: 'Try Again',
        action: () => {
          window.location.reload();
        },
        primary: true,
      },
      {
        label: 'Check Status',
        action: () => {
          window.open('https://status.flipflow.com', '_blank');
        },
      },
    ],
  },
};

/**
 * Validation error recovery pattern
 */
export const validationRecoveryPattern: RecoveryPattern = {
  name: 'validation',
  canHandle: (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('validation') || 
           message.includes('invalid') || 
           message.includes('required') ||
           message.includes('format');
  },
  recover: async (error, context) => {
    return {
      success: false,
      message: 'Please check your input and try again.',
      shouldRetry: false,
    };
  },
  userGuidance: {
    title: 'Input Error',
    description: 'There\'s an issue with the information you provided. Please review and correct it.',
    actions: [
      {
        label: 'Review Input',
        action: () => {
          // Focus on the first invalid input if available
          const firstInvalidInput = document.querySelector('input:invalid, textarea:invalid');
          if (firstInvalidInput) {
            (firstInvalidInput as HTMLElement).focus();
          }
        },
        primary: true,
      },
    ],
  },
};

/**
 * Permission error recovery pattern
 */
export const permissionRecoveryPattern: RecoveryPattern = {
  name: 'permission',
  canHandle: (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('permission') || 
           message.includes('forbidden') || 
           message.includes('access denied') ||
           message.includes('403');
  },
  recover: async (error, context) => {
    return {
      success: false,
      message: 'You don\'t have permission to perform this action.',
      shouldRetry: false,
    };
  },
  userGuidance: {
    title: 'Access Denied',
    description: 'You don\'t have the necessary permissions for this action. You may need to upgrade your plan or contact support.',
    actions: [
      {
        label: 'View Plans',
        action: () => {
          window.location.href = '/pricing';
        },
        primary: true,
      },
      {
        label: 'Contact Support',
        action: () => {
          window.open('mailto:support@flipflow.com', '_blank');
        },
      },
    ],
  },
};

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private patterns: RecoveryPattern[] = [];

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  constructor() {
    this.registerDefaultPatterns();
  }

  private registerDefaultPatterns() {
    this.patterns = [
      networkRecoveryPattern,
      authRecoveryPattern,
      serverRecoveryPattern,
      validationRecoveryPattern,
      permissionRecoveryPattern,
    ];
  }

  /**
   * Register a custom recovery pattern
   */
  registerPattern(pattern: RecoveryPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Find appropriate recovery pattern for an error
   */
  findPattern(error: Error | unknown, context: ErrorContext): RecoveryPattern | null {
    return this.patterns.find(pattern => pattern.canHandle(error, context)) || null;
  }

  /**
   * Attempt recovery using appropriate pattern
   */
  async attemptRecovery(
    error: Error | unknown,
    context: ErrorContext,
    options?: RetryOptions
  ): Promise<RecoveryResult> {
    const pattern = this.findPattern(error, context);
    
    if (!pattern) {
      return {
        success: false,
        message: 'No recovery pattern available for this error.',
        shouldRetry: false,
      };
    }

    try {
      const result = await pattern.recover(error, context, options);
      
      // Show user guidance if recovery failed
      if (!result.success) {
        this.showUserGuidance(pattern);
      }
      
      return result;
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return {
        success: false,
        message: 'Recovery attempt failed.',
        shouldRetry: false,
      };
    }
  }

  /**
   * Show user guidance for error recovery
   */
  private showUserGuidance(pattern: RecoveryPattern): void {
    const { title, description, actions } = pattern.userGuidance;
    
    const primaryAction = actions.find(action => action.primary);
    const secondaryActions = actions.filter(action => !action.primary);

    errorNotificationManager.showError(
      `recovery-guidance-${pattern.name}`,
      title,
      description,
      {
        action: primaryAction ? {
          label: primaryAction.label,
          onClick: primaryAction.action,
        } : undefined,
        duration: 10000, // Longer duration for guidance
      }
    );

    // Show secondary actions as separate notifications if needed
    secondaryActions.forEach((action, index) => {
      setTimeout(() => {
        errorNotificationManager.showInfo(
          'Additional Options',
          `You can also: ${action.label}`,
          {
            action: {
              label: action.label,
              onClick: action.action,
            },
            duration: 8000,
          }
        );
      }, (index + 1) * 2000); // Stagger secondary notifications
    });
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): RecoveryPattern[] {
    return [...this.patterns];
  }
}

// Export singleton instance
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();

// Convenience function for retrying operations with recovery
export async function retryWithRecovery<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(async () => {
    try {
      return await operation();
    } catch (error) {
      // Attempt recovery before retrying
      const recoveryResult = await errorRecoveryManager.attemptRecovery(error, context, options);
      
      if (recoveryResult.success && recoveryResult.shouldRetry) {
        // Recovery successful, retry the operation
        return await operation();
      } else {
        // Recovery failed or shouldn't retry
        throw error;
      }
    }
  }, options);
}