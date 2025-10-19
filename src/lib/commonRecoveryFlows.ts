import { retryWithRecovery, ErrorContext } from './errorRecovery';
import { errorHandler, ErrorClassification } from './errorHandling';
import { supabase } from '@/integrations/supabase/client';

/**
 * Common error recovery flows for typical application scenarios
 * These provide pre-configured recovery patterns for common operations
 */

export interface RecoveryFlowOptions {
  maxRetries?: number;
  baseDelay?: number;
  showUserFeedback?: boolean;
  onProgress?: (attempt: number, maxAttempts: number) => void;
  onRecovery?: (recoveryType: string) => void;
}

/**
 * Database operation with automatic retry and connection recovery
 */
export async function withDatabaseRecovery<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 2000,
    showUserFeedback = true,
    onProgress,
    onRecovery
  } = options;

  return retryWithRecovery(
    operation,
    {
      ...context,
      component: context.component || 'database',
    },
    {
      maxRetries,
      baseDelay,
      exponentialBackoff: true,
      jitter: true,
      onRetry: (attempt, delay) => {
        onProgress?.(attempt, maxRetries);
        console.log(`Database operation retry ${attempt}/${maxRetries} in ${delay}ms`);
      },
      onSuccess: () => {
        onRecovery?.('database-retry-success');
      },
      onFailure: (error, attempt) => {
        if (showUserFeedback && attempt === maxRetries) {
          errorHandler.handleError(error, context, {
            showToast: true,
            attemptRecovery: false
          });
        }
      }
    }
  );
}

/**
 * File upload with automatic retry and progress tracking
 */
export async function withUploadRecovery<T>(
  uploadOperation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelay = 3000,
    showUserFeedback = true,
    onProgress,
    onRecovery
  } = options;

  return retryWithRecovery(
    uploadOperation,
    {
      ...context,
      component: context.component || 'upload',
    },
    {
      maxRetries,
      baseDelay,
      exponentialBackoff: true,
      onRetry: (attempt, delay) => {
        onProgress?.(attempt, maxRetries);
        if (showUserFeedback) {
          // Show upload retry notification
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showInfo(
            'Upload Retry',
            `Retrying upload... (${attempt}/${maxRetries})`,
            { duration: delay }
          );
        }
      },
      onSuccess: () => {
        onRecovery?.('upload-retry-success');
        if (showUserFeedback) {
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showSuccess(
            'Upload Successful',
            'File uploaded successfully after retry'
          );
        }
      },
      onFailure: (error, attempt) => {
        if (showUserFeedback && attempt === maxRetries) {
          errorHandler.handleError(error, context, {
            showToast: true,
            attemptRecovery: false
          });
        }
      }
    }
  );
}

/**
 * Authentication operation with token refresh and session recovery
 */
export async function withAuthRecovery<T>(
  authOperation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions = {}
): Promise<T> {
  const {
    maxRetries = 1,
    showUserFeedback = true,
    onRecovery
  } = options;

  try {
    return await authOperation();
  } catch (error) {
    const classification = errorHandler.classifyError(error);
    
    if (classification.type === 'auth' && maxRetries > 0) {
      try {
        // Attempt to refresh the session
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          throw new Error('Session refresh failed');
        }

        onRecovery?.('auth-session-refresh');
        
        if (showUserFeedback) {
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showInfo(
            'Session Refreshed',
            'Authentication renewed, retrying operation...'
          );
        }

        // Retry the operation with refreshed session
        return await authOperation();
      } catch (refreshError) {
        // Session refresh failed, redirect to auth
        if (showUserFeedback) {
          errorHandler.handleError(refreshError, {
            ...context,
            operation: 'session-refresh'
          }, {
            showToast: true,
            attemptRecovery: false
          });
        }
        throw refreshError;
      }
    } else {
      // Not an auth error or no retries left
      if (showUserFeedback) {
        errorHandler.handleError(error, context, {
          showToast: true,
          attemptRecovery: false
        });
      }
      throw error;
    }
  }
}

/**
 * Network operation with connectivity checking and smart retry
 */
export async function withNetworkRecovery<T>(
  networkOperation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    showUserFeedback = true,
    onProgress,
    onRecovery
  } = options;

  return retryWithRecovery(
    async () => {
      // Check network connectivity before attempting operation
      if (!navigator.onLine) {
        throw new Error('No internet connection detected');
      }

      return await networkOperation();
    },
    {
      ...context,
      component: context.component || 'network',
    },
    {
      maxRetries,
      baseDelay,
      exponentialBackoff: true,
      jitter: true,
      onRetry: (attempt, delay) => {
        onProgress?.(attempt, maxRetries);
        
        if (showUserFeedback) {
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showInfo(
            'Connection Issue',
            `Retrying connection... (${attempt}/${maxRetries})`,
            { duration: Math.min(delay, 5000) }
          );
        }
      },
      onSuccess: () => {
        onRecovery?.('network-retry-success');
      },
      onFailure: (error, attempt) => {
        if (attempt === maxRetries) {
          if (showUserFeedback) {
            errorHandler.handleError(error, context, {
              showToast: true,
              attemptRecovery: false
            });
          }
        }
      }
    }
  );
}

