import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { errorHandler } from './errorHandling';

/**
 * Session timeout configuration
 */
const SESSION_CONFIG = {
  // Check session validity every 5 minutes
  VALIDITY_CHECK_INTERVAL: 5 * 60 * 1000,
  // Warn user 10 minutes before expiration
  EXPIRATION_WARNING_TIME: 10 * 60 * 1000,
  // Refresh token when it has less than 30 minutes left
  REFRESH_THRESHOLD: 30 * 60 * 1000,
  // Maximum time to wait for token refresh
  REFRESH_TIMEOUT: 10000,
} as const;

/**
 * Session state interface
 */
interface SessionState {
  isValid: boolean;
  expiresAt: number | null;
  timeUntilExpiry: number | null;
  needsRefresh: boolean;
  user: User | null;
}

/**
 * Session validation result interface
 */
interface SessionValidationResult {
  isValid: boolean;
  isCorrupted: boolean;
  errors: string[];
  warnings: string[];
  tokenIntegrity: boolean;
  userConsistency: boolean;
  expirationValid: boolean;
}

/**
 * Session corruption types
 */
type SessionCorruptionType = 
  | 'invalid-token-format'
  | 'expired-token'
  | 'missing-user-data'
  | 'inconsistent-expiration'
  | 'malformed-session'
  | 'token-signature-invalid';

/**
 * Session event types
 */
type SessionEvent = 
  | 'session-refreshed'
  | 'session-expired'
  | 'session-warning'
  | 'refresh-failed'
  | 'invalid-session';

/**
 * Session event callback
 */
type SessionEventCallback = (event: SessionEvent, data?: any) => void;

/**
 * Secure session manager for handling token refresh, validation, and timeout detection
 */
class SessionManager {
  private validityCheckInterval: NodeJS.Timeout | null = null;
  private eventCallbacks: Map<SessionEvent, Set<SessionEventCallback>> = new Map();
  private isRefreshing = false;
  private refreshPromise: Promise<Session | null> | null = null;
  private lastValidationResult: SessionValidationResult | null = null;
  private corruptionDetectionEnabled = true;
  private validationHistory: Array<{ timestamp: number; result: SessionValidationResult }> = [];

  /**
   * Initialize session monitoring
   */
  public initialize(): void {
    this.startValidityChecking();
    this.setupAuthStateListener();
  }

  /**
   * Clean up session monitoring
   */
  public cleanup(): void {
    if (this.validityCheckInterval) {
      clearInterval(this.validityCheckInterval);
      this.validityCheckInterval = null;
    }
    this.eventCallbacks.clear();
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  /**
   * Get current session state with security validation
   */
  public async getSessionState(): Promise<SessionState> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return {
          isValid: false,
          expiresAt: null,
          timeUntilExpiry: null,
          needsRefresh: false,
          user: null,
        };
      }

      if (!session) {
        return {
          isValid: false,
          expiresAt: null,
          timeUntilExpiry: null,
          needsRefresh: false,
          user: null,
        };
      }

      const now = Date.now() / 1000; // Convert to seconds
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = (expiresAt - now) * 1000; // Convert back to milliseconds
      
