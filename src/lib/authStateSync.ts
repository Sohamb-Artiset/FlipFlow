/**
 * AuthStateSync - Cross-tab authentication state synchronization
 * 
 * This module provides real-time synchronization of authentication state
 * across multiple browser tabs using BroadcastChannel API and localStorage
 * as a fallback for persistence across browser sessions.
 */

// Configuration interface for AuthStateSync
interface AuthStateSyncConfig {
  enableCrossTabSync: boolean;
  syncInterval: number;
  storageKey: string;
  channelName: string;
}

// Serializable authentication state snapshot
interface AuthStateSnapshot {
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  sessionExpiry: number | null;
  profileLoaded: boolean;
  lastUpdated: number;
  version: number;
}

// Event types for auth state changes
type AuthStateSyncEvent = 
  | 'state-updated'
  | 'conflict-detected'
  | 'sync-error'
  | 'tab-connected'
  | 'tab-disconnected';

// Event callback type
type AuthStateSyncCallback = (event: AuthStateSyncEvent, data?: any) => void;

// Default configuration
const DEFAULT_CONFIG: AuthStateSyncConfig = {
  enableCrossTabSync: true,
  syncInterval: 1000, // 1 second
  storageKey: 'auth-state-sync',
  channelName: 'auth-state-channel',
};

/**
 * AuthStateSync class for managing cross-tab authentication state synchronization
 */
class AuthStateSync {
  private config: AuthStateSyncConfig;
  private broadcastChannel: BroadcastChannel | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private eventCallbacks: Map<AuthStateSyncEvent, Set<AuthStateSyncCallback>> = new Map();
  private currentState: AuthStateSnapshot | null = null;
  private isInitialized = false;
  private tabId: string;

  constructor(config?: Partial<AuthStateSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the auth state synchronization system
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.warn('AuthStateSync already initialized');
      return;
    }

