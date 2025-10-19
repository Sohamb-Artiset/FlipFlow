/**
 * Comprehensive logging utility for flipbook loading operations
 * Provides structured logging with context capture for debugging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  flipbookId?: string;
  userId?: string;
  pdfUrl?: string;
  userAgent?: string;
  timestamp: string;
  sessionId: string;
  phase?: FlipbookLoadingPhase;
  operation?: string;
  component?: string;
}

export type FlipbookLoadingPhase = 
  | 'initialization'
  | 'fetching_metadata'
  | 'tracking_view'
  | 'downloading_pdf'
  | 'processing_pdf'
  | 'rendering'
  | 'complete'
  | 'error';

export interface FlipbookLogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  performance?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  metadata?: Record<string, any>;
}

class FlipbookLogger {
  private sessionId: string;
  private isDevelopment: boolean;
  private logs: FlipbookLogEntry[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createBaseContext(context: Partial<LogContext> = {}): LogContext {
    return {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      ...context,
    };
  }

  private formatMessage(message: string, context: LogContext): string {
    const prefix = `[FlipFlow:${context.component || 'Unknown'}:${context.phase || 'Unknown'}]`;
    return `${prefix} ${message}`;
  }

  private logToConsole(entry: FlipbookLogEntry): void {
    if (!this.isDevelopment) return;

    const formattedMessage = this.formatMessage(entry.message, entry.context);
    const logData = {
      context: entry.context,
      metadata: entry.metadata,
      performance: entry.performance,
      error: entry.error,
    };

    switch (entry.level) {
      case 'debug':
        console.debug(formattedMessage, logData);
        break;
      case 'info':
        console.info(formattedMessage, logData);
        break;
      case 'warn':
        console.warn(formattedMessage, logData);
        break;
      case 'error':
        console.error(formattedMessage, logData);
        break;
    }
  }

  private logToStructured(entry: FlipbookLogEntry): void {
    // Store for potential reporting to external services
    this.logs.push(entry);
    
    // Keep only last 100 logs to prevent memory issues
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  public log(
    level: LogLevel,
    message: string,
    context: Partial<LogContext> = {},
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    const fullContext = this.createBaseContext(context);
    const entry: FlipbookLogEntry = {
      level,
      message,
      context: fullContext,
      metadata,
      error,
    };

    this.logToConsole(entry);
    this.logToStructured(entry);
  }

  public debug(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }

  public info(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  public warn(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  public error(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, metadata, error);
  }

  public startTiming(operation: string, context?: Partial<LogContext>): string {
    const timingId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const startTime = performance.now();
    
    this.log('debug', `Starting ${operation}`, context, {
      timingId,
      startTime,
    });

    return timingId;
  }

  public endTiming(timingId: string, operation: string, context?: Partial<LogContext>, metadata?: Record<string, any>): number {
    const endTime = performance.now();
    const startEntry = this.logs.find(log => 
      log.metadata?.timingId === timingId && 
      log.message.includes(`Starting ${operation}`)
    );

    const startTime = startEntry?.metadata?.startTime || endTime;
    const duration = endTime - startTime;

    this.log('info', `Completed ${operation}`, context, {
      ...metadata,
      timingId,
      startTime,
      endTime,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
    });

    return duration;
  }

  public logPhaseTransition(
    fromPhase: FlipbookLoadingPhase | null,
    toPhase: FlipbookLoadingPhase,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ): void {
    const message = fromPhase 
      ? `Phase transition: ${fromPhase} → ${toPhase}`
      : `Starting phase: ${toPhase}`;

    this.info(message, { ...context, phase: toPhase }, {
      ...metadata,
      fromPhase,
      toPhase,
    });
  }

  public logError(
    error: Error,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ): void {
    this.error(
      `Error occurred: ${error.message}`,
      context,
      {
        ...metadata,
        errorName: error.name,
        errorStack: error.stack,
      },
      error
    );
  }

  public getSessionLogs(): FlipbookLogEntry[] {
    return [...this.logs];
  }

  public getLogsForFlipbook(flipbookId: string): FlipbookLogEntry[] {
    return this.logs.filter(log => log.context.flipbookId === flipbookId);
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public exportLogsForDebugging(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      logs: this.logs,
    }, null, 2);
  }
}

// Create singleton instance
export const flipbookLogger = new FlipbookLogger();

// Convenience functions for common logging patterns
export const logFlipbookOperation = (
  operation: string,
  flipbookId: string,
  phase: FlipbookLoadingPhase,
  metadata?: Record<string, any>
) => {
  flipbookLogger.info(operation, {
    flipbookId,
    phase,
    operation,
    component: 'FlipbookView',
  }, metadata);
};

export const logFlipbookError = (
  error: Error,
  flipbookId: string,
  phase: FlipbookLoadingPhase,
  operation?: string,
  metadata?: Record<string, any>
) => {
  flipbookLogger.logError(error, {
    flipbookId,
    phase,
    operation,
    component: 'FlipbookView',
  }, metadata);
};

export const startFlipbookTiming = (
  operation: string,
  flipbookId: string,
  phase: FlipbookLoadingPhase
): string => {
  return flipbookLogger.startTiming(operation, {
    flipbookId,
    phase,
    component: 'FlipbookView',
  });
};

export const endFlipbookTiming = (
  timingId: string,
  operation: string,
  flipbookId: string,
  phase: FlipbookLoadingPhase,
  metadata?: Record<string, any>
): number => {
  return flipbookLogger.endTiming(timingId, operation, {
    flipbookId,
    phase,
    component: 'FlipbookView',
  }, metadata);
};