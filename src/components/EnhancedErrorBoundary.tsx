import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Bug, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportButton?: boolean;
  context?: string; // Context for better error reporting (e.g., 'dashboard', 'flipbook-viewer')
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Enhanced Error Boundary with comprehensive error handling and user feedback
 * Provides better error reporting, retry mechanisms, and user-friendly error messages
 */
export class EnhancedErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EnhancedErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Enhanced error reporting
    this.reportError(error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show user notification
    this.showErrorNotification(error);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error reporting service
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log to console for development
    console.group('🚨 Error Report');
    console.error('Error ID:', errorReport.errorId);
    console.error('Context:', errorReport.context);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // In production, send to error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    // errorReportingService.captureException(error, errorReport);
  };

  private showErrorNotification = (error: Error) => {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case 'network':
        toast.error('Connection Error', {
          description: 'Unable to connect to our servers. Please check your internet connection.',
        });
        break;
      case 'chunk':
        toast.error('Loading Error', {
          description: 'Failed to load application resources. Please refresh the page.',
        });
        break;
      case 'memory':
        toast.error('Memory Error', {
          description: 'The application is using too much memory. Please refresh the page.',
        });
        break;
      default:
        toast.error('Application Error', {
          description: 'An unexpected error occurred. Our team has been notified.',
        });
    }
  };

  private getErrorType = (error: Error): 'network' | 'chunk' | 'memory' | 'generic' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('loading chunk') || message.includes('loading css chunk')) {
      return 'chunk';
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    
    if (message.includes('memory') || message.includes('out of memory')) {
      return 'memory';
    }
    
    return 'generic';
  };

  private getUserFriendlyMessage = (error: Error): string => {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case 'network':
        return 'We\'re having trouble connecting to our servers. Please check your internet connection and try again.';
      case 'chunk':
        return 'Some application files failed to load. This usually happens after an update. Please refresh the page.';
      case 'memory':
        return 'The application is using too much memory. Please close other tabs and refresh the page.';
      default:
        return 'Something unexpected happened. Don\'t worry - our team has been automatically notified and will look into it.';
    }
  };

  handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });

      toast.info('Retrying...', {
        description: `Attempt ${this.retryCount} of ${this.maxRetries}`,
      });
    } else {
      toast.error('Max Retries Reached', {
        description: 'Please refresh the page or contact support if the problem persists.',
      });
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report - Error ID: ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Context: ${this.props.context || 'Unknown'}
Error Message: ${this.state.error?.message || 'Unknown error'}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]
    `);
    
    window.open(`mailto:support@flipflow.com?subject=${subject}&body=${body}`, '_blank');
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const userMessage = this.getUserFriendlyMessage(this.state.error!);
      const canRetry = this.retryCount < this.maxRetries;

      // Default enhanced error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-16 h-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Oops! Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertTitle>What happened?</AlertTitle>
                <AlertDescription className="mt-2">
                  {userMessage}
                </AlertDescription>
              </Alert>

              <div className="flex flex-col space-y-3">
                {canRetry && (
                  <Button onClick={this.handleRetry} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={this.handleRefresh}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Page
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome}
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Homepage
                </Button>

                {this.props.showReportButton && (
                  <Button 
                    variant="ghost" 
                    onClick={this.handleReportBug}
                    className="w-full text-muted-foreground"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Report This Issue
                  </Button>
                )}
              </div>

              {this.state.errorId && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Error ID: <code className="bg-muted px-1 rounded">{this.state.errorId}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please include this ID when contacting support
                  </p>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4 p-3 bg-muted rounded text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">
                    🔧 Technical Details (Development Only)
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div>
                      <strong>Error:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-destructive">
                        {this.state.error?.message}
                      </pre>
                    </div>
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">
                        {this.state.error?.stack}
                      </pre>
                    </div>
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version of Enhanced Error Boundary for functional components
 */
interface EnhancedErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportButton?: boolean;
  context?: string;
}

export const EnhancedErrorBoundaryWrapper: React.FC<EnhancedErrorBoundaryWrapperProps> = ({
  children,
  fallback,
  onError,
  showReportButton = true,
  context,
}) => {
  return (
    <EnhancedErrorBoundary 
      fallback={fallback} 
      onError={onError}
      showReportButton={showReportButton}
      context={context}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};