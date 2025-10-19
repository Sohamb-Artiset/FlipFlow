/**
 * UIStateManager - Centralized UI state coordination for authentication
 * 
 * This module provides immediate UI updates when authentication state changes,
 * ensuring all components receive auth updates within the 500ms requirement.
 */

import { User } from '@supabase/supabase-js';

// Auth state interface for UI components
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  isSigningOut: boolean;
  authStateVersion: number;
  lastStateUpdate: number;
}

// UI update callback type
type AuthStateCallback = (state: AuthState) => void;

// Subscription interface
interface AuthStateSubscription {
  id: string;
  callback: AuthStateCallback;
  component?: string;
  priority?: number;
}

// UI update priority levels
enum UpdatePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// Performance metrics for monitoring
interface PerformanceMetrics {
  totalUpdates: number;
  averageUpdateTime: number;
  maxUpdateTime: number;
  failedUpdates: number;
  lastUpdateTimestamp: number;
}

/**
 * UIStateManager class for coordinating auth state updates across UI components
 */
class UIStateManager {
  private subscriptions: Map<string, AuthStateSubscription> = new Map();
  private currentState: AuthState | null = null;
  private updateQueue: Array<() => void> = [];
  private isProcessingUpdates = false;
  private performanceMetrics: PerformanceMetrics = {
    totalUpdates: 0,
    averageUpdateTime: 0,
    maxUpdateTime: 0,
    failedUpdates: 0,
    lastUpdateTimestamp: 0,
  };
  private updateTimeout: NodeJS.Timeout | null = null;