/**
 * Critical operation with comprehensive recovery and user guidance
 */
export async function withCriticalOperationRecovery<T>(
  criticalOperation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions & {
    fallbackOperation?: () => Promise<T>;
    criticalityLevel?: 'high' | 'critical';
  } = {}
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelay = 5000,
    showUserFeedback = true,
    onProgress,
    onRecovery,
    fallbackOperation,
    criticalityLevel = 'high'
  } = options;

  try {
    return await retryWithRecovery(
      criticalOperation,
      {
        ...context,
        component: context.component || 'critical-operation',
        metadata: {
          ...context.metadata,
          criticalityLevel
        }
      },
      {
        maxRetries,
        baseDelay,
        exponentialBackoff: true,
        onRetry: (attempt, delay) => {
          onProgress?.(attempt, maxRetries);
          
          if (showUserFeedback) {
            const { errorNotificationManager } = require('./errorNotification');
            errorNotificationManager.showWarning(
              'Critical Operation Retry',
              `Retrying important operation... (${attempt}/${maxRetries})`,
              { duration: delay }
            );
          }
        },
        onSuccess: () => {
          onRecovery?.('critical-operation-success');
        }
      }
    );
  } catch (error) {
    // If critical operation fails and we have a fallback
    if (fallbackOperation) {
      try {
        if (showUserFeedback) {
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showInfo(
            'Using Fallback',
            'Primary operation failed, using alternative approach...'
          );
        }

        const result = await fallbackOperation();
        onRecovery?.('critical-operation-fallback');
        
        if (showUserFeedback) {
          const { errorNotificationManager } = require('./errorNotification');
          errorNotificationManager.showSuccess(
            'Operation Completed',
            'Operation completed using fallback method'
          );
        }

        return result;
      } catch (fallbackError) {
        // Both primary and fallback failed
        errorHandler.handleError(fallbackError, {
          ...context,
          operation: 'fallback-operation'
        }, {
          showToast: showUserFeedback,
          reportError: true,
          logError: true
        });
        throw fallbackError;
      }
    } else {
      // No fallback available
      errorHandler.handleError(error, context, {
        showToast: showUserFeedback,
        reportError: true,
        logError: true
      });
      throw error;
    }
  }
}

/**
 * Batch operation with partial failure recovery
 */
export async function withBatchRecovery<T, R>(
  items: T[],
  batchOperation: (item: T) => Promise<R>,
  context: ErrorContext,
  options: RecoveryFlowOptions & {
    continueOnFailure?: boolean;
    failureThreshold?: number; // Percentage of failures to tolerate
  } = {}
): Promise<{
  successful: Array<{ item: T; result: R }>;
  failed: Array<{ item: T; error: Error }>;
  totalProcessed: number;
}> {
  const {
    continueOnFailure = true,
    failureThreshold = 50, // 50% failure threshold
    showUserFeedback = true,
    onProgress
  } = options;

  const successful: Array<{ item: T; result: R }> = [];
  const failed: Array<{ item: T; error: Error }> = [];
  let processed = 0;

  for (const item of items) {
    try {
      const result = await withNetworkRecovery(
        () => batchOperation(item),
        {
          ...context,
          metadata: {
            ...context.metadata,
            batchItem: item,
            batchProgress: `${processed + 1}/${items.length}`
          }
        },
        {
          maxRetries: 2,
          showUserFeedback: false // Handle feedback at batch level
        }
      );

      successful.push({ item, result });
    } catch (error) {
      failed.push({ item, error: error instanceof Error ? error : new Error(String(error)) });
      
      const failureRate = (failed.length / (processed + 1)) * 100;
      
      if (!continueOnFailure || failureRate > failureThreshold) {
        if (showUserFeedback) {
          errorHandler.handleError(
            new Error(`Batch operation failed: ${failureRate.toFixed(1)}% failure rate exceeded threshold`),
            context,
            { showToast: true }
          );
        }
        break;
      }
    }

    processed++;
    onProgress?.(processed, items.length);
  }

  if (showUserFeedback && failed.length > 0) {
    const { errorNotificationManager } = require('./errorNotification');
    errorNotificationManager.showWarning(
      'Batch Operation Completed',
      `${successful.length} succeeded, ${failed.length} failed out of ${processed} processed`
    );
  }

  return {
    successful,
    failed,
    totalProcessed: processed
  };
}

/**
 * Convenience function to wrap any async operation with appropriate recovery
 */
export async function withSmartRecovery<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: RecoveryFlowOptions & {
    operationType?: 'database' | 'upload' | 'auth' | 'network' | 'critical';
  } = {}
): Promise<T> {
  const { operationType = 'network', ...recoveryOptions } = options;

  switch (operationType) {
    case 'database':
      return withDatabaseRecovery(operation, context, recoveryOptions);
    case 'upload':
      return withUploadRecovery(operation, context, recoveryOptions);
    case 'auth':
      return withAuthRecovery(operation, context, recoveryOptions);
    case 'network':
      return withNetworkRecovery(operation, context, recoveryOptions);
    case 'critical':
      return withCriticalOperationRecovery(operation, context, recoveryOptions);
    default:
      return withNetworkRecovery(operation, context, recoveryOptions);
  }
}