/**
 * User-friendly error displays and recovery options for flipbook operations
 * Provides clear error messages and actionable recovery buttons
 */

import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Wifi, 
  RefreshCw, 
  Download, 
  ArrowLeft, 
  ExternalLink,
  Shield,
  FileX,
  Clock,
  Info,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { FlipbookError } from '@/lib/flipbookErrorRecovery';
import { manualRetryFlipbookOperation } from '@/lib/flipbookErrorRecovery';

export interface FlipbookErrorDisplayProps {
  error: FlipbookError;
  onRetry?: () => void | Promise<void>;
  onGoBack?: () => void;
  onDownloadOriginal?: () => void;
  isRetrying?: boolean;
  className?: string;
  variant?: 'alert' | 'card' | 'inline';
  showDetails?: boolean;
}

/**
 * Get appropriate icon for error type
 */
function getErrorIcon(errorType: FlipbookError['type']) {
  switch (errorType) {
    case 'network':
      return <Wifi className="w-5 h-5" />;
    case 'pdf_processing':
      return <FileX className="w-5 h-5" />;
    case 'authentication':
      return <Shield className="w-5 h-5" />;
    case 'timeout':
      return <Clock className="w-5 h-5" />;
    case 'cors':
      return <ExternalLink className="w-5 h-5" />;
    case 'not_found':
      return <FileX className="w-5 h-5" />;
    case 'server':
      return <AlertTriangle className="w-5 h-5" />;
    case 'validation':
      return <Info className="w-5 h-5" />;
    default:
      return <AlertTriangle className="w-5 h-5" />;
  }
}

/**
 * Get error severity color
 */
function getSeverityColor(severity: FlipbookError['severity']) {
  switch (severity) {
    case 'low':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get user-friendly error title
 */
function getErrorTitle(errorType: FlipbookError['type']) {
  switch (errorType) {
    case 'network':
      return 'Connection Problem';
    case 'pdf_processing':
      return 'PDF Processing Error';
    case 'authentication':
      return 'Authentication Required';
    case 'timeout':
      return 'Request Timed Out';
    case 'cors':
      return 'Access Restricted';
    case 'not_found':
      return 'File Not Found';
    case 'server':
      return 'Server Error';
    case 'validation':
      return 'Invalid Data';
    default:
      return 'Unexpected Error';
  }
}

/**
 * Recovery action buttons based on error type
 */
function RecoveryActions({ 
  error, 
  onRetry, 
  onGoBack, 
  onDownloadOriginal, 
  isRetrying 
}: {
  error: FlipbookError;
  onRetry?: () => void | Promise<void>;
  onGoBack?: () => void;
  onDownloadOriginal?: () => void;
  isRetrying?: boolean;
}) {
  const [isManualRetrying, setIsManualRetrying] = useState(false);

  const handleManualRetry = async () => {
    if (!onRetry) return;
    
    setIsManualRetrying(true);
    try {
      await manualRetryFlipbookOperation(
        async () => {
          await onRetry();
        },
        {
          flipbookId: error.context.flipbookId,
          operation: 'manual_retry_from_error_display'
        }
      );
    } catch (err) {
      // Error handling is done in manualRetryFlipbookOperation
    } finally {
      setIsManualRetrying(false);
    }
  };

  const handleDownload = () => {
    if (onDownloadOriginal) {
      onDownloadOriginal();
    } else if (error.context.pdfUrl) {
      window.open(error.context.pdfUrl, '_blank');
      toast.info('Download Started', {
        description: 'The original PDF file should start downloading.'
      });
    }
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      window.history.back();
    }
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent(`Error Report: ${error.type} - ${getErrorTitle(error.type)}`);
    const body = encodeURIComponent(`
Error Details:
- Type: ${error.type}
- Message: ${error.message}
- Flipbook ID: ${error.context.flipbookId || 'N/A'}
- Timestamp: ${error.context.timestamp}
- User Agent: ${navigator.userAgent}

Please describe what you were trying to do when this error occurred:
    `);
    
    window.open(`mailto:support@flipflow.com?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCheckStatus = () => {
    window.open('https://status.flipflow.com', '_blank');
  };

  const handleTestConnection = () => {
    window.open('https://www.google.com', '_blank');
    toast.info('Connection Test', {
      description: 'Opening Google to test your internet connection.'
    });
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {/* Primary action - Retry (if retryable) */}
      {error.retryable && onRetry && (
        <Button 
          onClick={handleManualRetry}
          disabled={isRetrying || isManualRetrying}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${(isRetrying || isManualRetrying) ? 'animate-spin' : ''}`} />
          {isRetrying || isManualRetrying ? 'Retrying...' : 'Try Again'}
        </Button>
      )}

      {/* Error-specific actions */}
      {error.type === 'network' && (
        <Button variant="outline" onClick={handleTestConnection}>
          <Wifi className="w-4 h-4 mr-2" />
          Test Connection
        </Button>
      )}

      {error.type === 'server' && (
        <Button variant="outline" onClick={handleCheckStatus}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Check Status
        </Button>
      )}

      {error.type === 'authentication' && (
        <Button variant="outline" onClick={() => window.location.href = '/auth'}>
          <Shield className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      )}

      {/* Download original PDF (if available) */}
      {error.context.pdfUrl && (
        <Button variant="outline" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download Original
        </Button>
      )}

      {/* Go back */}
      <Button variant="outline" onClick={handleGoBack}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Go Back
      </Button>

      {/* Contact support for critical errors */}
      {error.severity === 'critical' && (
        <Button variant="outline" onClick={handleContactSupport}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Contact Support
        </Button>
      )}
    </div>
  );
}

