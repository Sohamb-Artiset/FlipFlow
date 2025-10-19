/**
 * Flipbook-specific error recovery and retry mechanisms
 * Implements retry logic with exponential backoff for flipbook loading operations
 */

import { toast } from 'sonner';
import { errorNotificationManager } from './errorNotification';
import { flipbookLogger, logFlipbookError, logFlipbookOperation } from './flipbookLogger';

export interface FlipbookError {
  type: 'network' | 'pdf_processing' | 'authentication' | 'not_found' | 'timeout' | 'cors' | 'validation' | 'server';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  retryDelay: number;
  maxRetries: number;
  context: {
    flipbookId?: string;
    userId?: string;
    pdfUrl?: string;
    operation?: string;
    timestamp: string;
  };
  debugInfo?: any;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: FlipbookError;
  attempts: number;
  totalTime: number;
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateFlipbookRetryDelay(
  attempt: number,
  baseDelay: number,
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
 * Classify flipbook-specific errors
 */
export function classifyFlipbookError(error: Error | unknown, context: any = {}): FlipbookError {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const timestamp = new Date().toISOString();
  
  // Network errors - retry with 1s, 2s, 4s delays
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('failed to fetch')) {
    return {
      type: 'network',
      severity: 'medium',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Connection problem. Please check your internet connection.',
      recoverable: true,
      retryable: true,
      retryDelay: 1000,
      maxRetries: 3,
      context: { ...context, timestamp },
      debugInfo: { userAgent: navigator.userAgent, online: navigator.onLine }
    };
  }

  // PDF processing errors - retry with 2s, 5s delays
  if (errorMessage.includes('pdf') || 
      errorMessage.includes('document') || 
      errorMessage.includes('canvas') ||
      errorMessage.includes('worker') ||
      errorMessage.includes('render')) {
    return {
      type: 'pdf_processing',
      severity: 'high',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'PDF processing failed. The document may be corrupted or too large.',
      recoverable: true,
      retryable: true,
      retryDelay: 2000,
      maxRetries: 2,
      context: { ...context, timestamp },
      debugInfo: { pdfWorkerSrc: (window as any).pdfjsLib?.GlobalWorkerOptions?.workerSrc }
    };
  }

  // CORS errors - try proxy fallback
  if (errorMessage.includes('cors') || 
      errorMessage.includes('cross-origin') ||
      errorMessage.includes('blocked by cors')) {
    return {
      type: 'cors',
      severity: 'high',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Unable to access the PDF file due to security restrictions.',
      recoverable: true,
      retryable: true,
      retryDelay: 1000,
      maxRetries: 1,
      context: { ...context, timestamp },
      debugInfo: { origin: window.location.origin }
    };
  }

  // Authentication errors - no retry, redirect to login
  if (errorMessage.includes('auth') || 
      errorMessage.includes('unauthorized') || 
      errorMessage.includes('token') ||
      errorMessage.includes('session')) {
    return {
      type: 'authentication',
      severity: 'high',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Authentication failed. Please sign in again.',
      recoverable: true,
      retryable: false,
      retryDelay: 0,
      maxRetries: 0,
      context: { ...context, timestamp }
    };
  }

  // Timeout errors - retry with extended timeout
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('aborted') ||
      errorMessage.includes('timed out')) {
    return {
      type: 'timeout',
      severity: 'medium',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Request timed out. This may be due to a slow connection or large file.',
      recoverable: true,
      retryable: true,
      retryDelay: 3000,
      maxRetries: 2,
      context: { ...context, timestamp }
    };
  }

  // Not found errors - no retry
  if (errorMessage.includes('not found') || 
      errorMessage.includes('404') ||
      errorMessage.includes('does not exist')) {
    return {
      type: 'not_found',
      severity: 'medium',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'The requested flipbook or file could not be found.',
      recoverable: false,
      retryable: false,
      retryDelay: 0,
      maxRetries: 0,
      context: { ...context, timestamp }
    };
  }

  // Server errors - retry with longer delays
  if (errorMessage.includes('server') || 
      errorMessage.includes('database') || 
      errorMessage.includes('supabase') ||
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503')) {
    return {
      type: 'server',
      severity: 'high',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Server error occurred. Please try again in a moment.',
      recoverable: true,
      retryable: true,
      retryDelay: 5000,
      maxRetries: 2,
      context: { ...context, timestamp }
    };
  }

