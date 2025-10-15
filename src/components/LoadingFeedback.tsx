import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Upload, Download, RefreshCw, Database } from 'lucide-react';

interface LoadingFeedbackProps {
  type?: 'spinner' | 'skeleton' | 'progress' | 'card';
  message?: string;
  progress?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Comprehensive loading feedback component with various display options
 */
export const LoadingFeedback: React.FC<LoadingFeedbackProps> = ({
  type = 'spinner',
  message = 'Loading...',
  progress,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (type === 'progress' && typeof progress === 'number') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-sm">
          <span>{message}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>
    );
  }

  if (type === 'skeleton') {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (type === 'card') {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className={`${sizeClasses[size]} animate-spin mx-auto text-primary`} />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default spinner type
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

/**
 * Specialized loading states for different operations
 */
interface OperationLoadingProps {
  operation: 'upload' | 'download' | 'refresh' | 'database' | 'auth';
  message?: string;
  progress?: number;
  className?: string;
}

export const OperationLoading: React.FC<OperationLoadingProps> = ({
  operation,
  message,
  progress,
  className = '',
}) => {
  const getOperationConfig = () => {
    switch (operation) {
      case 'upload':
        return {
          icon: Upload,
          defaultMessage: 'Uploading file...',
          color: 'text-blue-500',
        };
      case 'download':
        return {
          icon: Download,
          defaultMessage: 'Downloading...',
          color: 'text-green-500',
        };
      case 'refresh':
        return {
          icon: RefreshCw,
          defaultMessage: 'Refreshing data...',
          color: 'text-primary',
        };
      case 'database':
        return {
          icon: Database,
          defaultMessage: 'Saving changes...',
          color: 'text-purple-500',
        };
      case 'auth':
        return {
          icon: Loader2,
          defaultMessage: 'Authenticating...',
          color: 'text-primary',
        };
      default:
        return {
          icon: Loader2,
          defaultMessage: 'Processing...',
          color: 'text-primary',
        };
    }
  };

  const { icon: Icon, defaultMessage, color } = getOperationConfig();
  const displayMessage = message || defaultMessage;

  if (typeof progress === 'number') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 animate-spin ${color}`} />
          <span className="text-sm font-medium">{displayMessage}</span>
        </div>
        <div className="space-y-1">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}% complete</span>
            <span>{progress < 100 ? 'Please wait...' : 'Almost done!'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Icon className={`w-5 h-5 animate-spin ${color}`} />
      <span className="text-sm font-medium">{displayMessage}</span>
    </div>
  );
};

/**
 * Loading overlay for full-screen or container loading states
 */
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  backdrop?: boolean;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
  backdrop = true,
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <div className={`
      absolute inset-0 z-50 flex items-center justify-center
      ${backdrop ? 'bg-background/80 backdrop-blur-sm' : ''}
      ${className}
    `}>
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <div className="space-y-2">
              <p className="font-medium">{message}</p>
              {typeof progress === 'number' && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {Math.round(progress)}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Inline loading state for buttons and small components
 */
interface InlineLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  isLoading,
  children,
  loadingText,
  size = 'sm',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className={`${iconSize} animate-spin`} />
        {loadingText && <span>{loadingText}</span>}
      </div>
    );
  }

  return <>{children}</>;
};