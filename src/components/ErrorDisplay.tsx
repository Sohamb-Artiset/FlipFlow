import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Server, 
  Clock, 
  Shield,
  HelpCircle 
} from 'lucide-react';

interface ErrorDisplayProps {
  error: Error | unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  title?: string;
  showDetails?: boolean;
  variant?: 'alert' | 'card' | 'inline';
  className?: string;
}

/**
 * Comprehensive error display component with user-friendly messages and retry functionality
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  isRetrying = false,
  title = "Something went wrong",
  showDetails = false,
  variant = 'alert',
  className = '',
}) => {
  const errorMessage = getErrorMessage(error);
  const errorType = getErrorType(error);
  const { icon: ErrorIcon, color } = getErrorIcon(errorType);

  const retryButton = onRetry && (
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      disabled={isRetrying}
      className="ml-4"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying...' : 'Try Again'}
    </Button>
  );

  if (variant === 'card') {
    return (
      <Card className={`${className}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ErrorIcon className={`w-8 h-8 ${color}`} />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <ErrorIcon className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          
          {onRetry && (
            <div className="flex justify-center">
              <Button
                onClick={onRetry}
                disabled={isRetrying}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </Button>
            </div>
          )}

          {showDetails && process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-2 bg-muted rounded text-xs">
              <summary className="cursor-pointer font-medium">
                Technical Details (Development)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between p-3 border rounded-lg bg-destructive/10 border-destructive/20 ${className}`}>
        <div className="flex items-center space-x-2">
          <ErrorIcon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
        {retryButton}
      </div>
    );
  }

  // Default alert variant
  return (
    <Alert variant="destructive" className={className}>
      <ErrorIcon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{errorMessage}</span>
        {retryButton}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Extract user-friendly error message from various error types
 */
function getErrorMessage(error: Error | unknown): string {
  if (!error) return 'An unknown error occurred';

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('fetch') || message.includes('network')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'Authentication failed. Please sign in again.';
    }
    
    // Database/Supabase errors
    if (message.includes('supabase') || message.includes('database') || message.includes('sql')) {
      return 'Database error occurred. Please try again in a moment.';
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('access denied')) {
      return 'You don\'t have permission to perform this action.';
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    // File/upload errors
    if (message.includes('file') || message.includes('upload')) {
      return 'File operation failed. Please check the file and try again.';
    }
    
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine error type for appropriate icon and styling
 */
function getErrorType(error: Error | unknown): 'network' | 'auth' | 'server' | 'timeout' | 'permission' | 'generic' {
  if (!error) return 'generic';

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return 'network';
  }
  
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
    return 'auth';
  }
  
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout';
  }
  
  if (message.includes('permission') || message.includes('access denied')) {
    return 'permission';
  }
  
  if (message.includes('server') || message.includes('database') || message.includes('supabase')) {
    return 'server';
  }

  return 'generic';
}

/**
 * Get appropriate icon and color for error type
 */
function getErrorIcon(errorType: string) {
  switch (errorType) {
    case 'network':
      return { icon: Wifi, color: 'text-orange-500' };
    case 'auth':
      return { icon: Shield, color: 'text-red-500' };
    case 'server':
      return { icon: Server, color: 'text-red-500' };
    case 'timeout':
      return { icon: Clock, color: 'text-yellow-500' };
    case 'permission':
      return { icon: Shield, color: 'text-red-500' };
    default:
      return { icon: AlertTriangle, color: 'text-destructive' };
  }
}

/**
 * Specialized error display for empty states with errors
 */
interface ErrorEmptyStateProps {
  error: Error | unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

export const ErrorEmptyState: React.FC<ErrorEmptyStateProps> = ({
  error,
  onRetry,
  isRetrying = false,
  title = "Unable to load data",
  description,
  className = '',
}) => {
  const errorMessage = getErrorMessage(error);
  const errorType = getErrorType(error);
  const { icon: ErrorIcon, color } = getErrorIcon(errorType);

  return (
    <Card className={`text-center py-12 ${className}`}>
      <CardContent>
        <ErrorIcon className={`w-12 h-12 mx-auto mb-4 ${color}`} />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">
          {description || errorMessage}
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};