  // Validation errors - no retry
  if (errorMessage.includes('validation') || 
      errorMessage.includes('invalid') || 
      errorMessage.includes('required')) {
    return {
      type: 'validation',
      severity: 'low',
      message: error instanceof Error ? error.message : String(error),
      userMessage: 'Invalid data provided. Please check your input.',
      recoverable: false,
      retryable: false,
      retryDelay: 0,
      maxRetries: 0,
      context: { ...context, timestamp }
    };
  }

  // Default unknown error
  return {
    type: 'network',
    severity: 'medium',
    message: error instanceof Error ? error.message : String(error),
    userMessage: 'An unexpected error occurred. Please try again.',
    recoverable: true,
    retryable: true,
    retryDelay: 2000,
    maxRetries: 1,
    context: { ...context, timestamp }
  };
}

/**
 * Retry an operation with exponential backoff for flipbook operations
 */
export async function retryFlipbookOperation<T>(
  operation: () => Promise<T>,
  context: { flipbookId?: string; operation?: string; [key: string]: any } = {},
  customConfig?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;
  let lastError: FlipbookError | null = null;

  // Default retry configuration
  const config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
    ...customConfig
  };

  logFlipbookOperation(
    `Starting retry operation: ${context.operation || 'unknown'}`,
    context.flipbookId || 'unknown',
    'initialization',
    { maxRetries: config.maxRetries, baseDelay: config.baseDelay }
  );

  for (attempts = 1; attempts <= config.maxRetries + 1; attempts++) {
    try {
      const result = await operation();
      
      const totalTime = Date.now() - startTime;
      
      logFlipbookOperation(
        `Operation succeeded on attempt ${attempts}`,
        context.flipbookId || 'unknown',
        'complete',
        { attempts, totalTime, success: true }
      );

      return {
        success: true,
        data: result,
        attempts,
        totalTime
      };
    } catch (error) {
      const classifiedError = classifyFlipbookError(error, context);
      lastError = classifiedError;
      
      logFlipbookError(
        error as Error,
        context.flipbookId || 'unknown',
        'error',
        context.operation || 'retryOperation',
        { 
          attempt: attempts, 
          maxRetries: config.maxRetries,
          errorType: classifiedError.type,
          retryable: classifiedError.retryable
        }
      );

      // If this is the last attempt or error is not retryable, fail
      if (attempts > config.maxRetries || !classifiedError.retryable) {
        const totalTime = Date.now() - startTime;
        
        logFlipbookOperation(
          `Operation failed after ${attempts} attempts`,
          context.flipbookId || 'unknown',
          'error',
          { attempts, totalTime, success: false, finalError: classifiedError.type }
        );

        return {
          success: false,
          error: classifiedError,
          attempts,
          totalTime
        };
      }

      // Calculate delay for next retry
      const delay = calculateFlipbookRetryDelay(
        attempts,
        classifiedError.retryDelay || config.baseDelay,
        config.maxDelay,
        config.exponentialBackoff,
        config.jitter
      );

      logFlipbookOperation(
        `Retrying in ${delay}ms (attempt ${attempts}/${config.maxRetries})`,
        context.flipbookId || 'unknown',
        'error',
        { attempt: attempts, delay, errorType: classifiedError.type }
      );

      // Show retry notification to user
      toast.info(`Retrying... (${attempts}/${config.maxRetries})`, {
        description: `Waiting ${Math.round(delay / 1000)}s before retry`,
        duration: delay
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but just in case
  const totalTime = Date.now() - startTime;
  return {
    success: false,
    error: lastError || classifyFlipbookError(new Error('Unknown error'), context),
    attempts,
    totalTime
  };
}

/**
 * Manual retry function for user-initiated retries
 */
export async function manualRetryFlipbookOperation<T>(
  operation: () => Promise<T>,
  context: { flipbookId?: string; operation?: string; [key: string]: any } = {}
): Promise<T> {
  logFlipbookOperation(
    `Manual retry initiated: ${context.operation || 'unknown'}`,
    context.flipbookId || 'unknown',
    'error',
    context
  );

  try {
    const result = await operation();
    
    logFlipbookOperation(
      `Manual retry succeeded: ${context.operation || 'unknown'}`,
      context.flipbookId || 'unknown',
      'complete',
      { success: true }
    );

    toast.success('Retry Successful', {
      description: 'The operation completed successfully.'
    });

    return result;
  } catch (error) {
    const classifiedError = classifyFlipbookError(error, context);
    
    logFlipbookError(
      error as Error,
      context.flipbookId || 'unknown',
      'error',
      'manualRetry',
      { errorType: classifiedError.type }
    );

    toast.error('Retry Failed', {
      description: classifiedError.userMessage
    });

    throw error;
  }
}