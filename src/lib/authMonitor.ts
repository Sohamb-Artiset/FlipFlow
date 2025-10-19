/**
 * Comprehensive Authentication State Monitoring System
 * 
 * This module provides real-time monitoring, logging, and debugging
 * capabilities for the authentication system.
 */

import { sessionManager } from './sessionManager';
import { authStateSync } from './authStateSync';
import { uiStateManager } from './uiStateManager';
import { authErrorHandler } from './authErrorHandler';

// Monitoring event types
type MonitoringEvent = 
  | 'auth-state-change'
  | 'session-validation'
  | 'cross-tab-sync'
  | 'ui-update'
  | 'error-occurred'
  | 'recovery-attempted'
  | 'performance-metric'
  | 'health-check';

// Monitoring data interface
interface MonitoringData {
  event: MonitoringEvent;
  timestamp: number;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  userId?: string;
  sessionId?: string;
}

// Performance metrics
interface PerformanceMetrics {
  authStateChanges: number;
  sessionValidations: number;
  crossTabSyncs: number;
  uiUpdates: number;
  errors: number;
  recoveries: number;
  averageResponseTime: number;
  lastUpdateTime: number;
}

// System health status
interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    authContext: 'healthy' | 'degraded' | 'critical';
    sessionManager: 'healthy' | 'degraded' | 'critical';
    authStateSync: 'healthy' | 'degraded' | 'critical';
    uiStateManager: 'healthy' | 'degraded' | 'critical';
    errorHandler: 'healthy' | 'degraded' | 'critical';
  };
  lastCheck: number;
  issues: string[];
}

// Monitoring configuration
interface MonitoringConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  maxLogEntries: number;
  performanceTracking: boolean;
  healthCheckInterval: number;
  debugMode: boolean;
}

/**
 * AuthMonitor class for comprehensive system monitoring
 */
