import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useErrorHandler } from '@/lib/errorHandling';
import { errorRecoveryManager } from '@/lib/errorRecovery';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Demo component showing error recovery patterns in action
 * This component is for development/testing purposes
 */
export const ErrorRecoveryDemo: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const { handleAsyncOperation, retryWithRecoveryPattern, classifyError } = useErrorHandler();

  const simulateNetworkError = async () => {
    throw new Error('Network connection failed');
  };

  const simulateAuthError = async () => {
    throw new Error('Authentication token expired');
  };

  const simulateServerError = async () => {
    throw new Error('Database server error occurred');
  };

  const simulateValidationError = async () => {
    throw new Error('Invalid input format provided');
  };

  const simulatePermissionError = async () => {
    throw new Error('Access denied - insufficient permissions');
  };

  const simulateSuccessAfterRetries = async () => {
    // Simulate an operation that fails twice then succeeds
    const attempts = (window as any).attemptCount || 0;
    (window as any).attemptCount = attempts + 1;
    
    if (attempts < 2) {
      throw new Error('Temporary server error');
    }
    
    (window as any).attemptCount = 0;
    return 'Operation succeeded after retries!';
  };

  const testErrorRecovery = async (errorType: string) => {
    setIsLoading(true);
    setLastResult(null);
    setLastError(null);

    try {
      let operation: () => Promise<string>;
      
      switch (errorType) {
        case 'network':
          operation = simulateNetworkError;
          break;
        case 'auth':
          operation = simulateAuthError;
          break;
        case 'server':
          operation = simulateServerError;
          break;
        case 'validation':
          operation = simulateValidationError;
          break;
        case 'permission':
          operation = simulatePermissionError;
          break;
        case 'success-after-retries':
          operation = simulateSuccessAfterRetries;
          break;
        default:
          operation = async () => 'Unknown test type';
      }

      const result = await retryWithRecoveryPattern(
        operation,
        {
          component: 'ErrorRecoveryDemo',
          operation: `test-${errorType}`,
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
        }
      );

      if (result) {
        setLastResult(result);
      }
    } catch (error) {
      const classification = classifyError(error);
      setLastError(`${classification.type}: ${classification.userMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecoveryPatterns = () => {
    return errorRecoveryManager.getPatterns();
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Error Recovery Demo
        </CardTitle>
        <CardDescription>
          Test error recovery patterns and user guidance (Development Only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Button
            onClick={() => testErrorRecovery('network')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Network Error
          </Button>
          
          <Button
            onClick={() => testErrorRecovery('auth')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Auth Error
          </Button>
          
          <Button
            onClick={() => testErrorRecovery('server')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Server Error
          </Button>
          
          <Button
            onClick={() => testErrorRecovery('validation')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Validation Error
          </Button>
          
          <Button
            onClick={() => testErrorRecovery('permission')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Permission Error
          </Button>
          
          <Button
            onClick={() => testErrorRecovery('success-after-retries')}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Success After Retries
          </Button>
        </div>

        {/* Results */}
        {lastResult && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Success:</strong> {lastResult}
            </AlertDescription>
          </Alert>
        )}

        {lastError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {lastError}
            </AlertDescription>
          </Alert>
        )}

        {/* Recovery Patterns Info */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Registered Recovery Patterns</h3>
          <div className="grid gap-3">
            {getRecoveryPatterns().map((pattern) => (
              <div key={pattern.name} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{pattern.name}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {pattern.userGuidance.actions.length} action(s)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {pattern.userGuidance.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {pattern.userGuidance.actions.map((action, index) => (
                    <Badge 
                      key={index} 
                      variant={action.primary ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {action.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};