/**
 * Debug utilities for conditional logging and development-only features
 * This ensures debug code is properly excluded from production builds
 */

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Conditional console logging that only runs in development
 */
export const debugLog = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

/**
 * Conditional execution for development-only code
 */
export const devOnly = (fn: () => void) => {
  if (isDevelopment) {
    fn();
  }
};

/**
 * Conditional execution for production-only code
 */
export const prodOnly = (fn: () => void) => {
  if (isProduction) {
    fn();
  }
};

/**
 * Get environment-specific configuration
 */
export const getEnvConfig = <T>(config: {
  development: T;
  production: T;
}): T => {
  return isDevelopment ? config.development : config.production;
};

/**
 * Performance measurement utility for development
 */
export const measurePerformance = (label: string, fn: () => void | Promise<void>) => {
  if (!isDevelopment) {
    return typeof fn === 'function' ? fn() : fn;
  }
  
  const start = performance.now();
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now();
      debugLog.info(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    });
  } else {
    const end = performance.now();
    debugLog.info(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
};

/**
 * Flipbook-specific debug mode configuration
 */
export interface FlipbookDebugConfig {
  enableDetailedLogging: boolean;
  simulateSlowNetwork: boolean;
  simulateNetworkErrors: boolean;
  simulatePDFErrors: boolean;
  simulateTimeouts: boolean;
  networkDelayMs: number;
  errorRate: number; // 0-1 probability
  timeoutDelayMs: number;
  enablePerformanceProfiling: boolean;
  logPDFProcessingSteps: boolean;
  showLoadingSimulation: boolean;
}

class FlipbookDebugger {
  private config: FlipbookDebugConfig = {
    enableDetailedLogging: false,
    simulateSlowNetwork: false,
    simulateNetworkErrors: false,
    simulatePDFErrors: false,
    simulateTimeouts: false,
    networkDelayMs: 2000,
    errorRate: 0.1,
    timeoutDelayMs: 30000,
    enablePerformanceProfiling: false,
    logPDFProcessingSteps: false,
    showLoadingSimulation: false,
  };

  private performanceMarks: Map<string, number> = new Map();
  private networkSimulationActive = false;

  constructor() {
    this.loadDebugConfig();
    this.setupGlobalDebugHelpers();
  }

  /**
   * Load debug configuration from localStorage
   */
  private loadDebugConfig(): void {
    if (!isDevelopment) return;

    try {
      const stored = localStorage.getItem('flipbook-debug-config');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      debugLog.warn('Failed to load debug config:', error);
    }
  }

  /**
   * Save debug configuration to localStorage
   */
  private saveDebugConfig(): void {
    if (!isDevelopment) return;

    try {
      localStorage.setItem('flipbook-debug-config', JSON.stringify(this.config));
    } catch (error) {
      debugLog.warn('Failed to save debug config:', error);
    }
  }

  /**
   * Setup global debug helpers for browser console
   */
  private setupGlobalDebugHelpers(): void {
    if (!isDevelopment) return;

    // Make debug utilities available globally in development
    (window as any).flipbookDebug = {
      // Configuration management
      getConfig: () => this.config,
      setConfig: (newConfig: Partial<FlipbookDebugConfig>) => this.updateConfig(newConfig),
      resetConfig: () => this.resetConfig(),
      
      // Simulation controls
      enableSlowNetwork: (delayMs: number = 2000) => this.enableNetworkSimulation(delayMs),
      disableSlowNetwork: () => this.disableNetworkSimulation(),
      simulateError: (errorType: string, probability: number = 1.0) => this.simulateError(errorType, probability),
      simulateTimeout: (delayMs: number = 30000) => this.simulateTimeout(delayMs),
      
      // Performance profiling
      startProfiling: (operation: string) => this.startPerformanceProfiling(operation),
      endProfiling: (operation: string) => this.endPerformanceProfiling(operation),
      getProfilingResults: () => this.getProfilingResults(),
      
      // Logging controls
      enableDetailedLogging: () => this.enableDetailedLogging(),
      disableDetailedLogging: () => this.disableDetailedLogging(),
      exportLogs: () => this.exportDebugLogs(),
      clearLogs: () => this.clearDebugLogs(),
      
      // Loading simulation
      simulateLoadingScenario: (scenario: string) => this.simulateLoadingScenario(scenario),
      
      // Utility functions
      measureOperation: (fn: () => void | Promise<void>, label?: string) => this.measureOperation(fn, label),
      logNetworkInfo: () => this.logNetworkInfo(),
      logBrowserInfo: () => this.logBrowserInfo(),
    };

    debugLog.info('🔧 Flipbook Debug Tools initialized. Use window.flipbookDebug for debugging utilities.');
  }

  /**
   * Update debug configuration
   */
  public updateConfig(newConfig: Partial<FlipbookDebugConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveDebugConfig();
    
    debugLog.info('🔧 Debug configuration updated:', newConfig);
  }

  /**
   * Reset debug configuration to defaults
   */
  public resetConfig(): void {
    this.config = {
      enableDetailedLogging: false,
      simulateSlowNetwork: false,
      simulateNetworkErrors: false,
      simulatePDFErrors: false,
      simulateTimeouts: false,
      networkDelayMs: 2000,
      errorRate: 0.1,
      timeoutDelayMs: 30000,
      enablePerformanceProfiling: false,
      logPDFProcessingSteps: false,
      showLoadingSimulation: false,
    };
    this.saveDebugConfig();
    
    debugLog.info('🔧 Debug configuration reset to defaults');
  }

  /**
   * Enable network simulation with specified delay
   */
  public enableNetworkSimulation(delayMs: number): void {
    this.config.simulateSlowNetwork = true;
    this.config.networkDelayMs = delayMs;
    this.networkSimulationActive = true;
    this.saveDebugConfig();
    
    debugLog.info(`🐌 Network simulation enabled with ${delayMs}ms delay`);
  }

  /**
   * Disable network simulation
   */
  public disableNetworkSimulation(): void {
    this.config.simulateSlowNetwork = false;
    this.networkSimulationActive = false;
    this.saveDebugConfig();
    
    debugLog.info('🚀 Network simulation disabled');
  }

  /**
   * Simulate specific error types
   */
  public simulateError(errorType: string, probability: number = 1.0): void {
    switch (errorType) {
      case 'network':
        this.config.simulateNetworkErrors = true;
        this.config.errorRate = probability;
        break;
      case 'pdf':
        this.config.simulatePDFErrors = true;
        this.config.errorRate = probability;
        break;
      case 'timeout':
        this.config.simulateTimeouts = true;
        break;
      default:
        debugLog.warn(`Unknown error type: ${errorType}`);
        return;
    }
    
    this.saveDebugConfig();
    debugLog.info(`💥 Error simulation enabled for ${errorType} with ${probability * 100}% probability`);
  }

  /**
   * Simulate timeout with specified delay
   */
  public simulateTimeout(delayMs: number): void {
    this.config.simulateTimeouts = true;
    this.config.timeoutDelayMs = delayMs;
    this.saveDebugConfig();
    
    debugLog.info(`⏰ Timeout simulation enabled with ${delayMs}ms delay`);
  }

  /**
   * Start performance profiling for an operation
   */
  public startPerformanceProfiling(operation: string): void {
    if (!this.config.enablePerformanceProfiling) {
      this.config.enablePerformanceProfiling = true;
      this.saveDebugConfig();
    }
    
    const startTime = performance.now();
    this.performanceMarks.set(operation, startTime);
    
    debugLog.info(`📊 Performance profiling started for: ${operation}`);
  }

  /**
   * End performance profiling for an operation
   */
  public endPerformanceProfiling(operation: string): number {
    const startTime = this.performanceMarks.get(operation);
    if (!startTime) {
      debugLog.warn(`No profiling started for operation: ${operation}`);
      return 0;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.performanceMarks.delete(operation);
    
    debugLog.info(`📊 Performance profiling completed for ${operation}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Get all profiling results
   */
  public getProfilingResults(): Record<string, number> {
    const results: Record<string, number> = {};
    const currentTime = performance.now();
    
    this.performanceMarks.forEach((startTime, operation) => {
      results[operation] = currentTime - startTime;
    });
    
    return results;
  }

  /**
   * Enable detailed logging
   */
  public enableDetailedLogging(): void {
    this.config.enableDetailedLogging = true;
    this.config.logPDFProcessingSteps = true;
    this.saveDebugConfig();
    
    debugLog.info('📝 Detailed logging enabled');
  }

  /**
   * Disable detailed logging
   */
  public disableDetailedLogging(): void {
    this.config.enableDetailedLogging = false;
    this.config.logPDFProcessingSteps = false;
    this.saveDebugConfig();
    
    debugLog.info('📝 Detailed logging disabled');
  }

  /**
   * Export debug logs for analysis
   */
  public exportDebugLogs(): string {
    const logs = {
      timestamp: new Date().toISOString(),
      config: this.config,
      performanceMarks: Object.fromEntries(this.performanceMarks),
      browserInfo: this.getBrowserInfo(),
      networkInfo: this.getNetworkInfo(),
    };
    
    const logString = JSON.stringify(logs, null, 2);
    
    // Create downloadable file in development
    if (isDevelopment) {
      const blob = new Blob([logString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flipbook-debug-logs-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    return logString;
  }

  /**
   * Clear debug logs
   */
  public clearDebugLogs(): void {
    this.performanceMarks.clear();
    debugLog.info('🗑️ Debug logs cleared');
  }

  /**
   * Simulate different loading scenarios for testing
   */
  public simulateLoadingScenario(scenario: string): void {
    switch (scenario) {
      case 'slow-network':
        this.enableNetworkSimulation(5000);
        debugLog.info('🐌 Simulating slow network (5s delay)');
        break;
      case 'network-error':
        this.simulateError('network', 0.5);
        debugLog.info('💥 Simulating network errors (50% chance)');
        break;
      case 'large-pdf':
        this.config.showLoadingSimulation = true;
        this.enableNetworkSimulation(10000);
        debugLog.info('📄 Simulating large PDF loading (10s delay)');
        break;
      case 'timeout':
        this.simulateTimeout(5000);
        debugLog.info('⏰ Simulating timeout (5s)');
        break;
      case 'pdf-error':
        this.simulateError('pdf', 1.0);
        debugLog.info('💥 Simulating PDF processing error');
        break;
      case 'reset':
        this.resetConfig();
        debugLog.info('🔄 Reset to normal loading');
        break;
      default:
        debugLog.warn(`Unknown scenario: ${scenario}`);
        debugLog.info('Available scenarios: slow-network, network-error, large-pdf, timeout, pdf-error, reset');
    }
    
    this.saveDebugConfig();
  }

  /**
   * Measure operation performance
   */
  public measureOperation(fn: () => void | Promise<void>, label?: string): Promise<number> | number {
    const operationLabel = label || 'Anonymous Operation';
    const startTime = performance.now();
    
    debugLog.info(`⏱️ Starting measurement: ${operationLabel}`);
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(() => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        debugLog.info(`⏱️ Completed measurement: ${operationLabel} - ${duration.toFixed(2)}ms`);
        return duration;
      });
    } else {
      const endTime = performance.now();
      const duration = endTime - startTime;
      debugLog.info(`⏱️ Completed measurement: ${operationLabel} - ${duration.toFixed(2)}ms`);
      return duration;
    }
  }

  /**
   * Log current network information
   */
  public logNetworkInfo(): void {
    const networkInfo = this.getNetworkInfo();
    debugLog.info('🌐 Network Information:', networkInfo);
  }

  /**
   * Log browser information
   */
  public logBrowserInfo(): void {
    const browserInfo = this.getBrowserInfo();
    debugLog.info('🌐 Browser Information:', browserInfo);
  }

  /**
   * Get network information
   */
  private getNetworkInfo(): any {
    const connection = (navigator as any).connection;
    if (!connection) {
      return { available: false, message: 'Network API not supported' };
    }
    
    return {
      available: true,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): any {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
    };
  }

  /**
   * Check if network simulation should be applied
   */
  public shouldSimulateSlowNetwork(): boolean {
    return this.config.simulateSlowNetwork && this.networkSimulationActive;
  }

  /**
   * Get network delay for simulation
   */
  public getNetworkDelay(): number {
    return this.config.networkDelayMs;
  }

  /**
   * Check if error should be simulated
   */
  public shouldSimulateError(errorType: string): boolean {
    switch (errorType) {
      case 'network':
        return this.config.simulateNetworkErrors && Math.random() < this.config.errorRate;
      case 'pdf':
        return this.config.simulatePDFErrors && Math.random() < this.config.errorRate;
      case 'timeout':
        return this.config.simulateTimeouts;
      default:
        return false;
    }
  }

  /**
   * Get timeout delay for simulation
   */
  public getTimeoutDelay(): number {
    return this.config.timeoutDelayMs;
  }

  /**
   * Check if detailed logging is enabled
   */
  public isDetailedLoggingEnabled(): boolean {
    return this.config.enableDetailedLogging;
  }

  /**
   * Check if PDF processing steps should be logged
   */
  public shouldLogPDFProcessingSteps(): boolean {
    return this.config.logPDFProcessingSteps;
  }

  /**
   * Get current configuration
   */
  public getConfig(): FlipbookDebugConfig {
    return { ...this.config };
  }}


//Create singleton instance for development debugging
export const flipbookDebugger = new FlipbookDebugger();

// Utility functions for easy access to debugging features
export const enableFlipbookDebugMode = () => {
  if (!isDevelopment) {
    console.warn('Debug mode is only available in development environment');
    return;
  }
  
  flipbookDebugger.enableDetailedLogging();
  flipbookDebugger.updateConfig({ enablePerformanceProfiling: true });
  
  debugLog.info('🔧 Flipbook debug mode enabled');
  debugLog.info('Use window.flipbookDebug for debugging utilities');
};

export const disableFlipbookDebugMode = () => {
  if (!isDevelopment) return;
  
  flipbookDebugger.disableDetailedLogging();
  flipbookDebugger.resetConfig();
  
  debugLog.info('🔧 Flipbook debug mode disabled');
};

// Simulation utilities for testing different scenarios
export const simulateSlowNetwork = (delayMs: number = 2000) => {
  if (!isDevelopment) return;
  flipbookDebugger.enableNetworkSimulation(delayMs);
};

export const simulateNetworkError = (probability: number = 0.5) => {
  if (!isDevelopment) return;
  flipbookDebugger.simulateError('network', probability);
};

export const simulatePDFError = (probability: number = 1.0) => {
  if (!isDevelopment) return;
  flipbookDebugger.simulateError('pdf', probability);
};

export const simulateTimeout = (delayMs: number = 5000) => {
  if (!isDevelopment) return;
  flipbookDebugger.simulateTimeout(delayMs);
};

// Performance profiling utilities
export const startDebugProfiling = (operation: string) => {
  if (!isDevelopment) return;
  flipbookDebugger.startPerformanceProfiling(operation);
};

export const endDebugProfiling = (operation: string) => {
  if (!isDevelopment) return 0;
  return flipbookDebugger.endPerformanceProfiling(operation);
};

// Loading scenario simulation
export const testLoadingScenario = (scenario: 'slow-network' | 'network-error' | 'large-pdf' | 'timeout' | 'pdf-error' | 'reset') => {
  if (!isDevelopment) return;
  flipbookDebugger.simulateLoadingScenario(scenario);
};

// Debug information utilities
export const logDebugInfo = () => {
  if (!isDevelopment) return;
  
  flipbookDebugger.logBrowserInfo();
  flipbookDebugger.logNetworkInfo();
  
  const config = flipbookDebugger.getConfig();
  debugLog.info('🔧 Current Debug Configuration:', config);
};

export const exportDebugData = () => {
  if (!isDevelopment) return '';
  return flipbookDebugger.exportDebugLogs();
};

// Integration with existing flipbook systems
export const shouldApplyNetworkSimulation = () => {
  if (!isDevelopment) return false;
  return flipbookDebugger.shouldSimulateSlowNetwork();
};

export const getNetworkSimulationDelay = () => {
  if (!isDevelopment) return 0;
  return flipbookDebugger.getNetworkDelay();
};

export const shouldSimulateFlipbookError = (errorType: 'network' | 'pdf' | 'timeout') => {
  if (!isDevelopment) return false;
  return flipbookDebugger.shouldSimulateError(errorType);
};

export const getSimulatedTimeoutDelay = () => {
  if (!isDevelopment) return 0;
  return flipbookDebugger.getTimeoutDelay();
};

export const isFlipbookDetailedLoggingEnabled = () => {
  if (!isDevelopment) return false;
  return flipbookDebugger.isDetailedLoggingEnabled();
};

export const shouldLogFlipbookPDFSteps = () => {
  if (!isDevelopment) return false;
  return flipbookDebugger.shouldLogPDFProcessingSteps();
};