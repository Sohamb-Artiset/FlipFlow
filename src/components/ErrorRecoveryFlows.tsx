import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useErrorHandler } from '@/lib/errorHandling';
import { errorRecoveryManager } from '@/lib/errorRecovery';
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Wifi, 
  WifiOff, 
  Shield, 
  Server, 
  AlertCircle 
} from 'lucide-react';

/**
 * Comprehensive error recovery flows demonstration component
 * Shows how different error types are handled with user guidance
 */
export const ErrorRecoveryFlows: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const { 
    handleAsyncOperation, 
    retryWithRecoveryPattern, 
    classifyError,
    attemptRecovery 
  } = useErrorHandler();

  // Simulate different types of errors for demonstration
  const simulateNetworkError = async () => {
    throw new Error('Network request failed: Connection timeout');
  };

  const simulateAuthError = async () => {
    throw new Error('Authentication failed: Invalid token');
  };

  const simulateServerError = async () => {
    throw new Error('Server error: Database connection failed');
  };

  const simulateValidationError = async () => {
    throw new Error('Validation failed: Required field missing');
  };

  const simulatePermissionError = async () => {
    throw new Error('Permission denied: Access forbidden');
  };

  const simulateSuccessAfterRetries = async () => {
    // Simulate an operation that fails twice then succeeds
    const attempts = parseInt(localStorage.getItem('demo-attempts') || '0');
    localStorage.setItem('demo-attempts', (attempts + 1).toString());
    
    if (attempts < 2) {
      throw new Error('Network request failed: Temporary server error');
    }
    
    localStorage.removeItem('demo-attempts');
    return 'Operation completed successfully after recovery!';
  };

  const runErrorRecoveryDemo = async (
    errorType: string,
    operation: () => Promise<string>
  ) => {
    setIsLoading(true);
    setLastResult(null);
    setLastError(null);

    try {
      const result = await retryWithRecoveryPattern(
        operation,
        {
          component: 'ErrorRecoveryFlows',
          operation: `demo-${errorType}`,
          metadata: { errorType }
        },
        {
          maxRetries: 3,
          baseDelay: 1000
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

  const runManualRecoveryDemo = async (errorType: string, operation: () => Promise<string>) => {
    setIsLoading(true);
    setLastResult(null);
    setLastError(null);

    try {
      await operation();
    } catch (error) {
      // Demonstrate manual recovery attempt
      const recoveryResult = await attemptRecovery(error, {
        component: 'ErrorRecoveryFlows',
        operation: `manual-recovery-${errorType}`,
        metadata: { errorType }
      });

      if (recoveryResult.success && recoveryResult.shouldRetry) {
        try {
          const result = await operation();
          setLastResult(result);
        } catch (retryError) {
          const classification = classifyError(retryError);
          setLastError(`Recovery failed: ${classification.userMessage}`);
        }
      } else {
        const classification = classifyError(error);
        setLastError(`${classification.type}: ${classification.userMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const errorScenarios = [
    {
      type: 'network',
      title: 'Network Error Recovery',
      description: 'Demonstrates retry with exponential backoff for network failures',
      icon: <WifiOff className="h-4 w-4" />,
      operation: simulateNetworkError,
      color: 'bg-orange-100 text-orange-800'
    },
    {
      type: 'auth',
      title: 'Authentication Error Recovery',
      description: 'Shows auth error handling with redirect guidance',
      icon: <Shield className="h-4 w-4" />,
      operation: simulateAuthError,
      color: 'bg-red-100 text-red-800'
    },
    {
      type: 'server',
      title: 'Server Error Recovery',
      description: 'Handles server errors with status checking and retries',
      icon: <Server className="h-4 w-4" />,
      operation: simulateServerError,
      color: 'bg-purple-100 text-purple-800'
    },
    {
      type: 'validation',
      title: 'Validation Error Recovery',
      description: 'Provides user guidance for input validation errors',
      icon: <AlertCircle className="h-4 w-4" />,
      operation: simulateValidationError,
      color: 'bg-yellow-100 text-yellow-800'
    },
    {
      type: 'permission',
      title: 'Permission Error Recovery',
      description: 'Guides users through permission and plan upgrade flows',
      icon: <AlertTriangle className="h-4 w-4" />,
      operation: simulatePermissionError,
      color: 'bg-blue-100 text-blue-800'
    },
    {
      type: 'success-after-retry',
      title: 'Success After Retries',
      description: 'Demonstrates successful recovery after multiple attempts',
      icon: <CheckCircle className="h-4 w-4" />,
      operation: simulateSuccessAfterRetries,
      color: 'bg-green-100 text-green-800'
    }
  ];

  const recoveryPatterns = errorRecoveryManager.getPatterns();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Error Recovery Patterns Demo
          </CardTitle>
          <CardDescription>
            Comprehensive demonstration of error recovery flows with user guidance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {errorScenarios.map((scenario) => (
              <Card key={scenario.type} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className={scenario.color}>
                      {scenario.icon}
                      <span className="ml-1">{scenario.type}</span>
                    </Badge>
                  </div>
                  <CardTitle className="text-sm">{scenario.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {scenario.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => runErrorRecoveryDemo(scenario.type, scenario.operation)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Auto Recovery
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => runManualRecoveryDemo(scenario.type, scenario.operation)}
                      disabled={isLoading}
                    >
                      Manual Recovery
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {(lastResult || lastError) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last Operation Result</CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {lastResult}
                </AlertDescription>
              </Alert>
            )}
            {lastError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {lastError}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recovery Patterns Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registered Recovery Patterns</CardTitle>
          <CardDescription>
            Currently active error recovery patterns in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recoveryPatterns.map((pattern) => (
              <div key={pattern.name} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{pattern.name}</Badge>
                  <div className="flex items-center gap-1">
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
                <h4 className="font-medium text-sm">{pattern.userGuidance.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {pattern.userGuidance.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How Error Recovery Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">1</Badge>
              <div>
                <strong>Error Classification:</strong> Errors are automatically classified by type (network, auth, server, etc.) and severity.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">2</Badge>
              <div>
                <strong>Recovery Pattern Matching:</strong> The system finds the appropriate recovery pattern for the error type.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">3</Badge>
              <div>
                <strong>Automatic Recovery:</strong> Recovery strategies are applied (retry with backoff, auth refresh, etc.).
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">4</Badge>
              <div>
                <strong>User Guidance:</strong> If recovery fails, users get actionable guidance with clear next steps.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 mt-0.5">5</Badge>
              <div>
                <strong>Notification Management:</strong> Prevents duplicate error messages and provides progress feedback.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorRecoveryFlows;