/**
 * Advanced performance profiling utilities for flipbook operations
 * Provides detailed analysis, bottleneck detection, and optimization suggestions
 */

import { flipbookPerformanceMonitor, type PerformanceMetric } from './flipbookPerformance';
import { flipbookLogger } from './flipbookLogger';
import { isDevelopment } from './debugUtils';

export interface PerformanceProfile {
  operation: string;
  totalDuration: number;
  phases: PhaseProfile[];
  bottlenecks: Bottleneck[];
  optimizationSuggestions: OptimizationSuggestion[];
  memoryUsage?: MemoryProfile;
  networkProfile?: NetworkProfile;
}

export interface PhaseProfile {
  name: string;
  duration: number;
  percentage: number;
  isBottleneck: boolean;
  metrics: Record<string, any>;
}

export interface Bottleneck {
  phase: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggestedFix: string;
  estimatedImprovement: string;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'reliability' | 'user-experience';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string;
  estimatedBenefit: string;
  effort: 'low' | 'medium' | 'high';
}

export interface MemoryProfile {
  initialUsage: number;
  peakUsage: number;
  finalUsage: number;
  memoryLeaks: boolean;
  gcPressure: 'low' | 'medium' | 'high';
}

export interface NetworkProfile {
  connectionType: string;
  bandwidth: number;
  latency: number;
  efficiency: number;
  recommendedOptimizations: string[];
}

export interface ProfilerConfig {
  enableMemoryProfiling: boolean;
  enableNetworkProfiling: boolean;
  enableBottleneckDetection: boolean;
  enableOptimizationSuggestions: boolean;
  performanceThresholds: {
    slowOperation: number; // ms
    verySlowOperation: number; // ms
    acceptableLoadTime: number; // ms
    maxAcceptableLoadTime: number; // ms
  };
}

class FlipbookProfiler {
  private config: ProfilerConfig = {
    enableMemoryProfiling: true,
    enableNetworkProfiling: true,
    enableBottleneckDetection: true,
    enableOptimizationSuggestions: true,
    performanceThresholds: {
      slowOperation: 2000, // 2 seconds
      verySlowOperation: 5000, // 5 seconds
      acceptableLoadTime: 3000, // 3 seconds
      maxAcceptableLoadTime: 10000, // 10 seconds
    },
  };

  private activeProfiles: Map<string, {
    startTime: number;
    phases: Array<{ name: string; startTime: number; endTime?: number; metrics?: any }>;
    memoryStart?: number;
    networkStart?: any;
  }> = new Map();

  constructor() {
    this.setupGlobalProfiler();
  }

  private setupGlobalProfiler(): void {
    if (!isDevelopment) return;

    (window as any).flipbookProfiler = {
      startProfiling: (operation: string) => this.startProfiling(operation),
      endProfiling: (operation: string) => this.endProfiling(operation),
      addPhase: (operation: string, phaseName: string, metrics?: any) => this.addPhase(operation, phaseName, metrics),
      getProfile: (operation: string) => this.getProfile(operation),
      analyzePerformance: () => this.analyzeOverallPerformance(),
      getOptimizationSuggestions: () => this.getOptimizationSuggestions(),
      exportProfile: (operation: string) => this.exportProfile(operation),
      clearProfiles: () => this.clearProfiles(),
    };
  }

  /**
   * Start profiling an operation
   */
  public startProfiling(operation: string): void {
    if (!isDevelopment) return;

    const startTime = performance.now();
    const memoryStart = this.config.enableMemoryProfiling ? this.getMemoryUsage() : undefined;
    const networkStart = this.config.enableNetworkProfiling ? this.getNetworkInfo() : undefined;

    this.activeProfiles.set(operation, {
      startTime,
      phases: [],
      memoryStart,
      networkStart,
    });

    flipbookLogger.debug(`Started profiling: ${operation}`, {
      component: 'FlipbookProfiler',
    }, {
      operation,
      startTime,
      memoryStart,
      networkStart,
    });
  }

  /**
   * Add a phase to the current profiling session
   */
  public addPhase(operation: string, phaseName: string, metrics?: any): void {
    if (!isDevelopment) return;

    const profile = this.activeProfiles.get(operation);
    if (!profile) {
      flipbookLogger.warn(`No active profiling session for operation: ${operation}`, {
        component: 'FlipbookProfiler',
      });
      return;
    }

    const currentTime = performance.now();
    
    // End previous phase if exists
    if (profile.phases.length > 0) {
      const lastPhase = profile.phases[profile.phases.length - 1];
      if (!lastPhase.endTime) {
        lastPhase.endTime = currentTime;
      }
    }

    // Start new phase
    profile.phases.push({
      name: phaseName,
      startTime: currentTime,
      metrics,
    });

    flipbookLogger.debug(`Added phase to profiling: ${phaseName}`, {
      component: 'FlipbookProfiler',
    }, {
      operation,
      phaseName,
      phaseStartTime: currentTime,
      metrics,
    });
  }

  /**
   * End profiling and generate performance profile
   */
  public endProfiling(operation: string): PerformanceProfile | null {
    if (!isDevelopment) return null;

    const profile = this.activeProfiles.get(operation);
    if (!profile) {
      flipbookLogger.warn(`No active profiling session for operation: ${operation}`, {
        component: 'FlipbookProfiler',
      });
      return null;
    }

    const endTime = performance.now();
    const totalDuration = endTime - profile.startTime;

    // End last phase
    if (profile.phases.length > 0) {
      const lastPhase = profile.phases[profile.phases.length - 1];
      if (!lastPhase.endTime) {
        lastPhase.endTime = endTime;
      }
    }

    // Generate performance profile
    const performanceProfile = this.generatePerformanceProfile(
      operation,
      totalDuration,
      profile
    );

    // Clean up
    this.activeProfiles.delete(operation);

    flipbookLogger.info(`Completed profiling: ${operation}`, {
      component: 'FlipbookProfiler',
    }, {
      operation,
      totalDuration,
      phases: performanceProfile.phases.length,
      bottlenecks: performanceProfile.bottlenecks.length,
      suggestions: performanceProfile.optimizationSuggestions.length,
    });

    return performanceProfile;
  }

  /**
   * Generate comprehensive performance profile
   */
  private generatePerformanceProfile(
    operation: string,
    totalDuration: number,
    profileData: any
  ): PerformanceProfile {
    const phases = this.analyzePhases(profileData.phases, totalDuration);
    const bottlenecks = this.config.enableBottleneckDetection ? 
      this.detectBottlenecks(phases, totalDuration) : [];
    const optimizationSuggestions = this.config.enableOptimizationSuggestions ? 
      this.generateOptimizationSuggestions(operation, phases, bottlenecks, totalDuration) : [];
    const memoryUsage = this.config.enableMemoryProfiling ? 
      this.analyzeMemoryUsage(profileData.memoryStart) : undefined;
    const networkProfile = this.config.enableNetworkProfiling ? 
      this.analyzeNetworkProfile(profileData.networkStart) : undefined;

    return {
      operation,
      totalDuration,
      phases,
      bottlenecks,
      optimizationSuggestions,
      memoryUsage,
      networkProfile,
    };
  }

