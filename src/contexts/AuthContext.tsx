import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { errorHandler } from '@/lib/errorHandling';
import { sessionManager, SessionEvent, SessionValidationResult } from '@/lib/sessionManager';
import { secureCleanupManager } from '@/lib/secureCleanup';
import { authStateSync, AuthStateSnapshot, AuthStateSyncEvent } from '@/lib/authStateSync';
import { uiStateManager, AuthState } from '@/lib/uiStateManager';
import { authErrorHandler, AuthError, RecoveryAction } from '@/lib/authErrorHandler';
import { authMonitor } from '@/lib/authMonitor';

// Extended profile type with plan field
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

// Profile validation types
interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedProfile?: Profile;
}

// Profile validation error types
type ProfileValidationError = 
  | 'MISSING_ID'
  | 'MISSING_EMAIL'
  | 'INVALID_EMAIL'
  | 'INVALID_PLAN'
  | 'MISSING_TIMESTAMPS';

// Sign-out state management types
type SignOutStep = 
  | 'clear-local-state'
  | 'clear-storage'
  | 'invalidate-session'
  | 'supabase-signout'
  | 'clear-query-cache';

interface SignOutState {
  isInProgress: boolean;
  error: string | null;
  completedSteps: SignOutStep[];
  failedSteps: SignOutStep[];
  currentStep: SignOutStep | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryProfileFetch: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isSessionValid: boolean;
  // Enhanced state management properties
  authStateVersion: number;
  lastStateUpdate: number;
  isSigningOut: boolean;
  signOutError: string | null;
  signOutState: SignOutState;
  // Error handling and recovery
  lastAuthError: AuthError | null;
  recoveryActions: RecoveryAction[];
  isRetrying: boolean;
  retryCount: number;
  // Enhanced methods
  forceStateRefresh: () => Promise<void>;
  validateAuthState: () => Promise<boolean>;
  clearSignOutError: () => void;
  subscribeToAuthChanges: (callback: (state: AuthState) => void) => () => void;
  retryLastOperation: () => Promise<void>;
  executeRecoveryAction: (action: RecoveryAction) => Promise<void>;
  clearAuthError: () => void;
  performSystemHealthCheck: () => Promise<{
    overall: boolean;
    components: Record<string, boolean>;
    issues: string[];
  }>;
  getMonitoringReport: () => any;
  exportDebugLogs: () => string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  retryProfileFetch: async () => {},
  refreshSession: async () => {},
  isSessionValid: false,
  // Enhanced state management properties
  authStateVersion: 0,
  lastStateUpdate: 0,
  isSigningOut: false,
  signOutError: null,
  signOutState: {
    isInProgress: false,
    error: null,
    completedSteps: [],
    failedSteps: [],
    currentStep: null,
  },
  // Error handling and recovery
  lastAuthError: null,
  recoveryActions: [],
  isRetrying: false,
  retryCount: 0,
  // Enhanced methods
  forceStateRefresh: async () => {},
  validateAuthState: async () => false,
  clearSignOutError: () => {},
  subscribeToAuthChanges: () => () => {},
  retryLastOperation: async () => {},
  executeRecoveryAction: async () => {},
  clearAuthError: () => {},
  performSystemHealthCheck: async () => ({
    overall: false,
    components: {},
    issues: [],
  }),
  getMonitoringReport: () => ({}),
  exportDebugLogs: () => '',
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionValid, setIsSessionValid] = useState(false);
  
  // Enhanced state management properties
  const [authStateVersion, setAuthStateVersion] = useState(0);
  const [lastStateUpdate, setLastStateUpdate] = useState(Date.now());
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signOutState, setSignOutState] = useState<SignOutState>({
    isInProgress: false,
    error: null,
    completedSteps: [],
    failedSteps: [],
    currentStep: null,
  });
  
  // Error handling and recovery state
  const [lastAuthError, setLastAuthError] = useState<AuthError | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailedOperation, setLastFailedOperation] = useState<(() => Promise<void>) | null>(null);
  
  const queryClient = useQueryClient();
  
  // Consolidated loading state
  const isLoading = authLoading || profileLoading;

  // Helper function to update auth state version and timestamp
  const updateAuthStateVersion = () => {
    setAuthStateVersion(prev => prev + 1);
    setLastStateUpdate(Date.now());
    
    // Log auth state change
    authMonitor.log('auth-state-change', 'info', 'AuthContext', {
      version: authStateVersion + 1,
      isAuthenticated: !!user && isSessionValid,
      userId: user?.id,
    }, user?.id);
    
    // Schedule UI update after state change
    setTimeout(() => updateUIComponents(), 0);
  };

  // Sign-out state management helpers
  const initializeSignOut = () => {
    setSignOutState({
      isInProgress: true,
      error: null,
      completedSteps: [],
      failedSteps: [],
      currentStep: null,
    });
    setIsSigningOut(true);
    setSignOutError(null);
    updateAuthStateVersion();
  };

  const updateSignOutStep = (step: SignOutStep, success: boolean, error?: string) => {
    setSignOutState(prev => ({
      ...prev,
      currentStep: success ? null : step,
      completedSteps: success ? [...prev.completedSteps, step] : prev.completedSteps,
      failedSteps: success ? prev.failedSteps : [...prev.failedSteps, step],
      error: success ? prev.error : (error || `Failed at step: ${step}`),
    }));
  };

  const completeSignOut = (success: boolean, finalError?: string) => {
    setSignOutState(prev => ({
      ...prev,
      isInProgress: false,
      currentStep: null,
      error: success ? null : (finalError || prev.error),
    }));
    setIsSigningOut(false);
    if (!success && finalError) {
      setSignOutError(finalError);
    }
    updateAuthStateVersion();
  };

  const resetSignOutState = () => {
    setSignOutState({
      isInProgress: false,
      error: null,
      completedSteps: [],
      failedSteps: [],
      currentStep: null,
    });
    setIsSigningOut(false);
    setSignOutError(null);
  };

  // Helper function to create AuthStateSnapshot from current state
  const createAuthStateSnapshot = (): AuthStateSnapshot => {
    return {
      isAuthenticated: !!user && isSessionValid,
      userId: user?.id || null,
      userEmail: user?.email || null,
      sessionExpiry: session?.expires_at ? session.expires_at * 1000 : null,
      profileLoaded: !!profile,
      lastUpdated: lastStateUpdate,
      version: authStateVersion,
    };
  };

  // Sync current auth state to other tabs
  const syncAuthState = () => {
    try {
      const snapshot = createAuthStateSnapshot();
      authStateSync.syncState(snapshot);
    } catch (error) {
      console.error('Failed to sync auth state:', error);
    }
  };

  // Helper function to create AuthState for UI components
  const createAuthState = (): AuthState => {
    return {
      isAuthenticated: !!user && isSessionValid,
      isLoading,
      user,
      error,
      isSigningOut,
      authStateVersion,
      lastStateUpdate,
    };
  };

  // Update UI components with current auth state
  const updateUIComponents = () => {
    try {
      const authState = createAuthState();
      uiStateManager.updateUIComponents(authState);
      
      // Log UI update
      authMonitor.log('ui-update', 'info', 'UIStateManager', {
        authState: {
          isAuthenticated: authState.isAuthenticated,
          isLoading: authState.isLoading,
          isSigningOut: authState.isSigningOut,
        },
        subscriptionCount: uiStateManager.getSubscriptionCount(),
      }, user?.id);
      
    } catch (error) {
      console.error('Failed to update UI components:', error);
      authMonitor.log('error-occurred', 'error', 'UIStateManager', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'updateUIComponents',
      }, user?.id);
    }
  };

  // Profile validation with typed error responses
  const validateProfile = (profileData: any): ProfileValidationResult => {
    const errors: string[] = [];

    // Validate required fields
    if (!profileData?.id) {
      errors.push('MISSING_ID');
    }

    if (!profileData?.email) {
      errors.push('MISSING_EMAIL');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.push('INVALID_EMAIL');
    }

    // Validate plan field
    const validPlans = ['free', 'premium'];
    if (profileData?.plan && !validPlans.includes(profileData.plan)) {
      errors.push('INVALID_PLAN');
    }

    // Validate timestamps
    if (!profileData?.created_at || !profileData?.updated_at) {
      errors.push('MISSING_TIMESTAMPS');
    }

    // Create sanitized profile with security-first defaults
    const sanitizedProfile: Profile = {
      id: profileData?.id || '',
      email: profileData?.email || '',
      full_name: profileData?.full_name || null,
      avatar_url: profileData?.avatar_url || null,
      plan: validPlans.includes(profileData?.plan) ? profileData.plan : 'free',
      created_at: profileData?.created_at || new Date().toISOString(),
      updated_at: profileData?.updated_at || new Date().toISOString()
    };

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedProfile
    };
  };

  // Create secure fallback profile for security-first approach
  const createSecureFallbackProfile = (userId: string, userEmail: string): Profile => {
    return {
      id: userId,
      email: userEmail,
      full_name: null,
      avatar_url: null,
      plan: 'free', // Always default to free plan for security
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };
  
  // Use refs to prevent race conditions and multiple fetches
  const profileFetchInProgress = useRef(false);
  const currentUserId = useRef<string | null>(null);

  // Atomic profile creation with proper error handling and validation
  const ensureProfile = async (userId: string, userEmail: string): Promise<Profile> => {
    try {
      // First, try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile && !fetchError) {
        // Validate existing profile data
        const validation = validateProfile(existingProfile);
        
        if (validation.isValid && validation.sanitizedProfile) {
          return validation.sanitizedProfile;
        } else {
          console.warn('Profile validation failed:', validation.errors);
          // Return sanitized profile with security-first defaults
          return validation.sanitizedProfile || createSecureFallbackProfile(userId, userEmail);
        }
      }

      // Log fetch error for debugging (except "not found" errors)
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching profile:', fetchError);
      }

      // If profile doesn't exist, create it atomically
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          plan: 'free' // Default to free plan
        } as any)
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        throw new Error(`Failed to create profile: ${createError.message}`);
      }

      // Validate newly created profile
      const validation = validateProfile(newProfile);
      if (validation.isValid && validation.sanitizedProfile) {
        return validation.sanitizedProfile;
      } else {
        console.warn('New profile validation failed:', validation.errors);
        return validation.sanitizedProfile || createSecureFallbackProfile(userId, userEmail);
      }
    } catch (error) {
      console.error('Unexpected error in ensureProfile:', error);
      throw error;
    }
  };

  const fetchOrCreateProfile = async (userId: string, userEmail: string) => {
    // Prevent multiple simultaneous profile fetches for the same user
    if (profileFetchInProgress.current && currentUserId.current === userId) {
      return;
    }

    // If we already have a profile for this user, don't fetch again
    if (profile && profile.id === userId) {
      return;
    }

    try {
      profileFetchInProgress.current = true;
      currentUserId.current = userId;
      setProfileLoading(true);
      setError(null);

      // Use atomic profile creation with proper error handling
      const userProfile = await ensureProfile(userId, userEmail);
      setProfile(userProfile);
    } catch (error) {
      // Use centralized error handling
      const errorReport = errorHandler.handleError(error, {
        component: 'AuthContext',
        operation: 'fetchOrCreateProfile',
        userId,
      }, {
        showToast: false, // We'll show custom toast below
        logError: true,
        reportError: true,
      });

      console.warn('Falling back to free plan restrictions for security. User:', userId);
      setError(errorReport.message);
      
      // Set secure fallback profile for RLS policy compliance
      const fallbackProfile = createSecureFallbackProfile(userId, userEmail);
      setProfile(fallbackProfile);

      // Show user-friendly error notification with recovery option
      toast.error('Profile Loading Issue', {
        description: 'Using default settings. Some features may be limited.',
        action: {
          label: 'Retry',
          onClick: () => retryProfileFetch(),
        },
      });
    } finally {
      profileFetchInProgress.current = false;
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        // Reset the current profile to force a fresh fetch
        setProfile(null);
        setError(null);
        profileFetchInProgress.current = false;
        
        // Fetch fresh profile data with validation
        await fetchOrCreateProfile(user.id, user.email!);
      } catch (error) {
        // Use centralized error handling
        const errorReport = errorHandler.handleError(error, {
          component: 'AuthContext',
          operation: 'refreshProfile',
          userId: user.id,
        });

        // Ensure we have a secure fallback even if refresh fails
        const fallbackProfile = createSecureFallbackProfile(user.id, user.email!);
        setProfile(fallbackProfile);
        setError(errorReport.message);
      }
    }
  };

  const retryProfileFetch = async () => {
    if (user) {
      try {
        setError(null);
        profileFetchInProgress.current = false;
        await fetchOrCreateProfile(user.id, user.email!);
      } catch (error) {
        // Use centralized error handling
        const errorReport = errorHandler.handleError(error, {
          component: 'AuthContext',
          operation: 'retryProfileFetch',
          userId: user.id,
        });

        // Ensure we have a secure fallback even if retry fails
        const fallbackProfile = createSecureFallbackProfile(user.id, user.email!);
        setProfile(fallbackProfile);
        setError(errorReport.message);
      }
    }
  };

  // Session management functions
  const refreshSession = async () => {
    try {
      const refreshedSession = await sessionManager.refreshSession();
      if (refreshedSession) {
        setSession(refreshedSession);
        setIsSessionValid(true);
        toast.success('Session Renewed', {
          description: 'Your session has been automatically renewed.',
        });
      } else {
        setIsSessionValid(false);
        toast.error('Session Refresh Failed', {
          description: 'Please sign in again to continue.',
        });
      }
    } catch (error) {
      console.error('Manual session refresh failed:', error);
      setIsSessionValid(false);
      toast.error('Session Refresh Failed', {
        description: 'Please sign in again to continue.',
      });
    }
  };

  // Enhanced auth state management methods
  const forceStateRefresh = async () => {
    try {
      updateAuthStateVersion();
      
      // Force refresh of session state
      const sessionState = await sessionManager.getSessionState();
      setIsSessionValid(sessionState.isValid);
      
      if (sessionState.user && sessionState.isValid) {
        setUser(sessionState.user);
        // Refresh profile if user is valid
        if (sessionState.user.email) {
          await fetchOrCreateProfile(sessionState.user.id, sessionState.user.email);
        }
      } else {
        // Clear state if session is invalid
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsSessionValid(false);
      }
    } catch (error) {
      console.error('Force state refresh failed:', error);
      // Use centralized error handling
      errorHandler.handleError(error, {
        component: 'AuthContext',
        operation: 'forceStateRefresh',
        userId: user?.id,
      });
    }
  };

  const validateAuthState = async (): Promise<boolean> => {
    try {
      // Get detailed validation result
      const validationResult = await sessionManager.validateSessionWithDetails();
      
      // Log validation attempt
      authMonitor.log('session-validation', validationResult.isValid ? 'info' : 'warning', 'SessionManager', {
        isValid: validationResult.isValid,
        isCorrupted: validationResult.isCorrupted,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      }, user?.id);
      
      if (!validationResult.isValid) {
        if (validationResult.isCorrupted) {
          console.error('Session corruption detected, initiating recovery:', validationResult.errors);
          await performAuthStateRecovery('corruption', validationResult);
        } else {
          console.warn('Invalid session detected, clearing state');
          await performAuthStateRecovery('invalid', validationResult);
        }
        return false;
      }

      // Validate consistency between local state and session
      const sessionState = await sessionManager.getSessionState();
      const hasInconsistency = 
        (!!user !== !!sessionState.user) ||
        (user?.id !== sessionState.user?.id) ||
        (isSessionValid !== sessionState.isValid);

      if (hasInconsistency) {
        console.warn('Auth state inconsistency detected, performing recovery...');
        await performAuthStateRecovery('inconsistency', validationResult);
      }

      return validationResult.isValid;
    } catch (error) {
      console.error('Auth state validation failed:', error);
      await performAuthStateRecovery('error', null);
      return false;
    }
  };

  const performAuthStateRecovery = async (
    reason: 'corruption' | 'invalid' | 'inconsistency' | 'error',
    validationResult?: SessionValidationResult | null
  ) => {
    console.log(`Performing auth state recovery for reason: ${reason}`);
    
    try {
      switch (reason) {
        case 'corruption':
          // For corrupted sessions, perform complete cleanup and sign out
          await performCorruptionRecovery(validationResult);
          break;
          
        case 'invalid':
          // For invalid sessions, clear state and attempt refresh
          await performInvalidSessionRecovery();
          break;
          
        case 'inconsistency':
          // For inconsistent state, try to refresh from server
          await performInconsistencyRecovery();
          break;
          
        case 'error':
          // For validation errors, perform safe cleanup
          await performErrorRecovery();
          break;
      }
    } catch (error) {
      console.error('Auth state recovery failed:', error);
      // Fallback to complete cleanup
      await performFallbackRecovery();
    }
  };

  const performCorruptionRecovery = async (validationResult?: SessionValidationResult | null) => {
    console.warn('Performing corruption recovery - clearing all auth data');
    
    try {
      // Clear all local state immediately
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsSessionValid(false);
      setError('Session corrupted - signed out for security');
      updateAuthStateVersion();
      
      // Clear from Supabase
      await supabase.auth.signOut();
      
      // Clear cross-tab state
      authStateSync.clearState();
      
      // Show user notification
      toast.error('Session Security Issue', {
        description: 'Your session was corrupted and has been cleared for security.',
      });
      
    } catch (error) {
      console.error('Corruption recovery failed:', error);
      await performFallbackRecovery();
    }
  };

  const performInvalidSessionRecovery = async () => {
    console.log('Performing invalid session recovery');
    
    try {
      // Try to refresh the session first
      const refreshedSession = await sessionManager.refreshSession();
      
      if (refreshedSession) {
        console.log('Session successfully refreshed during recovery');
        setSession(refreshedSession);
        setUser(refreshedSession.user);
        setIsSessionValid(true);
        updateAuthStateVersion();
        return;
      }
      
      // If refresh fails, clear state
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsSessionValid(false);
      updateAuthStateVersion();
      
      toast.info('Session Expired', {
        description: 'Your session has expired. Please sign in again.',
      });
      
    } catch (error) {
      console.error('Invalid session recovery failed:', error);
      await performFallbackRecovery();
    }
  };

  const performInconsistencyRecovery = async () => {
    console.log('Performing inconsistency recovery');
    
    try {
      // Force refresh from server state
      await forceStateRefresh();
      
      toast.info('Session Synchronized', {
        description: 'Your session has been synchronized across tabs.',
      });
      
    } catch (error) {
      console.error('Inconsistency recovery failed:', error);
      // Fall back to clearing state
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsSessionValid(false);
      updateAuthStateVersion();
    }
  };

  const performErrorRecovery = async () => {
    console.log('Performing error recovery');
    
    try {
      // Clear potentially corrupted state
      setError('Authentication error occurred');
      
      // Try to get fresh session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setSession(session);
        setUser(session.user);
        setIsSessionValid(true);
        setError(null);
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsSessionValid(false);
      }
      
      updateAuthStateVersion();
      
    } catch (error) {
      console.error('Error recovery failed:', error);
      await performFallbackRecovery();
    }
  };

  const performFallbackRecovery = async () => {
    console.warn('Performing fallback recovery - complete cleanup');
    
    try {
      // Complete state cleanup
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsSessionValid(false);
      setError('Authentication system error - please sign in again');
      updateAuthStateVersion();
      
      // Clear external state
      authStateSync.clearState();
      
      // Emergency cleanup
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('Emergency sign out failed:', signOutError);
      }
      
      toast.error('Authentication Error', {
        description: 'An authentication error occurred. Please sign in again.',
      });
      
    } catch (error) {
      console.error('Fallback recovery failed:', error);
      // At this point, we can only log the error
    }
  };

  const clearSignOutError = () => {
    setSignOutError(null);
  };

  const subscribeToAuthChanges = (callback: (state: AuthState) => void) => {
    return uiStateManager.subscribeToAuthChanges(callback, {
      component: 'AuthContext-subscriber',
    });
  };

  // Enhanced error handling methods
  const handleAuthError = (error: any, operation?: string, context?: Record<string, any>) => {
    try {
      const classification = authErrorHandler.classifyAndHandle(error, {
        ...context,
        operation,
        userId: user?.id,
        timestamp: Date.now(),
      });

      // Log error occurrence
      authMonitor.log('error-occurred', classification.authError.severity as any, 'AuthErrorHandler', {
        error: classification.authError,
        operation,
        context,
        recoveryActions: classification.recoveryActions.length,
      }, user?.id);

      // Update error state
      setLastAuthError(classification.authError);
      setRecoveryActions(classification.recoveryActions);

      // Show user-friendly error message
      const userMessage = authErrorHandler.generateUserMessage(classification.authError);
      
      if (classification.authError.severity === 'critical') {
        toast.error('Critical Authentication Error', {
          description: userMessage,
          action: classification.recoveryActions[0] ? {
            label: classification.recoveryActions[0].label,
            onClick: () => executeRecoveryAction(classification.recoveryActions[0]),
          } : undefined,
        });
      } else if (classification.authError.severity === 'high') {
        toast.error('Authentication Error', {
          description: userMessage,
          action: classification.recoveryActions[0] ? {
            label: classification.recoveryActions[0].label,
            onClick: () => executeRecoveryAction(classification.recoveryActions[0]),
          } : undefined,
        });
      } else {
        toast.warning('Authentication Issue', {
          description: userMessage,
          action: classification.recoveryActions[0] ? {
            label: classification.recoveryActions[0].label,
            onClick: () => executeRecoveryAction(classification.recoveryActions[0]),
          } : undefined,
        });
      }

      // Set up retry if applicable
      if (classification.shouldRetry && operation) {
        setLastFailedOperation(() => async () => {
          // This will be set by the calling function
        });
        
        if (classification.retryDelay) {
          setTimeout(() => {
            if (retryCount < 3) { // Max 3 retries
              retryLastOperation();
            }
          }, classification.retryDelay);
        }
      }

      return classification;
    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
      
      // Fallback error handling
      setLastAuthError({
        type: 'unknown',
        severity: 'medium',
        recoverable: true,
        userMessage: 'An unexpected error occurred',
        technicalDetails: error?.message || 'Unknown error',
        timestamp: Date.now(),
      });
      
      toast.error('Authentication Error', {
        description: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  const retryLastOperation = async () => {
    if (!lastFailedOperation || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // Log recovery attempt
    authMonitor.log('recovery-attempted', 'info', 'AuthContext', {
      retryCount: retryCount + 1,
      operation: 'retryLastOperation',
    }, user?.id);

    try {
      await lastFailedOperation();
      
      // Success - clear error state
      setLastAuthError(null);
      setRecoveryActions([]);
      setRetryCount(0);
      setLastFailedOperation(null);
      
      toast.success('Operation Successful', {
        description: 'The operation completed successfully after retry.',
      });
      
    } catch (error) {
      console.error('Retry failed:', error);
      handleAuthError(error, 'retry');
    } finally {
      setIsRetrying(false);
    }
  };

  const executeRecoveryAction = async (action: RecoveryAction) => {
    try {
      setIsRetrying(true);
      await action.action();
      
      // Clear error state after successful recovery
      setLastAuthError(null);
      setRecoveryActions([]);
      setRetryCount(0);
      
    } catch (error) {
      console.error('Recovery action failed:', error);
      handleAuthError(error, 'recovery');
    } finally {
      setIsRetrying(false);
    }
  };

  const clearAuthError = () => {
    setLastAuthError(null);
    setRecoveryActions([]);
    setRetryCount(0);
    setLastFailedOperation(null);
  };

  // System health check method
  const performSystemHealthCheck = async (): Promise<{
    overall: boolean;
    components: Record<string, boolean>;
    issues: string[];
  }> => {
    const healthCheck = {
      overall: true,
      components: {
        sessionManager: false,
        authStateSync: false,
        uiStateManager: false,
        authErrorHandler: false,
      },
      issues: [] as string[],
    };

    try {
      // Check SessionManager
      try {
        const sessionState = await sessionManager.getSessionState();
        healthCheck.components.sessionManager = true;
      } catch (error) {
        healthCheck.issues.push('SessionManager not responding');
        healthCheck.overall = false;
      }

      // Check AuthStateSync
      try {
        const currentState = authStateSync.getCurrentState();
        healthCheck.components.authStateSync = true;
      } catch (error) {
        healthCheck.issues.push('AuthStateSync not responding');
        healthCheck.overall = false;
      }

      // Check UIStateManager
      try {
        const subscriptionCount = uiStateManager.getSubscriptionCount();
        healthCheck.components.uiStateManager = true;
      } catch (error) {
        healthCheck.issues.push('UIStateManager not responding');
        healthCheck.overall = false;
      }

      // Check AuthErrorHandler
      try {
        const errorStats = authErrorHandler.getErrorStatistics();
        healthCheck.components.authErrorHandler = true;
      } catch (error) {
        healthCheck.issues.push('AuthErrorHandler not responding');
        healthCheck.overall = false;
      }

      return healthCheck;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        overall: false,
        components: healthCheck.components,
        issues: [...healthCheck.issues, 'Health check system failure'],
      };
    }
  };

  // Monitoring and debugging methods
  const getMonitoringReport = () => {
    return authMonitor.generateReport();
  };

  const exportDebugLogs = (): string => {
    return authMonitor.exportLogs();
  };

  // Session event handlers
  const handleSessionEvent = (event: SessionEvent, data?: any) => {
    switch (event) {
      case 'session-refreshed':
        setIsSessionValid(true);
        if (data?.session) {
          setSession(data.session);
        }
        updateAuthStateVersion();
        break;
      
      case 'session-expired':
        setIsSessionValid(false);
        updateAuthStateVersion();
        // Trigger automatic recovery for expired session
        performAuthStateRecovery('invalid');
        toast.error('Session Expired', {
          description: 'Your session has expired. Please sign in again.',
          action: {
            label: 'Sign In',
            onClick: () => window.location.href = '/auth',
          },
        });
        break;
      
      case 'session-warning':
        const minutes = Math.ceil((data?.timeUntilExpiry || 0) / (1000 * 60));
        toast.warning('Session Expiring Soon', {
          description: `Your session will expire in ${minutes} minutes.`,
          action: {
            label: 'Extend Session',
            onClick: refreshSession,
          },
        });
        break;
      
      case 'refresh-failed':
        setIsSessionValid(false);
        updateAuthStateVersion();
        console.error('Session refresh failed:', data?.error);
        // Trigger recovery for failed refresh
        performAuthStateRecovery('error');
        break;
      
      case 'invalid-session':
        setIsSessionValid(false);
        updateAuthStateVersion();
        // Check if corruption was detected
        if (data?.corruption) {
          performAuthStateRecovery('corruption');
        } else {
          performAuthStateRecovery('invalid');
        }
        break;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initialize all auth system components in proper order
    const initializeAuthSystem = async () => {
      try {
        console.log('Initializing enhanced authentication system...');
        
        // 1. Initialize session manager first
        sessionManager.initialize();
        
        // 2. Initialize auth state sync for cross-tab communication
        authStateSync.initialize();
        
        // 3. Initialize monitoring system
        authMonitor.initialize();
        
        // 4. Set up error handling
        clearAuthError();
        
        console.log('Authentication system initialized successfully');
        
        // Log successful initialization
        authMonitor.log('auth-state-change', 'info', 'AuthContext', {
          message: 'Auth system initialized',
          components: ['sessionManager', 'authStateSync', 'authMonitor'],
        });
      } catch (error) {
        console.error('Failed to initialize auth system:', error);
        handleAuthError(error, 'initialization');
      }
    };

    initializeAuthSystem();
    
    // Set up session event listeners
    sessionManager.addEventListener('session-refreshed', handleSessionEvent);
    sessionManager.addEventListener('session-expired', handleSessionEvent);
    sessionManager.addEventListener('session-warning', handleSessionEvent);
    sessionManager.addEventListener('refresh-failed', handleSessionEvent);
    sessionManager.addEventListener('invalid-session', handleSessionEvent);
    
    // Set up periodic auth state validation and recovery
    const validationInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        // Only validate if we have a user session
        if (user && session) {
          const isValid = await validateAuthState();
          if (!isValid) {
            console.log('Periodic validation detected invalid auth state');
          }
        }
      } catch (error) {
        console.error('Periodic auth validation error:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    // Set up periodic system health check
    const healthCheckInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const healthCheck = await performSystemHealthCheck();
        if (!healthCheck.overall) {
          console.warn('Auth system health issues detected:', healthCheck.issues);
          
          // Attempt to reinitialize failed components
          if (!healthCheck.components.sessionManager) {
            try {
              sessionManager.initialize();
            } catch (error) {
              console.error('Failed to reinitialize SessionManager:', error);
            }
          }
          
          if (!healthCheck.components.authStateSync) {
            try {
              authStateSync.initialize();
            } catch (error) {
              console.error('Failed to reinitialize AuthStateSync:', error);
            }
          }
        }
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
    
    // Set up auth state sync event listeners
    const handleAuthStateSyncEvent = (event: AuthStateSyncEvent, data?: any) => {
      if (!isMounted) return;
      
      switch (event) {
        case 'state-updated':
          if (data?.state && data.source !== 'local') {
            // Handle remote auth state update
            const remoteState = data.state as AuthStateSnapshot;
            console.log('Received remote auth state update:', remoteState);
            
            // Update local state to match remote state
            if (remoteState.isAuthenticated && remoteState.userId) {
              // Remote tab is authenticated - sync if we're not or have different user
              if (!user || user.id !== remoteState.userId) {
                console.log('Syncing to authenticated state from remote tab');
                // Force refresh to get the authenticated state
                forceStateRefresh();
              }
            } else if (!remoteState.isAuthenticated && user) {
              // Remote tab signed out - sign out locally too
              console.log('Syncing sign-out from remote tab');
              setUser(null);
              setSession(null);
              setProfile(null);
              setIsSessionValid(false);
              updateAuthStateVersion();
            }
          } else if (data?.cleared) {
            // Remote tab cleared state - clear locally too
            console.log('Clearing auth state due to remote clear');
            setUser(null);
            setSession(null);
            setProfile(null);
            setIsSessionValid(false);
            updateAuthStateVersion();
          }
          break;
          
        case 'conflict-detected':
          console.warn('Auth state conflict detected between tabs:', data);
          toast.warning('Session Conflict', {
            description: 'Multiple tabs have different login states. Resolving automatically.',
          });
          break;
          
        case 'sync-error':
          console.error('Auth state sync error:', data);
          break;
      }
    };
    
    authStateSync.addEventListener('state-updated', handleAuthStateSyncEvent);
    authStateSync.addEventListener('conflict-detected', handleAuthStateSyncEvent);
    authStateSync.addEventListener('sync-error', handleAuthStateSyncEvent);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setIsSessionValid(!!session);
        // When we receive an auth state change for the first time, auth has resolved
        setAuthLoading(false);
        // Update auth state version for any auth state change
        updateAuthStateVersion();
        
        // Sync auth state to other tabs after state update
        setTimeout(() => syncAuthState(), 100);
        
        if (session?.user) {
          // Fetch or create profile when user authenticates
          await fetchOrCreateProfile(session.user.id, session.user.email!);
        } else {
          // Clear profile and reset state when user signs out
          setProfile(null);
          setProfileLoading(false);
          setError(null);
          setIsSessionValid(false);
          profileFetchInProgress.current = false;
          currentUserId.current = null;
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setIsSessionValid(!!session);
      // Initial session check complete
      setAuthLoading(false);
      // Update auth state version for initial session
      updateAuthStateVersion();
      
      if (session?.user) {
        // Fetch or create profile for existing session
        await fetchOrCreateProfile(session.user.id, session.user.email!);
      }
      
      // Sync initial auth state to other tabs
      setTimeout(() => syncAuthState(), 100);
      
      // Initial UI update
      setTimeout(() => updateUIComponents(), 150);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      
      // Clean up session manager
      sessionManager.removeEventListener('session-refreshed', handleSessionEvent);
      sessionManager.removeEventListener('session-expired', handleSessionEvent);
      sessionManager.removeEventListener('session-warning', handleSessionEvent);
      sessionManager.removeEventListener('refresh-failed', handleSessionEvent);
      sessionManager.removeEventListener('invalid-session', handleSessionEvent);
      sessionManager.cleanup();
      
      // Clean up auth state sync
      authStateSync.removeEventListener('state-updated', handleAuthStateSyncEvent);
      authStateSync.removeEventListener('conflict-detected', handleAuthStateSyncEvent);
      authStateSync.removeEventListener('sync-error', handleAuthStateSyncEvent);
      authStateSync.cleanup();
      
      // Clean up UI state manager
      uiStateManager.cleanup();
      
      // Clean up validation interval
      if (validationInterval) {
        clearInterval(validationInterval);
      }
      
      // Clean up health check interval
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      
      // Clean up monitoring system
      authMonitor.cleanup();
    };
  }, []);

  const signOut = async (retryCount = 0) => {
    const signOutUserId = user?.id;
    const maxRetries = 3;
    
    // Initialize sign-out state tracking
    initializeSignOut();
    
    try {
      // Step 1: Clear local state immediately for better UX
      setSignOutState(prev => ({ ...prev, currentStep: 'clear-local-state' }));
      try {
        setUser(null);
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
        setError(null);
        setIsSessionValid(false);
        profileFetchInProgress.current = false;
        currentUserId.current = null;
        updateSignOutStep('clear-local-state', true);
      } catch (error) {
        console.error('Failed to clear local state:', error);
        updateSignOutStep('clear-local-state', false, 'Failed to clear local state');
        // Continue anyway - this is critical for security
      }

      // Step 2: Clear storage and cache
      setSignOutState(prev => ({ ...prev, currentStep: 'clear-storage' }));
      try {
        // Clear query cache first
        queryClient.clear();
        updateSignOutStep('clear-storage', true);
      } catch (error) {
        console.error('Failed to clear storage:', error);
        updateSignOutStep('clear-storage', false, 'Failed to clear cache');
        // Continue anyway
      }

      // Step 3: Invalidate session locally
      setSignOutState(prev => ({ ...prev, currentStep: 'invalidate-session' }));
      try {
        sessionManager.cleanup();
        updateSignOutStep('invalidate-session', true);
      } catch (error) {
        console.error('Failed to invalidate session:', error);
        updateSignOutStep('invalidate-session', false, 'Failed to invalidate session');
        // Continue anyway
      }

      // Step 4: Perform comprehensive secure cleanup
      setSignOutState(prev => ({ ...prev, currentStep: 'clear-query-cache' }));
      try {
        const cleanupResult = await secureCleanupManager.performSignOutCleanup(queryClient);
        if (cleanupResult.success) {
          updateSignOutStep('clear-query-cache', true);
        } else {
          console.warn('Some cleanup operations failed:', cleanupResult.errors);
          updateSignOutStep('clear-query-cache', false, 'Partial cleanup failure');
          // Continue with sign-out even if cleanup partially failed
        }
      } catch (error) {
        console.error('Secure cleanup failed:', error);
        updateSignOutStep('clear-query-cache', false, 'Secure cleanup failed');
        // Continue anyway
      }

      // Step 5: Sign out from Supabase server
      setSignOutState(prev => ({ ...prev, currentStep: 'supabase-signout' }));
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Supabase sign-out error:', error);
          updateSignOutStep('supabase-signout', false, error.message);
          
          // Handle specific error types using new error handler
          const classification = handleAuthError(error, 'signOut', { step: 'supabase-signout' });
          
          if (classification?.authError.type === 'network') {
            // For network errors, perform emergency cleanup and consider it successful
            try {
              secureCleanupManager.performQuickCleanup(queryClient);
            } catch (cleanupError) {
              console.error('Emergency cleanup failed:', cleanupError);
            }
            
            // Network failure - local cleanup is sufficient for security
            completeSignOut(true);
            
            // Clear auth state across all tabs even with network error
            authStateSync.clearState();
            
            toast.error('Sign Out Completed', {
              description: 'Network error occurred, but local data has been cleared for security.',
            });
            return;
          } else {
            // For other errors, attempt retry if we haven't exceeded max retries
            if (retryCount < maxRetries) {
              console.log(`Retrying sign-out (attempt ${retryCount + 1}/${maxRetries})`);
              completeSignOut(false, 'Sign-out failed, retrying...');
              return signOut(retryCount + 1);
            } else {
              // Max retries exceeded, but local state is cleared
              completeSignOut(false, error.message);
              toast.error('Sign Out Failed', {
                description: 'Server sign-out failed, but local data has been cleared for security.',
                action: {
                  label: 'Retry',
                  onClick: () => signOut(0),
                },
              });
              throw error;
            }
          }
        } else {
          updateSignOutStep('supabase-signout', true);
        }
      } catch (error) {
        console.error('Unexpected error during Supabase sign-out:', error);
        updateSignOutStep('supabase-signout', false, 'Unexpected sign-out error');
        
        // Attempt retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`Retrying sign-out (attempt ${retryCount + 1}/${maxRetries})`);
          completeSignOut(false, 'Sign-out failed, retrying...');
          return signOut(retryCount + 1);
        } else {
          completeSignOut(false, error instanceof Error ? error.message : 'Sign out failed');
          throw error;
        }
      }

      // All steps completed successfully
      completeSignOut(true);
      
      // Clear auth state across all tabs
      authStateSync.clearState();
      
      toast.success('Signed Out', {
        description: 'You have been securely signed out and all data cleared.',
      });

    } catch (error) {
      // Final error handling - ensure cleanup happens even if sign-out fails
      console.error('Critical sign-out error:', error);
      
      try {
        // Emergency cleanup to ensure security
        secureCleanupManager.performQuickCleanup(queryClient);
        sessionManager.cleanup();
      } catch (cleanupError) {
        console.error('Emergency cleanup failed:', cleanupError);
      }
      
      // Use enhanced error handling
      handleAuthError(error, 'signOut', {
        step: 'final-cleanup',
        userId: currentUserId,
      });
      
      // Complete sign-out with error state
      completeSignOut(false, error instanceof Error ? error.message : 'Critical sign-out error');
      
      // Re-throw the error so components can handle it
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      isLoading,
      error,
      signOut, 
      refreshProfile,
      retryProfileFetch,
      refreshSession,
      isSessionValid,
      // Enhanced state management properties
      authStateVersion,
      lastStateUpdate,
      isSigningOut,
      signOutError,
      signOutState,
      // Error handling and recovery
      lastAuthError,
      recoveryActions,
      isRetrying,
      retryCount,
      // Enhanced methods
      forceStateRefresh,
      validateAuthState,
      clearSignOutError,
      subscribeToAuthChanges,
      retryLastOperation,
      executeRecoveryAction,
      clearAuthError,
      performSystemHealthCheck,
      getMonitoringReport,
      exportDebugLogs
    }}>
      {children}
    </AuthContext.Provider>
  );
};