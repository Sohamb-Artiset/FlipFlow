/**
 * Development debugging panel for flipbook loading operations
 * Provides UI controls for testing different scenarios and monitoring performance
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Activity, 
  Network, 
  AlertTriangle, 
  Clock, 
  Download, 
  Play, 
  Pause, 
  RotateCcw,
  Info,
  Bug,
  Zap,
  FileText,
  Monitor
} from 'lucide-react';
import { 
  flipbookDebugger,
  enableFlipbookDebugMode,
  disableFlipbookDebugMode,
  testLoadingScenario,
  logDebugInfo,
  exportDebugData,
  isDevelopment
} from '@/lib/debugUtils';
import { flipbookPerformanceMonitor } from '@/lib/flipbookPerformance';
import { flipbookLogger } from '@/lib/flipbookLogger';

interface FlipbookDebugPanelProps {
  flipbookId?: string;
  onClose?: () => void;
}

export const FlipbookDebugPanel: React.FC<FlipbookDebugPanelProps> = ({ 
  flipbookId, 
  onClose 
}) => {
  const [config, setConfig] = useState(flipbookDebugger.getConfig());
  const [performanceSummary, setPerformanceSummary] = useState(
    flipbookPerformanceMonitor.getPerformanceSummary()
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // Don't render in production
  if (!isDevelopment) {
    return null;
  }

  // Update performance data periodically when monitoring
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setPerformanceSummary(flipbookPerformanceMonitor.getPerformanceSummary());
      if (flipbookId) {
        setLogs(flipbookLogger.getLogsForFlipbook(flipbookId));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isMonitoring, flipbookId]);

  const updateConfig = (newConfig: Partial<typeof config>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    flipbookDebugger.updateConfig(newConfig);
  };

  const handleScenarioTest = (scenario: string) => {
    testLoadingScenario(scenario as any);
    setConfig(flipbookDebugger.getConfig());
  };

  const handleExportLogs = () => {
    exportDebugData();
  };

  const handleClearMetrics = () => {
    flipbookPerformanceMonitor.clearMetrics();
    flipbookLogger.clearLogs();
    setPerformanceSummary(flipbookPerformanceMonitor.getPerformanceSummary());
    setLogs([]);
  };

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
    if (!isMonitoring) {
      logDebugInfo();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto border-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bug className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-blue-800">Flipbook Debug Panel</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              Development Only
            </Badge>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
        <CardDescription className="text-blue-600">
          Debug tools for testing flipbook loading scenarios and monitoring performance
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Test Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Network className="w-4 h-4" />
                    <span>Network Scenarios</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('slow-network')}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Slow Network (5s delay)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('network-error')}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Network Errors (50%)
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>PDF Scenarios</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('large-pdf')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Large PDF (10s delay)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('pdf-error')}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    PDF Processing Error
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Timeout Scenarios</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('timeout')}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Timeout (5s)
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleScenarioTest('reset')}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Normal
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Test scenarios simulate different loading conditions to help debug issues. 
                Use "Reset to Normal" to disable all simulations.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Logging Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Detailed Logging</label>
                    <Switch
                      checked={config.enableDetailedLogging}
                      onCheckedChange={(checked) => 
                        updateConfig({ enableDetailedLogging: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">PDF Processing Steps</label>
                    <Switch
                      checked={config.logPDFProcessingSteps}
                      onCheckedChange={(checked) => 
                        updateConfig({ logPDFProcessingSteps: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Performance Profiling</label>
                    <Switch
                      checked={config.enablePerformanceProfiling}
                      onCheckedChange={(checked) => 
                        updateConfig({ enablePerformanceProfiling: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Simulation Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Network Delay: {config.networkDelayMs}ms
                    </label>
                    <Slider
                      value={[config.networkDelayMs]}
                      onValueChange={([value]) => 
                        updateConfig({ networkDelayMs: value })
                      }
                      max={10000}
                      min={100}
                      step={100}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Error Rate: {Math.round(config.errorRate * 100)}%
                    </label>
                    <Slider
                      value={[config.errorRate * 100]}
                      onValueChange={([value]) => 
                        updateConfig({ errorRate: value / 100 })
                      }
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  enableFlipbookDebugMode();
                  setConfig(flipbookDebugger.getConfig());
                }}
              >
                <Zap className="w-4 h-4 mr-2" />
                Enable Debug Mode
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  disableFlipbookDebugMode();
                  setConfig(flipbookDebugger.getConfig());
                }}
              >
                <Pause className="w-4 h-4 mr-2" />
                Disable Debug Mode
              </Button>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Performance Monitoring</h3>
              <div className="flex space-x-2">
                <Button 
                  variant={isMonitoring ? "default" : "outline"} 
                  size="sm"
                  onClick={toggleMonitoring}
                >
                  {isMonitoring ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Stop Monitoring
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Monitoring
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearMetrics}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear Metrics
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceSummary.totalOperations}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Average Load Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceSummary.averageLoadTime.toFixed(0)}ms
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceSummary.activeProgress}
                  </div>
                </CardContent>
              </Card>
            </div>

            {performanceSummary.loadingMetrics.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Loading Success Rates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {performanceSummary.loadingMetrics.map((metric) => (
                    <div key={metric.operation} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{metric.operation}</span>
                        <span>{metric.successRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={metric.successRate} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {metric.successfulLoads}/{metric.totalAttempts} successful
                        {metric.timeouts > 0 && ` • ${metric.timeouts} timeouts`}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {performanceSummary.failureAnalysis.mostCommonFailures.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Common Failure Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {performanceSummary.failureAnalysis.mostCommonFailures
                      .slice(0, 5)
                      .map((failure) => (
                        <div key={failure.reason} className="flex justify-between text-sm">
                          <span>{failure.reason}</span>
                          <Badge variant="secondary">
                            {failure.count} ({failure.percentage.toFixed(1)}%)
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Debug Logs</h3>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleExportLogs}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Logs
                </Button>
                <Button variant="outline" size="sm" onClick={logDebugInfo}>
                  <Info className="w-4 h-4 mr-2" />
                  Log System Info
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {logs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No logs available. Start monitoring to see real-time logs.
                    </div>
                  ) : (
                    logs.slice(-20).reverse().map((log, index) => (
                      <div 
                        key={index} 
                        className={`p-2 rounded text-xs font-mono border-l-2 ${
                          log.level === 'error' ? 'border-red-500 bg-red-50' :
                          log.level === 'warn' ? 'border-yellow-500 bg-yellow-50' :
                          log.level === 'info' ? 'border-blue-500 bg-blue-50' :
                          'border-gray-500 bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold">
                            [{log.level.toUpperCase()}] {log.message}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(log.context.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {log.context.phase && (
                          <div className="text-muted-foreground mt-1">
                            Phase: {log.context.phase}
                          </div>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">
                              Metadata
                            </summary>
                            <pre className="mt-1 text-xs">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FlipbookDebugPanel;