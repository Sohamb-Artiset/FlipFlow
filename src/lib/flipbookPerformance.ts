/**
 * Performance monitoring and timing metrics for flipbook operations
 * Tracks loading times, bottlenecks, and provides progress tracking
 */

import { flipbookLogger } from './flipbookLogger';
import type { FlipbookLoadingPhase } from './flipbookLogger';

export interface PerformanceMetric {
  id: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  phase: string;
  flipbookId?: string;
  metadata?: Record<string, any>;
}

export interface ProgressTracker {
  id: string;
  operation: string;
  totalSteps: number;
  currentStep: number;
  stepName: string;
  startTime: number;
  estimatedDuration?: number;
  bytesLoaded?: number;
  totalBytes?: number;
  percentage: number;
}

export interface PerformanceBenchmark {
  operation: string;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  sampleCount: number;
  lastUpdated: string;
}

export interface LoadingSuccessMetrics {
  operation: string;
  totalAttempts: number;
  successfulLoads: number;
  failedLoads: number;
  timeouts: number;
  retryAttempts: number;
  successRate: number;
  averageLoadTime: number;
  failurePatterns: Map<string, number>;
  timeoutsBySize: Map<string, number>; // PDF size ranges
  lastUpdated: string;
}

export interface ConnectionSpeedMetrics {
  effectiveType: string;
  downlink?: number;
  rtt?: number;
  averageLoadTime: number;
  sampleCount: number;
  successRate: number;
}

class FlipbookPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private progressTrackers: Map<string, ProgressTracker> = new Map();
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private loadingMetrics: Map<string, LoadingSuccessMetrics> = new Map();
  private connectionMetrics: Map<string, ConnectionSpeedMetrics> = new Map();
  private performanceObserver?: PerformanceObserver;

  constructor() {
    this.initializePerformanceObserver();
    this.loadBenchmarks();
  }

  private initializePerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name.startsWith('flipbook-')) {
              this.logPerformanceEntry(entry);
            }
          });
        });

        this.performanceObserver.observe({ 
          entryTypes: ['measure', 'navigation', 'resource'] 
        });
      } catch (error) {
        flipbookLogger.warn('Performance Observer not supported', {
          component: 'FlipbookPerformanceMonitor',
        }, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  private logPerformanceEntry(entry: PerformanceEntry): void {
    flipbookLogger.debug('Performance entry recorded', {
      component: 'FlipbookPerformanceMonitor',
    }, {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      entryType: entry.entryType,
    });
  }

  private loadBenchmarks(): void {
    try {
      const stored = localStorage.getItem('flipbook-performance-benchmarks');
      if (stored) {
        const benchmarkData = JSON.parse(stored);
        Object.entries(benchmarkData).forEach(([key, value]) => {
          this.benchmarks.set(key, value as PerformanceBenchmark);
        });
      }

      // Load loading success metrics
      const loadingStored = localStorage.getItem('flipbook-loading-metrics');
      if (loadingStored) {
        const loadingData = JSON.parse(loadingStored);
        Object.entries(loadingData).forEach(([key, value]) => {
          const metrics = value as any;
          metrics.failurePatterns = new Map(metrics.failurePatterns || []);
          metrics.timeoutsBySize = new Map(metrics.timeoutsBySize || []);
          this.loadingMetrics.set(key, metrics);
        });
      }

      // Load connection metrics
      const connectionStored = localStorage.getItem('flipbook-connection-metrics');
      if (connectionStored) {
        const connectionData = JSON.parse(connectionStored);
        Object.entries(connectionData).forEach(([key, value]) => {
          this.connectionMetrics.set(key, value as ConnectionSpeedMetrics);
        });
      }
    } catch (error) {
      flipbookLogger.warn('Failed to load performance benchmarks', {
        component: 'FlipbookPerformanceMonitor',
      }, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private saveBenchmarks(): void {
    try {
      const benchmarkData = Object.fromEntries(this.benchmarks);
      localStorage.setItem('flipbook-performance-benchmarks', JSON.stringify(benchmarkData));

      // Save loading metrics
      const loadingData = Object.fromEntries(
        Array.from(this.loadingMetrics.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            failurePatterns: Array.from(value.failurePatterns.entries()),
            timeoutsBySize: Array.from(value.timeoutsBySize.entries()),
          }
        ])
      );
      localStorage.setItem('flipbook-loading-metrics', JSON.stringify(loadingData));

      // Save connection metrics
      const connectionData = Object.fromEntries(this.connectionMetrics);
      localStorage.setItem('flipbook-connection-metrics', JSON.stringify(connectionData));
    } catch (error) {
      flipbookLogger.warn('Failed to save performance benchmarks', {
        component: 'FlipbookPerformanceMonitor',
      }, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Start timing a specific operation
   */
  public startTiming(
    operation: string,
    phase: string,
    flipbookId?: string,
    metadata?: Record<string, any>
  ): string {
    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const startTime = performance.now();

    const metric: PerformanceMetric = {
      id,
      operation,
      startTime,
      phase,
      flipbookId,
      metadata,
    };

    this.metrics.set(id, metric);

    // Mark performance start for browser performance API
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`flipbook-${operation}-start-${id}`);
    }

    flipbookLogger.debug(`Started timing: ${operation}`, {
      component: 'FlipbookPerformanceMonitor',
      phase: phase as FlipbookLoadingPhase,
      flipbookId,
    }, {
      timingId: id,
      startTime,
      ...metadata,
    });

    return id;
  }

  /**
   * End timing for a specific operation
   */
  public endTiming(
    timingId: string,
    metadata?: Record<string, any>
  ): PerformanceMetric | null {
    const metric = this.metrics.get(timingId);
    if (!metric) {
      flipbookLogger.warn(`Timing not found for ID: ${timingId}`, {
        component: 'FlipbookPerformanceMonitor',
      });
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;
    metric.metadata = { ...metric.metadata, ...metadata };

    // Mark performance end for browser performance API
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`flipbook-${metric.operation}-end-${timingId}`);
      performance.measure(
        `flipbook-${metric.operation}-${timingId}`,
        `flipbook-${metric.operation}-start-${timingId}`,
        `flipbook-${metric.operation}-end-${timingId}`
      );
    }

    flipbookLogger.info(`Completed timing: ${metric.operation}`, {
      component: 'FlipbookPerformanceMonitor',
      phase: (metric.phase as FlipbookLoadingPhase) || 'complete',
      flipbookId: metric.flipbookId,
    }, {
      timingId,
      duration: Math.round(duration * 100) / 100,
      startTime: metric.startTime,
      endTime,
      ...metric.metadata,
    });

    // Update benchmarks
    this.updateBenchmark(metric);

    return metric;
  }

  /**
   * Create a progress tracker for long-running operations
   */
  public createProgressTracker(
    operation: string,
    totalSteps: number,
    flipbookId?: string,
    estimatedDuration?: number
  ): string {
    const id = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const startTime = performance.now();

    const tracker: ProgressTracker = {
      id,
      operation,
      totalSteps,
      currentStep: 0,
      stepName: 'Starting...',
      startTime,
      estimatedDuration,
      percentage: 0,
    };

    this.progressTrackers.set(id, tracker);

    flipbookLogger.info(`Created progress tracker: ${operation}`, {
      component: 'FlipbookPerformanceMonitor',
      flipbookId,
    }, {
      trackerId: id,
      totalSteps,
      estimatedDuration,
    });

    return id;
  }

  /**
   * Update progress for a tracked operation
   */
  public updateProgress(
    trackerId: string,
    currentStep: number,
    stepName: string,
    bytesLoaded?: number,
    totalBytes?: number
  ): ProgressTracker | null {
    const tracker = this.progressTrackers.get(trackerId);
    if (!tracker) {
      flipbookLogger.warn(`Progress tracker not found: ${trackerId}`, {
        component: 'FlipbookPerformanceMonitor',
      });
      return null;
    }

    tracker.currentStep = currentStep;
    tracker.stepName = stepName;
    tracker.bytesLoaded = bytesLoaded;
    tracker.totalBytes = totalBytes;

    // Calculate percentage based on steps or bytes
    if (totalBytes && bytesLoaded) {
      tracker.percentage = Math.round((bytesLoaded / totalBytes) * 100);
    } else {
      tracker.percentage = Math.round((currentStep / tracker.totalSteps) * 100);
    }

    flipbookLogger.debug(`Progress updated: ${tracker.operation}`, {
      component: 'FlipbookPerformanceMonitor',
    }, {
      trackerId,
      currentStep,
      totalSteps: tracker.totalSteps,
      stepName,
      percentage: tracker.percentage,
      bytesLoaded,
      totalBytes,
    });

    return tracker;
  }

  /**
   * Complete a progress tracker
   */
  public completeProgress(trackerId: string): PerformanceMetric | null {
    const tracker = this.progressTrackers.get(trackerId);
    if (!tracker) {
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - tracker.startTime;

    const metric: PerformanceMetric = {
      id: trackerId,
      operation: tracker.operation,
      startTime: tracker.startTime,
      endTime,
      duration,
      phase: 'complete',
      metadata: {
        totalSteps: tracker.totalSteps,
        finalStep: tracker.currentStep,
        bytesLoaded: tracker.bytesLoaded,
        totalBytes: tracker.totalBytes,
      },
    };

    this.progressTrackers.delete(trackerId);

    flipbookLogger.info(`Progress completed: ${tracker.operation}`, {
      component: 'FlipbookPerformanceMonitor',
    }, {
      trackerId,
      duration: Math.round(duration * 100) / 100,
      totalSteps: tracker.totalSteps,
      bytesProcessed: tracker.bytesLoaded,
    });

    return metric;
  }

  /**
   * Update performance benchmarks
   */
  private updateBenchmark(metric: PerformanceMetric): void {
    if (!metric.duration) return;

    const existing = this.benchmarks.get(metric.operation);
    
    if (existing) {
      const newSampleCount = existing.sampleCount + 1;
      const newAverage = ((existing.averageDuration * existing.sampleCount) + metric.duration) / newSampleCount;
      
      existing.averageDuration = newAverage;
      existing.minDuration = Math.min(existing.minDuration, metric.duration);
      existing.maxDuration = Math.max(existing.maxDuration, metric.duration);
      existing.sampleCount = newSampleCount;
      existing.lastUpdated = new Date().toISOString();
    } else {
      this.benchmarks.set(metric.operation, {
        operation: metric.operation,
        averageDuration: metric.duration,
        minDuration: metric.duration,
        maxDuration: metric.duration,
        sampleCount: 1,
        lastUpdated: new Date().toISOString(),
      });
    }

    this.saveBenchmarks();
  }

  /**
   * Get performance metrics for an operation
   */
  public getMetrics(operation?: string): PerformanceMetric[] {
    const allMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
    
    if (operation) {
      return allMetrics.filter(m => m.operation === operation);
    }
    
    return allMetrics;
  }

  /**
   * Get active progress trackers
   */
  public getActiveProgress(): ProgressTracker[] {
    return Array.from(this.progressTrackers.values());
  }

  /**
   * Get performance benchmarks
   */
  public getBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Get benchmark for specific operation
   */
  public getBenchmark(operation: string): PerformanceBenchmark | null {
    return this.benchmarks.get(operation) || null;
  }

  /**
   * Check if operation is performing slower than benchmark
   */
  public isSlowerThanBenchmark(operation: string, duration: number, threshold: number = 1.5): boolean {
    const benchmark = this.getBenchmark(operation);
    if (!benchmark) return false;
    
    return duration > (benchmark.averageDuration * threshold);
  }

  /**
   * Record a loading attempt result
   */
  public recordLoadingAttempt(
    operation: string,
    success: boolean,
    duration: number,
    pdfSize?: number,
    failureReason?: string,
    isTimeout?: boolean,
    isRetry?: boolean
  ): void {
    const existing = this.loadingMetrics.get(operation) || {
      operation,
      totalAttempts: 0,
      successfulLoads: 0,
      failedLoads: 0,
      timeouts: 0,
      retryAttempts: 0,
      successRate: 0,
      averageLoadTime: 0,
      failurePatterns: new Map(),
      timeoutsBySize: new Map(),
      lastUpdated: new Date().toISOString(),
    };

    existing.totalAttempts++;
    
    if (isRetry) {
      existing.retryAttempts++;
    }

    if (success) {
      existing.successfulLoads++;
      // Update average load time for successful loads only
      const totalSuccessTime = existing.averageLoadTime * (existing.successfulLoads - 1) + duration;
      existing.averageLoadTime = totalSuccessTime / existing.successfulLoads;
    } else {
      existing.failedLoads++;
      
      if (isTimeout) {
        existing.timeouts++;
        
        // Track timeouts by PDF size
        if (pdfSize) {
          const sizeRange = this.getPDFSizeRange(pdfSize);
          existing.timeoutsBySize.set(sizeRange, (existing.timeoutsBySize.get(sizeRange) || 0) + 1);
        }
      }
      
      // Track failure patterns
      if (failureReason) {
        existing.failurePatterns.set(failureReason, (existing.failurePatterns.get(failureReason) || 0) + 1);
      }
    }

    existing.successRate = (existing.successfulLoads / existing.totalAttempts) * 100;
    existing.lastUpdated = new Date().toISOString();

    this.loadingMetrics.set(operation, existing);
    this.saveBenchmarks();

    flipbookLogger.info(`Loading attempt recorded: ${operation}`, {
      component: 'FlipbookPerformanceMonitor',
    }, {
      success,
      duration: Math.round(duration * 100) / 100,
      successRate: Math.round(existing.successRate * 100) / 100,
      totalAttempts: existing.totalAttempts,
      isTimeout,
      isRetry,
      failureReason,
    });
  }

  /**
   * Record connection speed metrics
   */
  public recordConnectionMetrics(
    loadTime: number,
    success: boolean,
    pdfSize?: number
  ): void {
    const connection = (navigator as any).connection;
    if (!connection) return;

    const effectiveType = connection.effectiveType || 'unknown';
    const existing = this.connectionMetrics.get(effectiveType) || {
      effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      averageLoadTime: 0,
      sampleCount: 0,
      successRate: 0,
    };

    existing.sampleCount++;
    
    if (success) {
      // Update average load time for successful loads
      const totalTime = existing.averageLoadTime * (existing.sampleCount - 1) + loadTime;
      existing.averageLoadTime = totalTime / existing.sampleCount;
    }

    // Calculate success rate (this is a simplified approach)
    existing.successRate = success ? 
      ((existing.successRate * (existing.sampleCount - 1)) + 100) / existing.sampleCount :
      (existing.successRate * (existing.sampleCount - 1)) / existing.sampleCount;

    this.connectionMetrics.set(effectiveType, existing);
    this.saveBenchmarks();
  }

  /**
   * Get PDF size range for categorization
   */
  private getPDFSizeRange(sizeBytes: number): string {
    const sizeMB = sizeBytes / (1024 * 1024);
    
    if (sizeMB < 1) return '< 1MB';
    if (sizeMB < 5) return '1-5MB';
    if (sizeMB < 10) return '5-10MB';
    if (sizeMB < 25) return '10-25MB';
    if (sizeMB < 50) return '25-50MB';
    return '> 50MB';
  }

  /**
   * Get loading success metrics for an operation
   */
  public getLoadingMetrics(operation?: string): LoadingSuccessMetrics[] {
    if (operation) {
      const metrics = this.loadingMetrics.get(operation);
      return metrics ? [metrics] : [];
    }
    
    return Array.from(this.loadingMetrics.values());
  }

  /**
   * Get connection speed metrics
   */
  public getConnectionMetrics(): ConnectionSpeedMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * Get failure pattern analysis
   */
  public getFailureAnalysis(): {
    mostCommonFailures: Array<{ reason: string; count: number; percentage: number }>;
    timeoutsBySize: Array<{ sizeRange: string; count: number; percentage: number }>;
    overallSuccessRate: number;
    totalFailures: number;
  } {
    const allFailures = new Map<string, number>();
    const allTimeouts = new Map<string, number>();
    let totalAttempts = 0;
    let totalSuccesses = 0;

    this.loadingMetrics.forEach(metrics => {
      totalAttempts += metrics.totalAttempts;
      totalSuccesses += metrics.successfulLoads;

      metrics.failurePatterns.forEach((count, reason) => {
        allFailures.set(reason, (allFailures.get(reason) || 0) + count);
      });

      metrics.timeoutsBySize.forEach((count, sizeRange) => {
        allTimeouts.set(sizeRange, (allTimeouts.get(sizeRange) || 0) + count);
      });
    });

    const totalFailures = totalAttempts - totalSuccesses;
    const overallSuccessRate = totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 0;

    const mostCommonFailures = Array.from(allFailures.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalFailures > 0 ? (count / totalFailures) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const timeoutsBySize = Array.from(allTimeouts.entries())
      .map(([sizeRange, count]) => ({
        sizeRange,
        count,
        percentage: totalFailures > 0 ? (count / totalFailures) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      mostCommonFailures,
      timeoutsBySize,
      overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
      totalFailures,
    };
  }

  /**
   * Check if success rate is below threshold
   */
  public isSuccessRateBelowThreshold(operation: string, threshold: number = 95): boolean {
    const metrics = this.loadingMetrics.get(operation);
    return metrics ? metrics.successRate < threshold : false;
  }

  /**
   * Check if timeout rate is above threshold
   */
  public isTimeoutRateAboveThreshold(operation: string, threshold: number = 5): boolean {
    const metrics = this.loadingMetrics.get(operation);
    if (!metrics || metrics.totalAttempts === 0) return false;
    
    const timeoutRate = (metrics.timeouts / metrics.totalAttempts) * 100;
    return timeoutRate > threshold;
  }

  /**
   * Get performance summary for debugging
   */
  public getPerformanceSummary(): {
    totalOperations: number;
    averageLoadTime: number;
    slowestOperation: PerformanceMetric | null;
    fastestOperation: PerformanceMetric | null;
    activeProgress: number;
    benchmarks: PerformanceBenchmark[];
    loadingMetrics: LoadingSuccessMetrics[];
    connectionMetrics: ConnectionSpeedMetrics[];
    failureAnalysis: ReturnType<typeof this.getFailureAnalysis>;
  } {
    const metrics = this.getMetrics();
    const totalOperations = metrics.length;
    
    if (totalOperations === 0) {
      return {
        totalOperations: 0,
        averageLoadTime: 0,
        slowestOperation: null,
        fastestOperation: null,
        activeProgress: this.progressTrackers.size,
        benchmarks: this.getBenchmarks(),
        loadingMetrics: [],
        connectionMetrics: [],
        failureAnalysis: this.getFailureAnalysis(),
      };
    }

    const durations = metrics.map(m => m.duration!);
    const averageLoadTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    const slowestOperation = metrics.reduce((slowest, current) => 
      (current.duration! > slowest.duration!) ? current : slowest
    );
    
    const fastestOperation = metrics.reduce((fastest, current) => 
      (current.duration! < fastest.duration!) ? current : fastest
    );

    return {
      totalOperations,
      averageLoadTime: Math.round(averageLoadTime * 100) / 100,
      slowestOperation,
      fastestOperation,
      activeProgress: this.progressTrackers.size,
      benchmarks: this.getBenchmarks(),
      loadingMetrics: this.getLoadingMetrics(),
      connectionMetrics: this.getConnectionMetrics(),
      failureAnalysis: this.getFailureAnalysis(),
    };
  }

  /**
   * Clear all metrics and progress trackers
   */
  public clearMetrics(): void {
    this.metrics.clear();
    this.progressTrackers.clear();
    
    flipbookLogger.info('Performance metrics cleared', {
      component: 'FlipbookPerformanceMonitor',
    });
  }

  /**
   * Export performance data for analysis
   */
  public exportPerformanceData(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: Array.from(this.metrics.values()),
      activeProgress: Array.from(this.progressTrackers.values()),
      benchmarks: Array.from(this.benchmarks.values()),
      summary: this.getPerformanceSummary(),
    }, null, 2);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.clearMetrics();
  }
}

// Create singleton instance
export const flipbookPerformanceMonitor = new FlipbookPerformanceMonitor();

// Convenience functions for common performance tracking patterns
export const startFlipbookOperation = (
  operation: string,
  phase: string,
  flipbookId?: string,
  metadata?: Record<string, any>
): string => {
  return flipbookPerformanceMonitor.startTiming(operation, phase, flipbookId, metadata);
};

export const endFlipbookOperation = (
  timingId: string,
  metadata?: Record<string, any>
): PerformanceMetric | null => {
  return flipbookPerformanceMonitor.endTiming(timingId, metadata);
};

export const trackFlipbookProgress = (
  operation: string,
  totalSteps: number,
  flipbookId?: string,
  estimatedDuration?: number
): string => {
  return flipbookPerformanceMonitor.createProgressTracker(operation, totalSteps, flipbookId, estimatedDuration);
};

export const updateFlipbookProgress = (
  trackerId: string,
  currentStep: number,
  stepName: string,
  bytesLoaded?: number,
  totalBytes?: number
): ProgressTracker | null => {
  return flipbookPerformanceMonitor.updateProgress(trackerId, currentStep, stepName, bytesLoaded, totalBytes);
};

export const completeFlipbookProgress = (trackerId: string): PerformanceMetric | null => {
  return flipbookPerformanceMonitor.completeProgress(trackerId);
};

export const recordFlipbookLoadingResult = (
  operation: string,
  success: boolean,
  duration: number,
  pdfSize?: number,
  failureReason?: string,
  isTimeout?: boolean,
  isRetry?: boolean
): void => {
  flipbookPerformanceMonitor.recordLoadingAttempt(
    operation,
    success,
    duration,
    pdfSize,
    failureReason,
    isTimeout,
    isRetry
  );
};

export const recordFlipbookConnectionMetrics = (
  loadTime: number,
  success: boolean,
  pdfSize?: number
): void => {
  flipbookPerformanceMonitor.recordConnectionMetrics(loadTime, success, pdfSize);
};

export const getFlipbookLoadingMetrics = (operation?: string): LoadingSuccessMetrics[] => {
  return flipbookPerformanceMonitor.getLoadingMetrics(operation);
};

export const getFlipbookFailureAnalysis = () => {
  return flipbookPerformanceMonitor.getFailureAnalysis();
};

export const checkFlipbookSuccessRate = (operation: string, threshold: number = 95): boolean => {
  return flipbookPerformanceMonitor.isSuccessRateBelowThreshold(operation, threshold);
};

export const checkFlipbookTimeoutRate = (operation: string, threshold: number = 5): boolean => {
  return flipbookPerformanceMonitor.isTimeoutRateAboveThreshold(operation, threshold);
};