    try {
      // Initialize BroadcastChannel if supported and enabled
      if (this.config.enableCrossTabSync && typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(this.config.channelName);
        this.setupBroadcastChannelListeners();
      }

      // Load initial state from localStorage
      this.loadStateFromStorage();

      // Start periodic sync if interval is configured
      if (this.config.syncInterval > 0) {
        this.startPeriodicSync();
      }

      this.isInitialized = true;
      this.emitEvent('tab-connected', { tabId: this.tabId });
      
      console.log('AuthStateSync initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AuthStateSync:', error);
      this.emitEvent('sync-error', { error, operation: 'initialize' });
    }
  }

  /**
   * Clean up resources and stop synchronization
   */
  public cleanup(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Clear sync interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      // Close broadcast channel
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }

      // Clear event callbacks
      this.eventCallbacks.clear();

      this.isInitialized = false;
      this.emitEvent('tab-disconnected', { tabId: this.tabId });
      
      console.log('AuthStateSync cleaned up successfully');
    } catch (error) {
      console.error('Error during AuthStateSync cleanup:', error);
    }
  }

  /**
   * Synchronize current authentication state across tabs
   */
  public syncState(state: AuthStateSnapshot): void {
    if (!this.isInitialized) {
      console.warn('AuthStateSync not initialized, call initialize() first');
      return;
    }

    try {
      // Validate state before syncing
      const validatedState = this.validateState(state);
      if (!validatedState) {
        console.error('Invalid auth state provided for sync');
        return;
      }

      // Check for conflicts with existing state
      const hasConflict = this.detectStateConflict(validatedState);
      if (hasConflict) {
        this.handleStateConflict(validatedState);
        return;
      }

      // Update current state
      this.currentState = validatedState;

      // Persist to localStorage
      this.saveStateToStorage(validatedState);

      // Broadcast to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'state-update',
          state: validatedState,
          tabId: this.tabId,
          timestamp: Date.now(),
        });
      }

      this.emitEvent('state-updated', { state: validatedState });
    } catch (error) {
      console.error('Error syncing auth state:', error);
      this.emitEvent('sync-error', { error, operation: 'syncState' });
    }
  }

  /**
   * Get the current synchronized auth state
   */
  public getCurrentState(): AuthStateSnapshot | null {
    return this.currentState;
  }

  /**
   * Add event listener for auth state sync events
   */
  public addEventListener(event: AuthStateSyncEvent, callback: AuthStateSyncCallback): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: AuthStateSyncEvent, callback: AuthStateSyncCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventCallbacks.delete(event);
      }
    }
  }

  /**
   * Force refresh state from storage (useful for conflict resolution)
   */
  public refreshFromStorage(): AuthStateSnapshot | null {
    try {
      const state = this.loadStateFromStorage();
      if (state) {
        this.currentState = state;
        this.emitEvent('state-updated', { state, source: 'storage' });
      }
      return state;
    } catch (error) {
      console.error('Error refreshing state from storage:', error);
      this.emitEvent('sync-error', { error, operation: 'refreshFromStorage' });
      return null;
    }
  }

  /**
   * Clear all synchronized state (useful for sign-out)
   */
  public clearState(): void {
    try {
      this.currentState = null;
      
      // Clear from localStorage
      localStorage.removeItem(this.config.storageKey);

      // Broadcast clear to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'state-clear',
          tabId: this.tabId,
          timestamp: Date.now(),
        });
      }

      this.emitEvent('state-updated', { state: null, cleared: true });
    } catch (error) {
      console.error('Error clearing auth state:', error);
      this.emitEvent('sync-error', { error, operation: 'clearState' });
    }
  }

  /**
   * Setup BroadcastChannel message listeners
   */
  private setupBroadcastChannelListeners(): void {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.addEventListener('message', (event) => {
      try {
        const { type, state, tabId, timestamp } = event.data;

        // Ignore messages from the same tab
        if (tabId === this.tabId) {
          return;
        }

        switch (type) {
          case 'state-update':
            this.handleRemoteStateUpdate(state, tabId, timestamp);
            break;
          
          case 'state-clear':
            this.handleRemoteStateClear(tabId, timestamp);
            break;
          
          default:
            console.warn('Unknown broadcast message type:', type);
        }
      } catch (error) {
        console.error('Error handling broadcast message:', error);
        this.emitEvent('sync-error', { error, operation: 'handleBroadcast' });
      }
    });
  }

  /**
   * Handle state update from another tab
   */
  private handleRemoteStateUpdate(remoteState: AuthStateSnapshot, tabId: string, timestamp: number): void {
    if (!remoteState) return;

    // Validate remote state
    const validatedState = this.validateState(remoteState);
    if (!validatedState) {
      console.error('Invalid remote state received from tab:', tabId);
      return;
    }

    // Check for conflicts
    const hasConflict = this.detectStateConflict(validatedState);
    if (hasConflict) {
      this.handleStateConflict(validatedState, tabId);
      return;
    }

    // Update current state if remote state is newer
    if (!this.currentState || validatedState.lastUpdated > this.currentState.lastUpdated) {
      this.currentState = validatedState;
      this.saveStateToStorage(validatedState);
      this.emitEvent('state-updated', { state: validatedState, source: 'remote', tabId });
    }
  }

  /**
   * Handle state clear from another tab
   */
  private handleRemoteStateClear(tabId: string, timestamp: number): void {
    this.currentState = null;
    localStorage.removeItem(this.config.storageKey);
    this.emitEvent('state-updated', { state: null, cleared: true, source: 'remote', tabId });
  }

  /**
   * Validate auth state structure and data
   */
  private validateState(state: AuthStateSnapshot): AuthStateSnapshot | null {
    try {
      // Check required fields
      if (typeof state.isAuthenticated !== 'boolean') return null;
      if (typeof state.lastUpdated !== 'number') return null;
      if (typeof state.version !== 'number') return null;

      // Validate optional fields
      if (state.userId !== null && typeof state.userId !== 'string') return null;
      if (state.userEmail !== null && typeof state.userEmail !== 'string') return null;
      if (state.sessionExpiry !== null && typeof state.sessionExpiry !== 'number') return null;

      // Return sanitized state
      return {
        isAuthenticated: state.isAuthenticated,
        userId: state.userId,
        userEmail: state.userEmail,
        sessionExpiry: state.sessionExpiry,
        profileLoaded: Boolean(state.profileLoaded),
        lastUpdated: state.lastUpdated,
        version: state.version,
      };
    } catch (error) {
      console.error('State validation error:', error);
      return null;
    }
  }

  /**
   * Detect conflicts between current and new state
   */
  private detectStateConflict(newState: AuthStateSnapshot): boolean {
    if (!this.currentState) return false;

    // Check for significant conflicts
    const hasUserConflict = this.currentState.userId !== newState.userId;
    const hasAuthConflict = this.currentState.isAuthenticated !== newState.isAuthenticated;
    const hasVersionConflict = Math.abs(this.currentState.version - newState.version) > 10;

    return hasUserConflict || hasAuthConflict || hasVersionConflict;
  }

  /**
   * Handle state conflicts using timestamp-based resolution
   */
  private handleStateConflict(conflictingState: AuthStateSnapshot, sourceTabId?: string): void {
    console.warn('Auth state conflict detected', {
      current: this.currentState,
      conflicting: conflictingState,
      sourceTab: sourceTabId,
    });

    this.emitEvent('conflict-detected', {
      currentState: this.currentState,
      conflictingState,
      sourceTabId,
    });

    // Resolve conflict using timestamp (newer wins)
    if (!this.currentState || conflictingState.lastUpdated > this.currentState.lastUpdated) {
      console.log('Resolving conflict: accepting newer state');
      this.currentState = conflictingState;
      this.saveStateToStorage(conflictingState);
      this.emitEvent('state-updated', { 
        state: conflictingState, 
        source: 'conflict-resolution',
        resolved: true 
      });
    } else {
      console.log('Resolving conflict: keeping current state');
    }
  }

  /**
   * Load auth state from localStorage
   */
  private loadStateFromStorage(): AuthStateSnapshot | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return null;

      const state = JSON.parse(stored);
      return this.validateState(state);
    } catch (error) {
      console.error('Error loading state from storage:', error);
      // Clear corrupted data
      localStorage.removeItem(this.config.storageKey);
      return null;
    }
  }

  /**
   * Save auth state to localStorage
   */
  private saveStateToStorage(state: AuthStateSnapshot): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state to storage:', error);
      this.emitEvent('sync-error', { error, operation: 'saveToStorage' });
    }
  }

  /**
   * Start periodic synchronization check
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      try {
        // Check if storage state has changed (e.g., from another tab without BroadcastChannel)
        const storageState = this.loadStateFromStorage();
        if (storageState && 
            (!this.currentState || storageState.lastUpdated > this.currentState.lastUpdated)) {
          this.currentState = storageState;
          this.emitEvent('state-updated', { state: storageState, source: 'periodic-sync' });
        }
      } catch (error) {
        console.error('Error during periodic sync:', error);
      }
    }, this.config.syncInterval);
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: AuthStateSyncEvent, data?: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error(`Error in auth state sync callback for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const authStateSync = new AuthStateSync();

// Export types and class for external use
export type { AuthStateSnapshot, AuthStateSyncConfig, AuthStateSyncEvent, AuthStateSyncCallback };
export { AuthStateSync };