class AuthMonitor {
  private config: MonitoringConfig;
  private logs: MonitoringData[] = [];
  private metrics: PerformanceMetrics;
  private systemHealth: SystemHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<MonitoringEvent, Set<(data: MonitoringData) => void>> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: true,
      logLevel: 'info',
      maxLogEntries: 1000,
      performanceTracking: true,
      healthCheckInterval: 30000, // 30 seconds
      debugMode: false,
      ...config,
    };

    this.metrics = {
      authStateChanges: 0,
      sessionValidations: 0,
      crossTabSyncs: 0,
      uiUpdates: 0,
      errors: 0,
      recoveries: 0,
      averageResponseTime: 0,
      lastUpdateTime: Date.now(),
    };

    this.systemHealth = {
      overall: 'healthy',
      components: {
        authContext: 'healthy',
        sessionManager: 'healthy',
        authStateSync: 'healthy',
        uiStateManager: 'healthy',
        errorHandler: 'healthy',
      },
      lastCheck: Date.now(),
      issues: [],
    };
  }

  /**
   * Initialize monitoring system
   */
  public initialize(): void {
    if (!this.config.enabled) {
      console.log('Auth monitoring disabled');
      return;
    }

    console.log('Initializing auth monitoring system...');

    // Set up periodic health checks
    this.startHealthChecks();

    // Set up component monitoring
    this.setupComponentMonitoring();

    this.log('auth-state-change', 'info', 'monitor', {
      message: 'Auth monitoring system initialized',
      config: this.config,
    });
  }

  /**
   * Clean up monitoring system
   */
  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.eventListeners.clear();
    
    this.log('auth-state-change', 'info', 'monitor', {
      message: 'Auth monitoring system cleaned up',
    });
  }

  /**
   * Log monitoring event
   */
  public log(
    event: MonitoringEvent,
    severity: 'info' | 'warning' | 'error' | 'critical',
    component: string,
    data: any,
    userId?: string,
    sessionId?: string
  ): void {
    if (!this.config.enabled) return;

    const logEntry: MonitoringData = {
      event,
      timestamp: Date.now(),
      data,
      severity,
      component,
      userId,
      sessionId,
    };

    // Add to logs
    this.logs.push(logEntry);

    // Maintain log size limit
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }

    // Update metrics
    this.updateMetrics(event);

    // Console logging based on level
    if (this.shouldLog(severity)) {
      const logMessage = `[AuthMonitor] ${event} (${component}): ${JSON.stringify(data)}`;
      
      switch (severity) {
        case 'critical':
        case 'error':
          console.error(logMessage);
          break;
        case 'warning':
          console.warn(logMessage);
          break;
        case 'info':
        default:
          if (this.config.debugMode) {
            console.log(logMessage);
          }
          break;
      }
    }

    // Emit to listeners
    this.emitToListeners(event, logEntry);
  }

  /**
   * Get monitoring logs
   */
  public getLogs(filter?: {
    event?: MonitoringEvent;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    component?: string;
    since?: number;
  }): MonitoringData[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.event) {
        filteredLogs = filteredLogs.filter(log => log.event === filter.event);
      }
      if (filter.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filter.severity);
      }
      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.component === filter.component);
      }
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since);
      }
    }

    return filteredLogs;
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get system health status
   */
  public getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Add event listener
   */
  public addEventListener(
    event: MonitoringEvent,
    callback: (data: MonitoringData) => void
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Generate monitoring report
   */
  public generateReport(): {
    summary: {
      totalEvents: number;
      errorRate: number;
      recoveryRate: number;
      systemHealth: string;
    };
    metrics: PerformanceMetrics;
    recentErrors: MonitoringData[];
    healthStatus: SystemHealth;
  } {
    const recentLogs = this.getLogs({ since: Date.now() - 24 * 60 * 60 * 1000 }); // Last 24 hours
    const errors = recentLogs.filter(log => log.severity === 'error' || log.severity === 'critical');
    const recoveries = recentLogs.filter(log => log.event === 'recovery-attempted');

    return {
      summary: {
        totalEvents: recentLogs.length,
        errorRate: recentLogs.length > 0 ? (errors.length / recentLogs.length) * 100 : 0,
        recoveryRate: errors.length > 0 ? (recoveries.length / errors.length) * 100 : 0,
        systemHealth: this.systemHealth.overall,
      },
      metrics: this.getMetrics(),
      recentErrors: errors.slice(-10), // Last 10 errors
      healthStatus: this.getSystemHealth(),
    };
  }

  /**
   * Export logs for debugging
   */
  public exportLogs(): string {
    const report = this.generateReport();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      report,
      logs: this.logs,
    }, null, 2);
  }

  /**
   * Clear logs and reset metrics
   */
  public reset(): void {
    this.logs = [];
    this.metrics = {
      authStateChanges: 0,
      sessionValidations: 0,
      crossTabSyncs: 0,
      uiUpdates: 0,
      errors: 0,
      recoveries: 0,
      averageResponseTime: 0,
      lastUpdateTime: Date.now(),
    };

    this.log('auth-state-change', 'info', 'monitor', {
      message: 'Monitoring data reset',
    });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    setTimeout(() => this.performHealthCheck(), 1000);
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const newHealth: SystemHealth = {
      overall: 'healthy',
      components: {
        authContext: 'healthy',
        sessionManager: 'healthy',
        authStateSync: 'healthy',
        uiStateManager: 'healthy',
        errorHandler: 'healthy',
      },
      lastCheck: Date.now(),
      issues: [],
    };

    try {
      // Check SessionManager
      try {
        await sessionManager.getSessionState();
        newHealth.components.sessionManager = 'healthy';
      } catch (error) {
        newHealth.components.sessionManager = 'critical';
        newHealth.issues.push('SessionManager not responding');
      }

      // Check AuthStateSync
      try {
        authStateSync.getCurrentState();
        newHealth.components.authStateSync = 'healthy';
      } catch (error) {
        newHealth.components.authStateSync = 'critical';
        newHealth.issues.push('AuthStateSync not responding');
      }

      // Check UIStateManager
      try {
        uiStateManager.getSubscriptionCount();
        newHealth.components.uiStateManager = 'healthy';
      } catch (error) {
        newHealth.components.uiStateManager = 'critical';
        newHealth.issues.push('UIStateManager not responding');
      }

      // Check AuthErrorHandler
      try {
        authErrorHandler.getErrorStatistics();
        newHealth.components.errorHandler = 'healthy';
      } catch (error) {
        newHealth.components.errorHandler = 'critical';
        newHealth.issues.push('AuthErrorHandler not responding');
      }

      // Determine overall health
      const criticalComponents = Object.values(newHealth.components).filter(
        status => status === 'critical'
      ).length;
      
      const degradedComponents = Object.values(newHealth.components).filter(
        status => status === 'degraded'
      ).length;

      if (criticalComponents > 0) {
        newHealth.overall = 'critical';
      } else if (degradedComponents > 0) {
        newHealth.overall = 'degraded';
      } else {
        newHealth.overall = 'healthy';
      }

      this.systemHealth = newHealth;

      // Log health check results
      const responseTime = Date.now() - startTime;
      this.log('health-check', newHealth.overall === 'healthy' ? 'info' : 'warning', 'monitor', {
        health: newHealth,
        responseTime,
      });

    } catch (error) {
      console.error('Health check failed:', error);
      this.systemHealth.overall = 'critical';
      this.systemHealth.issues.push('Health check system failure');
      
      this.log('health-check', 'critical', 'monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Set up monitoring for individual components
   */
  private setupComponentMonitoring(): void {
    // Monitor auth state sync events
    authStateSync.addEventListener('state-updated', (event, data) => {
      this.log('cross-tab-sync', 'info', 'authStateSync', {
        event,
        data,
      });
    });

    authStateSync.addEventListener('conflict-detected', (event, data) => {
      this.log('cross-tab-sync', 'warning', 'authStateSync', {
        event: 'conflict',
        data,
      });
    });

    authStateSync.addEventListener('sync-error', (event, data) => {
      this.log('error-occurred', 'error', 'authStateSync', {
        event: 'sync-error',
        data,
      });
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(event: MonitoringEvent): void {
    switch (event) {
      case 'auth-state-change':
        this.metrics.authStateChanges++;
        break;
      case 'session-validation':
        this.metrics.sessionValidations++;
        break;
      case 'cross-tab-sync':
        this.metrics.crossTabSyncs++;
        break;
      case 'ui-update':
        this.metrics.uiUpdates++;
        break;
      case 'error-occurred':
        this.metrics.errors++;
        break;
      case 'recovery-attempted':
        this.metrics.recoveries++;
        break;
    }

    this.metrics.lastUpdateTime = Date.now();
  }

  /**
   * Check if log should be output based on level
   */
  private shouldLog(severity: 'info' | 'warning' | 'error' | 'critical'): boolean {
    const levels = ['info', 'warning', 'error', 'critical'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messagLevel = levels.indexOf(severity);
    
    return messagLevel >= configLevel;
  }

  /**
   * Emit event to listeners
   */
  private emitToListeners(event: MonitoringEvent, data: MonitoringData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in monitoring event callback for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const authMonitor = new AuthMonitor();

// Export types and class for external use
export type { MonitoringEvent, MonitoringData, PerformanceMetrics, SystemHealth, MonitoringConfig };
export { AuthMonitor };