  /**
   * Analyze individual phases
   */
  private analyzePhases(phases: any[], totalDuration: number): PhaseProfile[] {
    return phases.map((phase, index) => {
      const duration = (phase.endTime || performance.now()) - phase.startTime;
      const percentage = (duration / totalDuration) * 100;
      const isBottleneck = duration > this.config.performanceThresholds.slowOperation;

      return {
        name: phase.name,
        duration,
        percentage,
        isBottleneck,
        metrics: phase.metrics || {},
      };
    });
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(phases: PhaseProfile[], totalDuration: number): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check overall operation duration
    if (totalDuration > this.config.performanceThresholds.maxAcceptableLoadTime) {
      bottlenecks.push({
        phase: 'overall',
        severity: 'critical',
        description: `Total operation time (${Math.round(totalDuration)}ms) exceeds maximum acceptable limit`,
        impact: 'Poor user experience, potential user abandonment',
        suggestedFix: 'Implement progressive loading, optimize critical path, add caching',
        estimatedImprovement: '50-70% reduction in load time',
      });
    } else if (totalDuration > this.config.performanceThresholds.acceptableLoadTime) {
      bottlenecks.push({
        phase: 'overall',
        severity: 'high',
        description: `Total operation time (${Math.round(totalDuration)}ms) is slower than optimal`,
        impact: 'Suboptimal user experience',
        suggestedFix: 'Optimize slow phases, implement parallel processing',
        estimatedImprovement: '30-50% reduction in load time',
      });
    }

    // Check individual phases
    phases.forEach(phase => {
      if (phase.percentage > 40) {
        bottlenecks.push({
          phase: phase.name,
          severity: phase.percentage > 60 ? 'critical' : 'high',
          description: `Phase "${phase.name}" takes ${Math.round(phase.percentage)}% of total time`,
          impact: 'Major contributor to slow loading',
          suggestedFix: this.getSuggestedFixForPhase(phase.name),
          estimatedImprovement: `${Math.round(phase.percentage * 0.3)}-${Math.round(phase.percentage * 0.5)}% improvement`,
        });
      } else if (phase.duration > this.config.performanceThresholds.slowOperation) {
        bottlenecks.push({
          phase: phase.name,
          severity: phase.duration > this.config.performanceThresholds.verySlowOperation ? 'high' : 'medium',
          description: `Phase "${phase.name}" is slower than expected (${Math.round(phase.duration)}ms)`,
          impact: 'Contributes to overall slow performance',
          suggestedFix: this.getSuggestedFixForPhase(phase.name),
          estimatedImprovement: '20-40% improvement in this phase',
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Get suggested fix for specific phase
   */
  private getSuggestedFixForPhase(phaseName: string): string {
    const phaseOptimizations: Record<string, string> = {
      'fetching_metadata': 'Implement metadata caching, optimize database queries',
      'downloading_pdf': 'Use CDN, implement progressive download, compress PDFs',
      'processing_pdf': 'Optimize PDF parsing, use web workers, implement chunked processing',
      'rendering': 'Optimize DOM updates, use virtual scrolling, implement lazy loading',
      'tracking_view': 'Make analytics async, batch requests, use local storage',
    };

    return phaseOptimizations[phaseName] || 'Optimize algorithm, reduce complexity, implement caching';
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    operation: string,
    phases: PhaseProfile[],
    bottlenecks: Bottleneck[],
    totalDuration: number
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Performance suggestions
    if (totalDuration > this.config.performanceThresholds.acceptableLoadTime) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Implement Progressive Loading',
        description: 'Load and display content incrementally to improve perceived performance',
        implementation: 'Show flipbook metadata immediately, load PDF in background, display pages as they become available',
        estimatedBenefit: '40-60% improvement in perceived load time',
        effort: 'medium',
      });

      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'Add Intelligent Caching',
        description: 'Cache processed PDFs and metadata to speed up subsequent loads',
        implementation: 'Implement browser storage for processed PDF data, cache flipbook metadata',
        estimatedBenefit: '70-90% improvement for repeat visits',
        effort: 'medium',
      });
    }

    // Network optimization suggestions
    const downloadPhase = phases.find(p => p.name.includes('download'));
    if (downloadPhase && downloadPhase.percentage > 30) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize PDF Delivery',
        description: 'Improve PDF download speed and efficiency',
        implementation: 'Use CDN for PDF hosting, implement PDF compression, add range requests support',
        estimatedBenefit: '30-50% reduction in download time',
        effort: 'high',
      });
    }

    // Processing optimization suggestions
    const processingPhase = phases.find(p => p.name.includes('processing'));
    if (processingPhase && processingPhase.percentage > 25) {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'Optimize PDF Processing',
        description: 'Improve PDF parsing and rendering performance',
        implementation: 'Use web workers for PDF processing, implement chunked processing, optimize memory usage',
        estimatedBenefit: '25-40% reduction in processing time',
        effort: 'high',
      });
    }

    // User experience suggestions
    if (bottlenecks.some(b => b.severity === 'critical' || b.severity === 'high')) {
      suggestions.push({
        category: 'user-experience',
        priority: 'high',
        title: 'Enhance Loading Feedback',
        description: 'Provide better user feedback during long operations',
        implementation: 'Add detailed progress indicators, show estimated time remaining, provide cancel options',
        estimatedBenefit: 'Significantly improved user satisfaction',
        effort: 'low',
      });
    }

    // Reliability suggestions
    if (operation.includes('error') || bottlenecks.some(b => b.phase.includes('timeout'))) {
      suggestions.push({
        category: 'reliability',
        priority: 'high',
        title: 'Improve Error Handling',
        description: 'Add robust error recovery and retry mechanisms',
        implementation: 'Implement exponential backoff retry, add fallback options, improve error messages',
        estimatedBenefit: '80-95% reduction in failed loads',
        effort: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Analyze memory usage
   */
  private analyzeMemoryUsage(memoryStart?: number): MemoryProfile | undefined {
    if (!memoryStart || !this.isMemoryAPIAvailable()) return undefined;

    const currentUsage = this.getMemoryUsage();
    const memoryIncrease = currentUsage - memoryStart;

    return {
      initialUsage: memoryStart,
      peakUsage: currentUsage, // Simplified - would need continuous monitoring for true peak
      finalUsage: currentUsage,
      memoryLeaks: memoryIncrease > 50 * 1024 * 1024, // 50MB threshold
      gcPressure: memoryIncrease > 100 * 1024 * 1024 ? 'high' : 
                  memoryIncrease > 25 * 1024 * 1024 ? 'medium' : 'low',
    };
  }

  /**
   * Analyze network profile
   */
  private analyzeNetworkProfile(networkStart?: any): NetworkProfile | undefined {
    if (!networkStart) return undefined;

    const currentNetwork = this.getNetworkInfo();
    const efficiency = this.calculateNetworkEfficiency(networkStart, currentNetwork);

    return {
      connectionType: currentNetwork.effectiveType || 'unknown',
      bandwidth: currentNetwork.downlink || 0,
      latency: currentNetwork.rtt || 0,
      efficiency,
      recommendedOptimizations: this.getNetworkOptimizations(currentNetwork, efficiency),
    };
  }

  /**
   * Calculate network efficiency
   */
  private calculateNetworkEfficiency(start: any, current: any): number {
    // Simplified efficiency calculation
    const bandwidthScore = Math.min((current.downlink || 1) / 10, 1); // Normalize to 10 Mbps
    const latencyScore = Math.max(1 - ((current.rtt || 100) / 1000), 0); // Normalize to 1000ms
    
    return (bandwidthScore + latencyScore) / 2;
  }

  /**
   * Get network optimization recommendations
   */
  private getNetworkOptimizations(networkInfo: any, efficiency: number): string[] {
    const optimizations: string[] = [];

    if (efficiency < 0.5) {
      optimizations.push('Implement aggressive caching');
      optimizations.push('Reduce PDF file sizes');
      optimizations.push('Use progressive loading');
    }

    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      optimizations.push('Provide low-quality preview option');
      optimizations.push('Implement offline mode');
    }

    if (networkInfo.rtt > 500) {
      optimizations.push('Minimize round trips');
      optimizations.push('Implement request batching');
    }

    return optimizations;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (!this.isMemoryAPIAvailable()) return 0;
    return (performance as any).memory.usedJSHeapSize;
  }

  /**
   * Check if memory API is available
   */
  private isMemoryAPIAvailable(): boolean {
    return typeof performance !== 'undefined' && 
           'memory' in performance && 
           typeof (performance as any).memory.usedJSHeapSize === 'number';
  }

  /**
   * Get network information
   */
  private getNetworkInfo(): any {
    const connection = (navigator as any).connection;
    return connection || {};
  }

  /**
   * Get performance profile for operation
   */
  public getProfile(operation: string): PerformanceProfile | null {
    // This would typically retrieve from storage or cache
    // For now, return null as profiles are generated on-demand
    return null;
  }

  /**
   * Analyze overall performance across all operations
   */
  public analyzeOverallPerformance(): {
    summary: any;
    trends: any[];
    recommendations: OptimizationSuggestion[];
  } {
    const performanceSummary = flipbookPerformanceMonitor.getPerformanceSummary();
    const failureAnalysis = flipbookPerformanceMonitor.getFailureAnalysis();

    const recommendations: OptimizationSuggestion[] = [];

    // Analyze success rates
    if (failureAnalysis.overallSuccessRate < 95) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        title: 'Improve Success Rate',
        description: `Current success rate is ${failureAnalysis.overallSuccessRate.toFixed(1)}%`,
        implementation: 'Analyze failure patterns, improve error handling, add retry mechanisms',
        estimatedBenefit: 'Increase success rate to >95%',
        effort: 'high',
      });
    }

    // Analyze load times
    if (performanceSummary.averageLoadTime > this.config.performanceThresholds.acceptableLoadTime) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize Load Times',
        description: `Average load time is ${performanceSummary.averageLoadTime.toFixed(0)}ms`,
        implementation: 'Implement caching, optimize critical path, use CDN',
        estimatedBenefit: `Reduce to <${this.config.performanceThresholds.acceptableLoadTime}ms`,
        effort: 'medium',
      });
    }

    return {
      summary: performanceSummary,
      trends: [], // Would implement trend analysis
      recommendations,
    };
  }

  /**
   * Get optimization suggestions
   */
  public getOptimizationSuggestions(): OptimizationSuggestion[] {
    return this.analyzeOverallPerformance().recommendations;
  }

  /**
   * Export profile data
   */
  public exportProfile(operation: string): string {
    const profile = this.getProfile(operation);
    const overallAnalysis = this.analyzeOverallPerformance();

    const exportData = {
      timestamp: new Date().toISOString(),
      operation,
      profile,
      overallAnalysis,
      config: this.config,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear all profiles
   */
  public clearProfiles(): void {
    this.activeProfiles.clear();
    flipbookLogger.info('Performance profiles cleared', {
      component: 'FlipbookProfiler',
    });
  }
}

// Create singleton instance
export const flipbookProfiler = new FlipbookProfiler();

// Convenience functions
export const startFlipbookProfiling = (operation: string) => {
  if (!isDevelopment) return;
  flipbookProfiler.startProfiling(operation);
};

export const addFlipbookProfilingPhase = (operation: string, phaseName: string, metrics?: any) => {
  if (!isDevelopment) return;
  flipbookProfiler.addPhase(operation, phaseName, metrics);
};

export const endFlipbookProfiling = (operation: string): PerformanceProfile | null => {
  if (!isDevelopment) return null;
  return flipbookProfiler.endProfiling(operation);
};

export const getFlipbookOptimizationSuggestions = (): OptimizationSuggestion[] => {
  if (!isDevelopment) return [];
  return flipbookProfiler.getOptimizationSuggestions();
};

export const analyzeFlipbookPerformance = () => {
  if (!isDevelopment) return null;
  return flipbookProfiler.analyzeOverallPerformance();
};