      return {
        isValid: timeUntilExpiry > 0,
        expiresAt: expiresAt * 1000, // Convert to milliseconds for consistency
        timeUntilExpiry: Math.max(0, timeUntilExpiry),
        needsRefresh: timeUntilExpiry < SESSION_CONFIG.REFRESH_THRESHOLD,
        user: session.user,
      };
    } catch (error) {
      console.error('Unexpected error getting session state:', error);
      return {
        isValid: false,
        expiresAt: null,
        timeUntilExpiry: null,
        needsRefresh: false,
        user: null,
      };
    }
  }

  /**
   * Refresh session token with automatic renewal and timeout handling
   */
  public async refreshSession(): Promise<Session | null> {
    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Validate session with comprehensive corruption detection
   */
  public async validateSession(): Promise<boolean> {
    try {
      // Perform comprehensive validation
      const validationResult = await this.validateSessionWithDetails();
      
      // Store validation result for history
      this.lastValidationResult = validationResult;
      this.addToValidationHistory(validationResult);
      
      if (!validationResult.isValid) {
        if (validationResult.isCorrupted) {
          console.error('Session corruption detected:', validationResult.errors);
          this.emitEvent('invalid-session', { 
            corruption: true, 
            errors: validationResult.errors 
          });
        } else {
          this.emitEvent('invalid-session');
        }
        return false;
      }

      // Check if session needs refresh
      const sessionState = await this.getSessionState();
      if (sessionState.needsRefresh) {
        try {
          const refreshedSession = await this.refreshSession();
          return refreshedSession !== null;
        } catch (error) {
          console.error('Session refresh failed during validation:', error);
          this.emitEvent('refresh-failed', { error });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Validate session with detailed corruption detection
   */
  public async validateSessionWithDetails(): Promise<SessionValidationResult> {
    const result: SessionValidationResult = {
      isValid: false,
      isCorrupted: false,
      errors: [],
      warnings: [],
      tokenIntegrity: false,
      userConsistency: false,
      expirationValid: false,
    };

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        result.errors.push(`Session retrieval error: ${error.message}`);
        return result;
      }

      if (!session) {
        result.errors.push('No active session found');
        return result;
      }

      // Validate token integrity
      result.tokenIntegrity = this.validateTokenIntegrity(session);
      if (!result.tokenIntegrity) {
        result.errors.push('Token integrity validation failed');
        result.isCorrupted = true;
      }

      // Validate user data consistency
      result.userConsistency = this.validateUserConsistency(session);
      if (!result.userConsistency) {
        result.errors.push('User data consistency validation failed');
        result.isCorrupted = true;
      }

      // Validate expiration
      result.expirationValid = this.validateExpiration(session);
      if (!result.expirationValid) {
        result.errors.push('Session expiration validation failed');
      }

      // Check for session corruption patterns
      const corruptionTypes = this.detectCorruptionPatterns(session);
      if (corruptionTypes.length > 0) {
        result.isCorrupted = true;
        result.errors.push(`Corruption detected: ${corruptionTypes.join(', ')}`);
      }

      // Overall validity check
      result.isValid = result.tokenIntegrity && result.userConsistency && result.expirationValid && !result.isCorrupted;

      return result;
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isCorrupted = true;
      return result;
    }
  }

  /**
   * Validate token integrity and format
   */
  private validateTokenIntegrity(session: Session): boolean {
    try {
      // Check if access token exists and has proper format
      if (!session.access_token || typeof session.access_token !== 'string') {
        return false;
      }

      // Basic JWT format validation (header.payload.signature)
      const tokenParts = session.access_token.split('.');
      if (tokenParts.length !== 3) {
        return false;
      }

      // Check if each part is base64 encoded
      for (const part of tokenParts) {
        if (!part || part.length === 0) {
          return false;
        }
        
        try {
          // Attempt to decode base64
          atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        } catch {
          return false;
        }
      }

      // Check refresh token if present
      if (session.refresh_token) {
        if (typeof session.refresh_token !== 'string' || session.refresh_token.length < 10) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Token integrity validation error:', error);
      return false;
    }
  }

  /**
   * Validate user data consistency
   */
  private validateUserConsistency(session: Session): boolean {
    try {
      if (!session.user) {
        return false;
      }

      const user = session.user;

      // Check required user fields
      if (!user.id || typeof user.id !== 'string') {
        return false;
      }

      if (!user.email || typeof user.email !== 'string') {
        return false;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        return false;
      }

      // Check timestamps
      if (!user.created_at || !user.updated_at) {
        return false;
      }

      // Validate timestamp format
      const createdAt = new Date(user.created_at);
      const updatedAt = new Date(user.updated_at);
      
      if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
        return false;
      }

      // Check logical timestamp order
      if (createdAt > updatedAt) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('User consistency validation error:', error);
      return false;
    }
  }

  /**
   * Validate session expiration
   */
  private validateExpiration(session: Session): boolean {
    try {
      if (!session.expires_at || typeof session.expires_at !== 'number') {
        return false;
      }

      const now = Date.now() / 1000;
      const expiresAt = session.expires_at;

      // Check if expiration is in the future
      if (expiresAt <= now) {
        return false;
      }

      // Check if expiration is reasonable (not too far in the future)
      const maxValidDuration = 24 * 60 * 60; // 24 hours
      if (expiresAt - now > maxValidDuration) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Expiration validation error:', error);
      return false;
    }
  }

  /**
   * Detect specific corruption patterns
   */
  private detectCorruptionPatterns(session: Session): SessionCorruptionType[] {
    const corruptionTypes: SessionCorruptionType[] = [];

    try {
      // Check for malformed session structure
      if (!session || typeof session !== 'object') {
        corruptionTypes.push('malformed-session');
        return corruptionTypes;
      }

      // Check token format issues
      if (!this.validateTokenIntegrity(session)) {
        corruptionTypes.push('invalid-token-format');
      }

      // Check for expired tokens
      if (!this.validateExpiration(session)) {
        corruptionTypes.push('expired-token');
      }

      // Check for missing user data
      if (!session.user || !session.user.id || !session.user.email) {
        corruptionTypes.push('missing-user-data');
      }

      // Check for inconsistent expiration
      if (session.expires_at && session.expires_in) {
        const calculatedExpiry = Math.floor(Date.now() / 1000) + session.expires_in;
        const actualExpiry = session.expires_at;
        
        // Allow 60 second tolerance
        if (Math.abs(calculatedExpiry - actualExpiry) > 60) {
          corruptionTypes.push('inconsistent-expiration');
        }
      }

      return corruptionTypes;
    } catch (error) {
      console.error('Corruption pattern detection error:', error);
      corruptionTypes.push('malformed-session');
      return corruptionTypes;
    }
  }

  /**
   * Add validation result to history for pattern analysis
   */
  private addToValidationHistory(result: SessionValidationResult): void {
    const historyEntry = {
      timestamp: Date.now(),
      result: { ...result },
    };

    this.validationHistory.push(historyEntry);

    // Keep only last 50 entries
    if (this.validationHistory.length > 50) {
      this.validationHistory = this.validationHistory.slice(-50);
    }
  }

  /**
   * Get validation history for debugging
   */
  public getValidationHistory(): Array<{ timestamp: number; result: SessionValidationResult }> {
    return [...this.validationHistory];
  }

  /**
   * Get last validation result
   */
  public getLastValidationResult(): SessionValidationResult | null {
    return this.lastValidationResult;
  }

  /**
   * Enable or disable corruption detection
   */
  public setCorruptionDetection(enabled: boolean): void {
    this.corruptionDetectionEnabled = enabled;
  }

  /**
   * Add event listener for session events
   */
  public addEventListener(event: SessionEvent, callback: SessionEventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: SessionEvent, callback: SessionEventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventCallbacks.delete(event);
      }
    }
  }

  /**
   * Force session refresh (for manual refresh scenarios)
   */
  public async forceRefresh(): Promise<Session | null> {
    this.isRefreshing = false; // Reset refresh state to allow forced refresh
    this.refreshPromise = null;
    return this.refreshSession();
  }

  /**
   * Check if session is currently being refreshed
   */
  public isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Perform the actual token refresh with timeout handling
   */
  private async performTokenRefresh(): Promise<Session | null> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Session refresh timeout'));
        }, SESSION_CONFIG.REFRESH_TIMEOUT);
      });

      // Race between refresh and timeout
      const { data, error } = await Promise.race([
        supabase.auth.refreshSession(),
        timeoutPromise
      ]);

      if (error) {
        console.error('Session refresh error:', error);
        this.emitEvent('refresh-failed', { error });
        
        // Handle specific error types
        errorHandler.handleError(error, {
          component: 'SessionManager',
          operation: 'refreshSession',
        }, {
          showToast: false, // Let the calling component handle user feedback
          logError: true,
          reportError: true,
        });
        
        return null;
      }

      if (data.session) {
        this.emitEvent('session-refreshed', { session: data.session });
        return data.session;
      }

      return null;
    } catch (error) {
      console.error('Unexpected error during session refresh:', error);
      this.emitEvent('refresh-failed', { error });
      
      errorHandler.handleError(error, {
        component: 'SessionManager',
        operation: 'performTokenRefresh',
      }, {
        showToast: false,
        logError: true,
        reportError: true,
      });
      
      return null;
    }
  }

  /**
   * Start periodic session validity checking
   */
  private startValidityChecking(): void {
    // Clear any existing interval
    if (this.validityCheckInterval) {
      clearInterval(this.validityCheckInterval);
    }

    this.validityCheckInterval = setInterval(async () => {
      try {
        const sessionState = await this.getSessionState();
        
        if (!sessionState.isValid) {
          this.emitEvent('session-expired');
          return;
        }

        // Check if we should warn about upcoming expiration
        if (sessionState.timeUntilExpiry && 
            sessionState.timeUntilExpiry <= SESSION_CONFIG.EXPIRATION_WARNING_TIME &&
            sessionState.timeUntilExpiry > 0) {
          this.emitEvent('session-warning', { 
            timeUntilExpiry: sessionState.timeUntilExpiry 
          });
        }

        // Auto-refresh if needed
        if (sessionState.needsRefresh && !this.isRefreshing) {
          console.log('Auto-refreshing session token');
          await this.refreshSession();
        }
      } catch (error) {
        console.error('Error during session validity check:', error);
      }
    }, SESSION_CONFIG.VALIDITY_CHECK_INTERVAL);
  }

  /**
   * Setup auth state change listener
   */
  private setupAuthStateListener(): void {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        this.emitEvent('session-refreshed', { session });
      } else if (event === 'SIGNED_OUT') {
        this.cleanup();
      }
    });
  }

  /**
   * Emit session event to all listeners
   */
  private emitEvent(event: SessionEvent, data?: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error(`Error in session event callback for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export types for external use
export type { SessionState, SessionEvent, SessionEventCallback, SessionValidationResult, SessionCorruptionType };
export { SESSION_CONFIG };