/**
 * Alert variant of error display
 */
function ErrorAlert({ error, onRetry, onGoBack, onDownloadOriginal, isRetrying, showDetails }: FlipbookErrorDisplayProps) {
  return (
    <Alert className={`${getSeverityColor(error.severity)} border-l-4`}>
      <div className="flex items-start gap-3">
        {getErrorIcon(error.type)}
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2">
            {getErrorTitle(error.type)}
            <Badge variant="outline" className="text-xs">
              {error.type}
            </Badge>
          </AlertTitle>
          <AlertDescription className="mt-2">
            {error.userMessage}
            {showDetails && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">Technical Details</summary>
                <div className="mt-2 text-xs font-mono bg-gray-100 p-2 rounded">
                  <div><strong>Error:</strong> {error.message}</div>
                  <div><strong>Type:</strong> {error.type}</div>
                  <div><strong>Severity:</strong> {error.severity}</div>
                  <div><strong>Timestamp:</strong> {error.context.timestamp}</div>
                  {error.context.flipbookId && (
                    <div><strong>Flipbook ID:</strong> {error.context.flipbookId}</div>
                  )}
                </div>
              </details>
            )}
          </AlertDescription>
          <RecoveryActions 
            error={error}
            onRetry={onRetry}
            onGoBack={onGoBack}
            onDownloadOriginal={onDownloadOriginal}
            isRetrying={isRetrying}
          />
        </div>
      </div>
    </Alert>
  );
}

/**
 * Card variant of error display
 */
function ErrorCard({ error, onRetry, onGoBack, onDownloadOriginal, isRetrying, showDetails }: FlipbookErrorDisplayProps) {
  return (
    <Card className={`${getSeverityColor(error.severity)} border-l-4`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {getErrorIcon(error.type)}
          <span>{getErrorTitle(error.type)}</span>
          <Badge variant="outline" className="ml-auto">
            {error.severity}
          </Badge>
        </CardTitle>
        <CardDescription>
          {error.userMessage}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showDetails && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Error Details</h4>
            <div className="text-xs space-y-1">
              <div><strong>Message:</strong> {error.message}</div>
              <div><strong>Type:</strong> {error.type}</div>
              <div><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</div>
              <div><strong>Time:</strong> {new Date(error.context.timestamp).toLocaleString()}</div>
            </div>
          </div>
        )}
        <RecoveryActions 
          error={error}
          onRetry={onRetry}
          onGoBack={onGoBack}
          onDownloadOriginal={onDownloadOriginal}
          isRetrying={isRetrying}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Inline variant of error display
 */
function ErrorInline({ error, onRetry, onGoBack, onDownloadOriginal, isRetrying }: FlipbookErrorDisplayProps) {
  return (
    <div className={`p-4 rounded-lg border ${getSeverityColor(error.severity)}`}>
      <div className="flex items-center gap-2 mb-2">
        {getErrorIcon(error.type)}
        <span className="font-medium">{getErrorTitle(error.type)}</span>
        <Badge variant="outline" className="text-xs">
          {error.type}
        </Badge>
      </div>
      <p className="text-sm mb-3">{error.userMessage}</p>
      <RecoveryActions 
        error={error}
        onRetry={onRetry}
        onGoBack={onGoBack}
        onDownloadOriginal={onDownloadOriginal}
        isRetrying={isRetrying}
      />
    </div>
  );
}

/**
 * Main FlipbookErrorDisplay component
 */
export function FlipbookErrorDisplay({
  error,
  onRetry,
  onGoBack,
  onDownloadOriginal,
  isRetrying = false,
  className = '',
  variant = 'alert',
  showDetails = false
}: FlipbookErrorDisplayProps) {
  const props = {
    error,
    onRetry,
    onGoBack,
    onDownloadOriginal,
    isRetrying,
    showDetails
  };

  const Component = (
    <div className={className}>
      {variant === 'alert' && <ErrorAlert {...props} />}
      {variant === 'card' && <ErrorCard {...props} />}
      {variant === 'inline' && <ErrorInline {...props} />}
    </div>
  );

  return Component;
}

/**
 * Success recovery display for when errors are resolved
 */
export function FlipbookRecoverySuccess({ 
  message = 'Problem resolved successfully!',
  onContinue,
  className = ''
}: {
  message?: string;
  onContinue?: () => void;
  className?: string;
}) {
  return (
    <Alert className={`${className} text-green-600 bg-green-50 border-green-200 border-l-4`}>
      <CheckCircle className="w-5 h-5" />
      <AlertTitle>Recovery Successful</AlertTitle>
      <AlertDescription>
        {message}
        {onContinue && (
          <Button 
            onClick={onContinue}
            className="mt-3"
            size="sm"
          >
            Continue
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default FlipbookErrorDisplay;