/**
 * Hook for integrating flipbook debugging tools with loading operations
 * Provides simulation capabilities and performance monitoring integration
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  flipbookDebugger,
  shouldApplyNetworkSimulation,
  getNetworkSimulationDelay,
  shouldSimulateFlipbookError,
  getSimulatedTimeoutDelay,
  isFlipbookDetailedLoggingEnabled,
  shouldLogFlipbookPDFSteps,
  isDevelopment
} from '@/lib/debugUtils';
import { flipbookLogger } from '@/lib/flipbookLogger';
import { flipbookPerformanceMonitor } from '@/lib/flipbookPerformance';

export interface FlipbookDebugState {
  isDebugMode: boolean;
  shouldSimulateSlowNetwork: boolean;
  shouldSimulateNetworkError: boolean;
  shouldSimulatePDFError: boolean;
  shouldSimulateTimeout: boolean;
  networkDelay: number;
  timeoutDelay: number;
  isDetailedLoggingEnabled: boolean;
  shouldLogPDFSteps: boolean;
}

export interface FlipbookDebugActions {
  simulateNetworkDelay: (operation: string) => Promise<void>;
  checkForSimulatedError: (errorType: 'network' | 'pdf' | 'timeout') => boolean;
  logDebugStep: (step: string, data?: any) => void;
  measureOperation: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
  startDebugTiming: (operation: string) => string;
  endDebugTiming: (timingId: string, operation: string) => number;
  getDebugConfig: () => any;
  exportDebugData: () => string;
}

export const useFlipbookDebug = (flipbookId?: string) => {
  const [debugState, setDebugState] = useState<FlipbookDebugState>({
    isDebugMode: isDevelopment,
    shouldSimulateSlowNetwork: false,
    shouldSimulateNetworkError: false,
    shouldSimulatePDFError: false,
    shouldSimulateTimeout: false,
    networkDelay: 0,
    timeoutDelay: 0,
    isDetailedLoggingEnabled: false,
    shouldLogPDFSteps: false,
  });

  // Update debug state when configuration changes
  useEffect(() => {
    if (!isDevelopment) return;

    const updateDebugState = () => {
      setDebugState({
        isDebugMode: isDevelopment,
        shouldSimulateSlowNetwork: shouldApplyNetworkSimulation(),
        shouldSimulateNetworkError: shouldSimulateFlipbookError('network'),
        shouldSimulatePDFError: shouldSimulateFlipbookError('pdf'),
        shouldSimulateTimeout: shouldSimulateFlipbookError('timeout'),
        networkDelay: getNetworkSimulationDelay(),
        timeoutDelay: getSimulatedTimeoutDelay(),
        isDetailedLoggingEnabled: isFlipbookDetailedLoggingEnabled(),
        shouldLogPDFSteps: shouldLogFlipbookPDFSteps(),
      });
    };

    // Initial update
    updateDebugState();

    // Listen for configuration changes (polling approach for simplicity)
    const interval = setInterval(updateDebugState, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulate network delay for operations
  const simulateNetworkDelay = useCallback(async (operation: string) => {
    if (!isDevelopment || !debugState.shouldSimulateSlowNetwork) return;

    const delay = debugState.networkDelay;
    if (delay > 0) {
      flipbookLogger.debug(`Simulating network delay for ${operation}`, {
        flipbookId,
        component: 'useFlipbookDebug',
      }, {
        operation,
        simulatedDelay: delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, [debugState.shouldSimulateSlowNetwork, debugState.networkDelay, flipbookId]);

  // Check if a specific error should be simulated
  const checkForSimulatedError = useCallback((errorType: 'network' | 'pdf' | 'timeout'): boolean => {
    if (!isDevelopment) return false;

    const shouldSimulate = shouldSimulateFlipbookError(errorType);
    
    if (shouldSimulate) {
      flipbookLogger.debug(`Simulating ${errorType} error`, {
        flipbookId,
        component: 'useFlipbookDebug',
      }, {
        errorType,
        simulationTriggered: true,
      });
    }

    return shouldSimulate;
  }, [flipbookId]);

  // Log debug steps with enhanced context
  const logDebugStep = useCallback((step: string, data?: any) => {
    if (!isDevelopment || !debugState.isDetailedLoggingEnabled) return;

    flipbookLogger.debug(`Debug Step: ${step}`, {
      flipbookId,
      component: 'useFlipbookDebug',
    }, {
      step,
      debugData: data,
      timestamp: Date.now(),
    });
  }, [debugState.isDetailedLoggingEnabled, flipbookId]);

  // Measure operation performance with debug integration
  const measureOperation = useCallback(async <T>(
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> => {
    if (!isDevelopment) {
      return operation();
    }

    const startTime = performance.now();
    const timingId = flipbookPerformanceMonitor.startTiming(
      operationName, 
      'debug-measurement', 
      flipbookId
    );

    logDebugStep(`Starting operation: ${operationName}`, {
      operationName,
      startTime,
    });

    try {
      // Apply network simulation if enabled
      await simulateNetworkDelay(operationName);

      // Check for simulated errors
      if (checkForSimulatedError('network')) {
        throw new Error(`Simulated network error for ${operationName}`);
      }

      if (checkForSimulatedError('pdf') && operationName.toLowerCase().includes('pdf')) {
        throw new Error(`Simulated PDF processing error for ${operationName}`);
      }

      if (checkForSimulatedError('timeout')) {
        const timeoutDelay = getSimulatedTimeoutDelay();
        await new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Simulated timeout for ${operationName}`)), timeoutDelay)
        );
      }

      const result = await operation();
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      flipbookPerformanceMonitor.endTiming(timingId, {
        success: true,
        duration,
        operationName,
      });

      logDebugStep(`Completed operation: ${operationName}`, {
        operationName,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      flipbookPerformanceMonitor.endTiming(timingId, {
        success: false,
        duration,
        operationName,
        error: (error as Error).message,
      });

      logDebugStep(`Failed operation: ${operationName}`, {
        operationName,
        duration,
        success: false,
        error: (error as Error).message,
      });

      throw error;
    }
  }, [simulateNetworkDelay, checkForSimulatedError, logDebugStep, flipbookId]);

  // Start debug timing
  const startDebugTiming = useCallback((operation: string): string => {
    if (!isDevelopment) return '';

    const timingId = flipbookPerformanceMonitor.startTiming(
      operation, 
      'debug-timing', 
      flipbookId
    );

    logDebugStep(`Started timing: ${operation}`, {
      operation,
      timingId,
    });

    return timingId;
  }, [logDebugStep, flipbookId]);

  // End debug timing
  const endDebugTiming = useCallback((timingId: string, operation: string): number => {
    if (!isDevelopment || !timingId) return 0;

    const metric = flipbookPerformanceMonitor.endTiming(timingId, {
      operation,
      debugTiming: true,
    });

    const duration = metric?.duration || 0;

    logDebugStep(`Ended timing: ${operation}`, {
      operation,
      timingId,
      duration,
    });

    return duration;
  }, [logDebugStep]);

  // Get current debug configuration
  const getDebugConfig = useCallback(() => {
    if (!isDevelopment) return {};
    return flipbookDebugger.getConfig();
  }, []);

  // Export debug data
  const exportDebugData = useCallback((): string => {
    if (!isDevelopment) return '';

    const debugData = {
      timestamp: new Date().toISOString(),
      flipbookId,
      debugState,
      performanceSummary: flipbookPerformanceMonitor.getPerformanceSummary(),
      logs: flipbookId ? flipbookLogger.getLogsForFlipbook(flipbookId) : flipbookLogger.getSessionLogs(),
      config: flipbookDebugger.getConfig(),
    };

    return JSON.stringify(debugData, null, 2);
  }, [debugState, flipbookId]);

  const actions: FlipbookDebugActions = {
    simulateNetworkDelay,
    checkForSimulatedError,
    logDebugStep,
    measureOperation,
    startDebugTiming,
    endDebugTiming,
    getDebugConfig,
    exportDebugData,
  };

  return {
    debugState,
    actions,
    isDebugMode: isDevelopment,
  };
};

// Utility hook for PDF processing debug integration
export const useFlipbookPDFDebug = (flipbookId?: string) => {
  const { debugState, actions } = useFlipbookDebug(flipbookId);

  const logPDFStep = useCallback((step: string, data?: any) => {
    if (!debugState.shouldLogPDFSteps) return;
    actions.logDebugStep(`PDF: ${step}`, data);
  }, [debugState.shouldLogPDFSteps, actions]);

  const measurePDFOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    return actions.measureOperation(operation, `PDF: ${operationName}`);
  }, [actions]);

  return {
    ...debugState,
    logPDFStep,
    measurePDFOperation,
    checkForPDFError: () => actions.checkForSimulatedError('pdf'),
    simulatePDFDelay: (operation: string) => actions.simulateNetworkDelay(`PDF: ${operation}`),
  };
};

// Utility hook for network operations debug integration
export const useFlipbookNetworkDebug = (flipbookId?: string) => {
  const { debugState, actions } = useFlipbookDebug(flipbookId);

  const simulateNetworkOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    // Apply network simulation
    await actions.simulateNetworkDelay(operationName);

    // Check for network errors
    if (actions.checkForSimulatedError('network')) {
      throw new Error(`Simulated network error: ${operationName}`);
    }

    return actions.measureOperation(operation, `Network: ${operationName}`);
  }, [actions]);

  return {
    ...debugState,
    simulateNetworkOperation,
    checkForNetworkError: () => actions.checkForSimulatedError('network'),
    logNetworkStep: (step: string, data?: any) => actions.logDebugStep(`Network: ${step}`, data),
  };
};

export default useFlipbookDebug;