  /**
   * Subscribe to auth state changes with optional component identification
   */
  public subscribeToAuthChanges(
    callback: AuthStateCallback,
    options?: {
      component?: string;
      priority?: UpdatePriority;
    }
  ): () => void {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: AuthStateSubscription = {
      id: subscriptionId,
      callback,
      component: options?.component,
      priority: options?.priority ?? UpdatePriority.NORMAL,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Immediately call with current state if available
    if (this.currentState) {
      try {
        callback(this.currentState);
      } catch (error) {
        console.error(`Error in immediate auth state callback for ${options?.component}:`, error);
      }
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Update UI components with new auth state
   */
  public updateUIComponents(authState: AuthState): void {
    const startTime = performance.now();
    
    try {
      // Store the new state
      const previousState = this.currentState;
      this.currentState = { ...authState };

      // Check if this is a significant state change
      const hasSignificantChange = this.hasSignificantStateChange(previousState, authState);
      
      if (hasSignificantChange) {
        console.log('Significant auth state change detected, updating UI components');
      }

      // Queue updates based on priority
      this.queuePriorityUpdates(authState);

      // Process updates immediately for critical changes
      if (this.shouldProcessImmediately(previousState, authState)) {
        this.processUpdateQueue();
      } else {
        // Batch updates for better performance
        this.scheduleUpdateProcessing();
      }

      // Update performance metrics
      const updateTime = performance.now() - startTime;
      this.updatePerformanceMetrics(updateTime, true);

    } catch (error) {
      console.error('Error updating UI components:', error);
      this.updatePerformanceMetrics(performance.now() - startTime, false);
    }
  }

  /**
   * Handle auth state changes with previous state comparison
   */
  public handleAuthStateChange(newState: AuthState, previousState: AuthState | null): void {
    try {
      // Log state transition for debugging
      if (previousState) {
        console.log('Auth state transition:', {
          from: {
            isAuthenticated: previousState.isAuthenticated,
            isLoading: previousState.isLoading,
            isSigningOut: previousState.isSigningOut,
            version: previousState.authStateVersion,
          },
          to: {
            isAuthenticated: newState.isAuthenticated,
            isLoading: newState.isLoading,
            isSigningOut: newState.isSigningOut,
            version: newState.authStateVersion,
          },
        });
      }

      // Validate state transition
      if (!this.isValidStateTransition(previousState, newState)) {
        console.warn('Invalid auth state transition detected:', { previousState, newState });
      }

      // Update UI components
      this.updateUIComponents(newState);

      // Emit custom events for specific transitions
      this.emitStateTransitionEvents(previousState, newState);

    } catch (error) {
      console.error('Error handling auth state change:', error);
    }
  }

  /**
   * Get current auth state
   */
  public getCurrentState(): AuthState | null {
    return this.currentState;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear all subscriptions and reset state
   */
  public cleanup(): void {
    try {
      // Clear update timeout
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = null;
      }

      // Clear subscriptions
      this.subscriptions.clear();

      // Clear update queue
      this.updateQueue = [];
      this.isProcessingUpdates = false;

      // Reset state
      this.currentState = null;

      console.log('UIStateManager cleaned up successfully');
    } catch (error) {
      console.error('Error during UIStateManager cleanup:', error);
    }
  }

  /**
   * Force immediate update of all subscribed components
   */
  public forceUpdate(): void {
    if (!this.currentState) {
      console.warn('No current state available for force update');
      return;
    }

    console.log('Forcing immediate UI update for all components');
    this.updateUIComponents(this.currentState);
  }

  /**
   * Get subscription count for monitoring
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if there's a significant state change requiring immediate updates
   */
  private hasSignificantStateChange(previousState: AuthState | null, newState: AuthState): boolean {
    if (!previousState) return true;

    return (
      previousState.isAuthenticated !== newState.isAuthenticated ||
      previousState.isLoading !== newState.isLoading ||
      previousState.isSigningOut !== newState.isSigningOut ||
      (previousState.user?.id !== newState.user?.id) ||
      (!!previousState.error !== !!newState.error)
    );
  }

  /**
   * Queue updates based on priority
   */
  private queuePriorityUpdates(authState: AuthState): void {
    // Sort subscriptions by priority (highest first)
    const sortedSubscriptions = Array.from(this.subscriptions.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Queue updates
    this.updateQueue = sortedSubscriptions.map(subscription => () => {
      try {
        subscription.callback(authState);
      } catch (error) {
        console.error(`Error in auth state callback for ${subscription.component}:`, error);
        this.performanceMetrics.failedUpdates++;
      }
    });
  }

  /**
   * Determine if updates should be processed immediately
   */
  private shouldProcessImmediately(previousState: AuthState | null, newState: AuthState): boolean {
    if (!previousState) return true;

    // Process immediately for critical state changes
    return (
      previousState.isAuthenticated !== newState.isAuthenticated ||
      previousState.isSigningOut !== newState.isSigningOut ||
      (previousState.user?.id !== newState.user?.id)
    );
  }

  /**
   * Process the update queue immediately
   */
  private processUpdateQueue(): void {
    if (this.isProcessingUpdates) {
      return;
    }

    this.isProcessingUpdates = true;
    const startTime = performance.now();

    try {
      // Process all queued updates
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();
        if (update) {
          update();
        }
      }

      const processingTime = performance.now() - startTime;
      console.log(`Processed ${this.subscriptions.size} UI updates in ${processingTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('Error processing update queue:', error);
    } finally {
      this.isProcessingUpdates = false;
    }
  }

  /**
   * Schedule update processing with batching
   */
  private scheduleUpdateProcessing(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Batch updates within 16ms (one frame) for smooth UI
    this.updateTimeout = setTimeout(() => {
      this.processUpdateQueue();
      this.updateTimeout = null;
    }, 16);
  }

  /**
   * Validate state transition logic
   */
  private isValidStateTransition(previousState: AuthState | null, newState: AuthState): boolean {
    if (!previousState) return true;

    // Check for invalid transitions
    const invalidTransitions = [
      // Can't go from not loading to loading if already authenticated
      (!previousState.isLoading && newState.isLoading && previousState.isAuthenticated),
      // Can't be signing out and loading at the same time
      (newState.isSigningOut && newState.isLoading),
      // Can't be authenticated without a user
      (newState.isAuthenticated && !newState.user),
    ];

    return !invalidTransitions.some(condition => condition);
  }

  /**
   * Emit custom events for specific state transitions
   */
  private emitStateTransitionEvents(previousState: AuthState | null, newState: AuthState): void {
    if (!previousState) return;

    // Emit sign-in event
    if (!previousState.isAuthenticated && newState.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('auth:signed-in', { 
        detail: { user: newState.user } 
      }));
    }

    // Emit sign-out event
    if (previousState.isAuthenticated && !newState.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('auth:signed-out', { 
        detail: { previousUser: previousState.user } 
      }));
    }

    // Emit loading state changes
    if (previousState.isLoading !== newState.isLoading) {
      window.dispatchEvent(new CustomEvent('auth:loading-changed', { 
        detail: { isLoading: newState.isLoading } 
      }));
    }

    // Emit error state changes
    if (!!previousState.error !== !!newState.error) {
      window.dispatchEvent(new CustomEvent('auth:error-changed', { 
        detail: { error: newState.error } 
      }));
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(updateTime: number, success: boolean): void {
    this.performanceMetrics.totalUpdates++;
    this.performanceMetrics.lastUpdateTimestamp = Date.now();

    if (success) {
      // Update average time (rolling average)
      const totalTime = this.performanceMetrics.averageUpdateTime * (this.performanceMetrics.totalUpdates - 1) + updateTime;
      this.performanceMetrics.averageUpdateTime = totalTime / this.performanceMetrics.totalUpdates;

      // Update max time
      if (updateTime > this.performanceMetrics.maxUpdateTime) {
        this.performanceMetrics.maxUpdateTime = updateTime;
      }
    } else {
      this.performanceMetrics.failedUpdates++;
    }

    // Log performance warnings
    if (updateTime > 100) { // More than 100ms
      console.warn(`Slow auth UI update detected: ${updateTime.toFixed(2)}ms`);
    }
  }
}

// Export singleton instance
export const uiStateManager = new UIStateManager();

// Export types and class for external use
export type { AuthState, AuthStateCallback, AuthStateSubscription };
export { UIStateManager, UpdatePriority };