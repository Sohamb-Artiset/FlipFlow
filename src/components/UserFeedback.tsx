import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Loader2, 
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  Server,
  Shield,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type FeedbackVariant = 'toast' | 'inline' | 'card' | 'banner';

interface UserFeedbackProps {
  type: FeedbackType;
  title: string;
  message: string;
  variant?: FeedbackVariant;
  showIcon?: boolean;
  dismissible?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  }>;
  progress?: number;
  className?: string;
  onDismiss?: () => void;
}

/**
 * Comprehensive user feedback component for various operation states
 */
export const UserFeedback: React.FC<UserFeedbackProps> = ({
  type,
  title,
  message,
  variant = 'inline',
  showIcon = true,
  dismissible = false,
  actions = [],
  progress,
  className = '',
  onDismiss,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getAlertVariant = () => {
    switch (type) {
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const renderActions = () => {
    if (actions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  };

  const renderProgress = () => {
    if (typeof progress !== 'number') return null;

    return (
      <div className="mt-3 space-y-2">
        <Progress value={progress} className="w-full" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% complete</span>
          <span>{progress < 100 ? 'Please wait...' : 'Complete!'}</span>
        </div>
      </div>
    );
  };

  if (variant === 'toast') {
    // Handle toast notifications
    switch (type) {
      case 'success':
        toast.success(title, { description: message });
        break;
      case 'error':
        toast.error(title, { description: message });
        break;
      case 'warning':
        toast.warning(title, { description: message });
        break;
      case 'info':
        toast.info(title, { description: message });
        break;
      case 'loading':
        toast.loading(title, { description: message });
        break;
    }
    return null;
  }

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            {showIcon && getIcon()}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{message}</p>
          {renderProgress()}
          {renderActions()}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`w-full p-4 border-l-4 ${
        type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
        type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
        type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
        type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' :
        'border-gray-500 bg-gray-50 dark:bg-gray-950'
      } ${className}`}>
        <div className="flex items-start space-x-3">
          {showIcon && getIcon()}
          <div className="flex-1">
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {renderProgress()}
            {renderActions()}
          </div>
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Default inline variant
  return (
    <Alert variant={getAlertVariant()} className={className}>
      {showIcon && getIcon()}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{message}</p>
          {renderProgress()}
          {renderActions()}
        </div>
      </AlertDescription>
    </Alert>
  );
};

/**
 * Predefined feedback components for common scenarios
 */
export const NetworkErrorFeedback: React.FC<{
  onRetry?: () => void;
  variant?: FeedbackVariant;
  className?: string;
}> = ({ onRetry, variant = 'inline', className }) => (
  <UserFeedback
    type="error"
    title="Connection Problem"
    message="Unable to connect to our servers. Please check your internet connection."
    variant={variant}
    className={className}
    actions={onRetry ? [{ label: 'Try Again', onClick: onRetry }] : []}
  />
);

export const LoadingFeedback: React.FC<{
  title?: string;
  message?: string;
  progress?: number;
  variant?: FeedbackVariant;
  className?: string;
}> = ({ 
  title = 'Loading...', 
  message = 'Please wait while we process your request.',
  progress,
  variant = 'inline',
  className 
}) => (
  <UserFeedback
    type="loading"
    title={title}
    message={message}
    progress={progress}
    variant={variant}
    className={className}
  />
);

export const SuccessFeedback: React.FC<{
  title?: string;
  message?: string;
  variant?: FeedbackVariant;
  className?: string;
  onDismiss?: () => void;
}> = ({ 
  title = 'Success!', 
  message = 'Operation completed successfully.',
  variant = 'inline',
  className,
  onDismiss
}) => (
  <UserFeedback
    type="success"
    title={title}
    message={message}
    variant={variant}
    className={className}
    dismissible={!!onDismiss}
    onDismiss={onDismiss}
  />
);

export const ErrorFeedback: React.FC<{
  title?: string;
  message?: string;
  error?: Error;
  onRetry?: () => void;
  onReport?: () => void;
  variant?: FeedbackVariant;
  className?: string;
}> = ({ 
  title = 'Something went wrong', 
  message,
  error,
  onRetry,
  onReport,
  variant = 'inline',
  className 
}) => {
  const errorMessage = message || error?.message || 'An unexpected error occurred.';
  const actions = [];
  
  if (onRetry) {
    actions.push({ label: 'Try Again', onClick: onRetry });
  }
  
  if (onReport) {
    actions.push({ 
      label: 'Report Issue', 
      onClick: onReport, 
      variant: 'ghost' as const 
    });
  }

  return (
    <UserFeedback
      type="error"
      title={title}
      message={errorMessage}
      variant={variant}
      className={className}
      actions={actions}
    />
  );
};

/**
 * Hook for managing user feedback state
 */
export const useUserFeedback = () => {
  const showSuccess = (title: string, message: string, options?: { 
    variant?: FeedbackVariant;
    actions?: Array<{ label: string; onClick: () => void }>;
  }) => {
    if (options?.variant === 'toast') {
      toast.success(title, { description: message });
    }
    // For other variants, return the component props
    return { type: 'success' as const, title, message, ...options };
  };

  const showError = (title: string, message: string, options?: {
    variant?: FeedbackVariant;
    error?: Error;
    onRetry?: () => void;
    onReport?: () => void;
  }) => {
    const errorMessage = message || options?.error?.message || 'An unexpected error occurred.';
    
    if (options?.variant === 'toast') {
      toast.error(title, { 
        description: errorMessage,
        action: options.onRetry ? {
          label: 'Retry',
          onClick: options.onRetry,
        } : undefined,
      });
    }
    
    return { type: 'error' as const, title, message: errorMessage, ...options };
  };

  const showWarning = (title: string, message: string, options?: {
    variant?: FeedbackVariant;
    actions?: Array<{ label: string; onClick: () => void }>;
  }) => {
    if (options?.variant === 'toast') {
      toast.warning(title, { description: message });
    }
    
    return { type: 'warning' as const, title, message, ...options };
  };

  const showInfo = (title: string, message: string, options?: {
    variant?: FeedbackVariant;
    actions?: Array<{ label: string; onClick: () => void }>;
  }) => {
    if (options?.variant === 'toast') {
      toast.info(title, { description: message });
    }
    
    return { type: 'info' as const, title, message, ...options };
  };

  const showLoading = (title: string, message: string, options?: {
    variant?: FeedbackVariant;
    progress?: number;
  }) => {
    if (options?.variant === 'toast') {
      toast.loading(title, { description: message });
    }
    
    return { type: 'loading' as const, title, message, ...options };
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
  };
};