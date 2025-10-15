import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface RetryMechanismProps {
  onRetry: () => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  title?: string;
  description?: string;
  variant?: 'inline' | 'card' | 'alert';
  showProgress?: boolean;
  className?: string;
}

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError: Error | null;
  retryHistory: Array<{
    attempt: number;
    timestamp: Date;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Comprehensive retry mechanism component with exponential backoff and progress tracking
 */
export const RetryMechanism: React.FC<RetryMechanismProps> = ({
  onRetry,
  maxRetries = 3,
  retryDelay = 1000,
  exponentialBackoff = true,
  title = "Operation Failed",
  description = "The operation failed. You can try again.",
  variant = 'inline',
  showProgress = true,
  className = '',
}) => {
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    retryHistory: [],
  });

  const calculateDelay = useCallback((attempt: number): number => {
    if (!exponentialBackoff) return retryDelay;
    
    // Exponential backoff with jitter
    const baseDelay = retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
  }, [retryDelay, exponentialBackoff]);

  const handleRetry = useCallback(async () => {
    if (state.isRetrying || state.retryCount >= maxRetries) {
      return;
    }

    const attemptNumber = state.retryCount + 1;
    const delay = calculateDelay(state.retryCount);

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: attemptNumber,
    }));

    try {
      // Show retry notification
      toast.info(`Retrying... (${attemptNumber}/${maxRetries})`, {
        description: `Waiting ${Math.round(delay / 1000)}s before retry`,
      });

      // Wait for calculated delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Attempt the operation
      await onRetry();

      // Success - reset state and show success message
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: null,
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: attemptNumber,
            timestamp: new Date(),
            success: true,
          }
        ],
      }));

      toast.success('Operation Successful', {
        description: `Succeeded on attempt ${attemptNumber}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: error instanceof Error ? error : new Error(errorMessage),
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: attemptNumber,
            timestamp: new Date(),
            success: false,
            error: errorMessage,
          }
        ],
      }));

      // Show error notification
      if (attemptNumber >= maxRetries) {
        toast.error('All Retries Failed', {
          description: `Failed after ${maxRetries} attempts. Please try again later.`,
        });
      } else {
        toast.error(`Attempt ${attemptNumber} Failed`, {
          description: `${maxRetries - attemptNumber} attempts remaining`,
        });
      }
    }
  }, [state.isRetrying, state.retryCount, maxRetries, onRetry, calculateDelay]);

  const resetRetries = useCallback(() => {
    setState({
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      retryHistory: [],
    });
  }, []);

  const canRetry = state.retryCount < maxRetries && !state.isRetrying;
  const hasExhaustedRetries = state.retryCount >= maxRetries;

  const renderRetryButton = () => (
    <Button
      onClick={handleRetry}
      disabled={!canRetry}
      variant={hasExhaustedRetries ? "destructive" : "outline"}
      size="sm"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${state.isRetrying ? 'animate-spin' : ''}`} />
      {state.isRetrying 
        ? `Retrying... (${state.retryCount}/${maxRetries})`
        : hasExhaustedRetries
        ? 'All Retries Failed'
        : `Retry (${maxRetries - state.retryCount} left)`
      }
    </Button>
  );

  const renderResetButton = () => (
    <Button
      onClick={resetRetries}
      variant="ghost"
      size="sm"
      className="ml-2"
    >
      Reset
    </Button>
  );

  const renderProgress = () => {
    if (!showProgress || state.retryHistory.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <div className="text-sm font-medium">Retry History:</div>
        <div className="space-y-1">
          {state.retryHistory.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2 text-xs">
              {entry.success ? (
                <CheckCircle className="w-3 h-3 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
              <span>
                Attempt {entry.attempt}: {entry.success ? 'Success' : 'Failed'}
              </span>
              <span className="text-muted-foreground">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              {entry.error && (
                <span className="text-red-500 truncate max-w-32" title={entry.error}>
                  {entry.error}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{description}</p>
          
          {state.lastError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Last Error</AlertTitle>
              <AlertDescription>{state.lastError.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center">
            {renderRetryButton()}
            {hasExhaustedRetries && renderResetButton()}
          </div>

          {renderProgress()}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'alert') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-3">
            <p>{description}</p>
            {state.lastError && (
              <p className="text-sm">Error: {state.lastError.message}</p>
            )}
            <div className="flex items-center">
              {renderRetryButton()}
              {hasExhaustedRetries && renderResetButton()}
            </div>
            {renderProgress()}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Default inline variant
  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg bg-destructive/10 border-destructive/20 ${className}`}>
      <div className="flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
          {state.lastError && (
            <div className="text-xs text-destructive mt-1">
              {state.lastError.message}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center">
        {renderRetryButton()}
        {hasExhaustedRetries && renderResetButton()}
      </div>
    </div>
  );
};

/**
 * Hook for managing retry logic in functional components
 */
export const useRetryMechanism = (
  operation: () => Promise<void>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
    onSuccess?: () => void;
    onFailure?: (error: Error) => void;
    onMaxRetriesReached?: () => void;
  } = {}
) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onSuccess,
    onFailure,
    onMaxRetriesReached,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    retryHistory: [],
  });

  const calculateDelay = useCallback((attempt: number): number => {
    if (!exponentialBackoff) return retryDelay;
    
    const baseDelay = retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 30000);
  }, [retryDelay, exponentialBackoff]);

  const retry = useCallback(async () => {
    if (state.isRetrying || state.retryCount >= maxRetries) {
      return;
    }

    const attemptNumber = state.retryCount + 1;
    const delay = calculateDelay(state.retryCount);

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: attemptNumber,
    }));

    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      await operation();

      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: null,
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: attemptNumber,
            timestamp: new Date(),
            success: true,
          }
        ],
      }));

      onSuccess?.();

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: err,
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: attemptNumber,
            timestamp: new Date(),
            success: false,
            error: err.message,
          }
        ],
      }));

      onFailure?.(err);

      if (attemptNumber >= maxRetries) {
        onMaxRetriesReached?.();
      }
    }
  }, [state.isRetrying, state.retryCount, maxRetries, operation, calculateDelay, onSuccess, onFailure, onMaxRetriesReached]);

  const reset = useCallback(() => {
    setState({
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      retryHistory: [],
    });
  }, []);

  return {
    ...state,
    retry,
    reset,
    canRetry: state.retryCount < maxRetries && !state.isRetrying,
    hasExhaustedRetries: state.retryCount >= maxRetries,
  };
};