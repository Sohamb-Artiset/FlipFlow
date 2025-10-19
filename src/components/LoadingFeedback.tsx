import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Download, RefreshCw, Database, FileText, Eye, Cog, CheckCircle, Clock, Zap, X, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
 * Enhanced loading component for flipbook operations with engaging animations
 */
interface FlipbookLoadingProps {
  phase: 'fetching_metadata' | 'tracking_view' | 'downloading_pdf' | 'processing_pdf' | 'rendering' | 'complete';
  progress: number;
  message: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
  onCancel?: () => void;
  onExtendTimeout?: () => void;
  onTryAlternative?: () => void;
  showControls?: boolean;
  isSlowConnection?: boolean;
  className?: string;
}

export const FlipbookLoading: React.FC<FlipbookLoadingProps> = ({
  phase,
  progress,
  message,
  timeElapsed,
  estimatedTimeRemaining,
  onCancel,
  onExtendTimeout,
  onTryAlternative,
  showControls = false,
  isSlowConnection = false,
  className = '',
}) => {
  const [dots, setDots] = useState('');

  // Animated dots for loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getPhaseConfig = () => {
    switch (phase) {
      case 'fetching_metadata':
        return {
          icon: FileText,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          description: 'Loading flipbook information',
        };
      case 'tracking_view':
        return {
          icon: Eye,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          description: 'Recording your view',
        };
      case 'downloading_pdf':
        return {
          icon: Download,
          color: 'text-orange-500',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          description: 'Downloading PDF file',
        };
      case 'processing_pdf':
        return {
          icon: Cog,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          description: 'Processing PDF document',
        };
      case 'rendering':
        return {
          icon: Zap,
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-50',
          borderColor: 'border-indigo-200',
          description: 'Preparing flipbook viewer',
        };
      case 'complete':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          description: 'Ready to view!',
        };
    }
  };

  const { icon: Icon, color, bgColor, borderColor, description } = getPhaseConfig();

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card className={`${borderColor} border-2 loading-transition loading-fade-in ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with animated icon */}
          <div className="flex items-center space-x-3 loading-transition">
            <div className={`p-3 rounded-full ${bgColor} ${borderColor} border loading-transition`}>
              <Icon className={`w-6 h-6 ${color} loading-transition ${phase !== 'complete' ? 'loading-pulse-soft' : ''}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-lg loading-transition">{message}{phase !== 'complete' ? dots : ''}</h3>
                <Badge variant="secondary" className="text-xs loading-transition">
                  {Math.round(progress)}%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground loading-transition">{description}</p>
            </div>
          </div>

          {/* Enhanced progress bar with shimmer effect */}
          <div className="space-y-2">
            <div className="progress-shimmer">
              <Progress 
                value={progress} 
                className="h-3 bg-gray-100 loading-transition"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground loading-transition">
              <div className="flex items-center space-x-2">
                <Clock className="w-3 h-3" />
                <span>{formatTime(timeElapsed)} elapsed</span>
              </div>
              {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
                <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
              )}
            </div>
          </div>

          {/* Phase indicator with smooth transitions */}
          <div className="flex items-center justify-center">
            <div className="flex space-x-2">
              {['fetching_metadata', 'tracking_view', 'downloading_pdf', 'processing_pdf', 'rendering'].map((p, index) => (
                <div
                  key={p}
                  className={`w-2 h-2 rounded-full loading-transition ${
                    p === phase 
                      ? `${color.replace('text-', 'bg-')} loading-pulse-soft` 
                      : progress > (index + 1) * 20 
                        ? 'bg-green-400' 
                        : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* User Control Options */}
          {showControls && (timeElapsed > 10000 || isSlowConnection) && (
            <div className="pt-4 border-t border-gray-200 loading-slide-up">
              <div className="space-y-3">
                {isSlowConnection && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Slow connection detected. This may take longer than usual.</span>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {onCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCancel}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                  
                  {onExtendTimeout && timeElapsed > 15000 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onExtendTimeout}
                      className="text-xs"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Extend Timeout
                    </Button>
                  )}
                  
                  {onTryAlternative && (phase === 'downloading_pdf' || phase === 'processing_pdf') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onTryAlternative}
                      className="text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Try Alternative
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Having trouble? You can cancel this operation or try alternative loading methods.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Animated progress indicator with time estimates
 */
interface AnimatedProgressProps {
  progress: number;
  message: string;
  timeElapsed: number;
  estimatedTotal?: number;
  showPercentage?: boolean;
  className?: string;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  progress,
  message,
  timeElapsed,
  estimatedTotal,
  showPercentage = true,
  className = '',
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const estimatedRemaining = estimatedTotal ? Math.max(0, estimatedTotal - timeElapsed) : null;

  return (
    <div className={`space-y-3 loading-transition ${className}`}>
      <div className="flex items-center justify-between loading-transition">
        <span className="text-sm font-medium">{message}</span>
        {showPercentage && (
          <span className="text-sm text-muted-foreground loading-transition">
            {Math.round(displayProgress)}%
          </span>
        )}
      </div>
      
      <div className="relative progress-shimmer">
        <Progress 
          value={displayProgress} 
          className="h-2 loading-transition"
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground loading-transition">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{formatTime(timeElapsed)}</span>
        </div>
        {estimatedRemaining && (
          <span>~{formatTime(estimatedRemaining)} left</span>
        )}
      </div>
    </div>
  );
};

/**
 * Loading state with informative messages that explain what's happening
 */
interface InformativeLoadingProps {
  operation: string;
  details: string[];
  currentStep?: number;
  className?: string;
}

export const InformativeLoading: React.FC<InformativeLoadingProps> = ({
  operation,
  details,
  currentStep = 0,
  className = '',
}) => {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <h3 className="font-semibold">{operation}</h3>
          </div>
          
          <div className="space-y-2">
            {details.map((detail, index) => (
              <div
                key={index}
                className={`flex items-center space-x-2 text-sm transition-all duration-300 ${
                  index === currentStep
                    ? 'text-primary font-medium'
                    : index < currentStep
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : index === currentStep ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Cancellable operation loading with user controls
 */
interface CancellableLoadingProps {
  operation: string;
  progress: number;
  timeElapsed: number;
  onCancel: () => void;
  onExtendTimeout?: () => void;
  onTryAlternative?: () => void;
  showAlternativeAfter?: number; // milliseconds
  className?: string;
}

export const CancellableLoading: React.FC<CancellableLoadingProps> = ({
  operation,
  progress,
  timeElapsed,
  onCancel,
  onExtendTimeout,
  onTryAlternative,
  showAlternativeAfter = 20000, // 20 seconds
  className = '',
}) => {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const showAlternative = timeElapsed > showAlternativeAfter && onTryAlternative;
  const showExtend = timeElapsed > 15000 && onExtendTimeout;

  return (
    <Card className={`border-orange-200 border-2 bg-orange-50 ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
              <span className="font-medium text-orange-800">{operation}</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {Math.round(progress)}%
            </Badge>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-orange-700">
              <span>{formatTime(timeElapsed)} elapsed</span>
              {timeElapsed > 10000 && (
                <span className="text-orange-600">Taking longer than expected...</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-orange-200">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            
            {showExtend && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExtendTimeout}
                className="text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                <Clock className="w-3 h-3 mr-1" />
                Wait Longer
              </Button>
            )}
            
            {showAlternative && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTryAlternative}
                className="text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Try Alternative
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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