import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// Extended profile type with plan field
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoadingProfile: boolean;
  profileError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryProfileFetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoadingProfile: false,
  profileError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  retryProfileFetch: async () => {},
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // Use refs to prevent race conditions and multiple fetches
  const profileFetchInProgress = useRef(false);
  const currentUserId = useRef<string | null>(null);

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
      setIsLoadingProfile(true);
      setProfileError(null);

      // First, try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile && !fetchError) {
        // Ensure plan field exists and defaults to 'free' if null/undefined
        const profileWithPlan: Profile = {
          ...existingProfile,
          plan: (existingProfile as any).plan || 'free'
        };
        setProfile(profileWithPlan);
        return;
      }

      // Log fetch error for debugging
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error fetching profile:', fetchError);
      }

      // If profile doesn't exist, create it
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
        console.warn('Falling back to free plan restrictions for user:', userId);
        // Set a fallback profile with free plan
        const fallbackProfile: Profile = {
          id: userId,
          email: userEmail,
          full_name: null,
          avatar_url: null,
          plan: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setProfile(fallbackProfile);
        return;
      }

      setProfile(newProfile as Profile);
    } catch (error) {
      console.error('Unexpected error in fetchOrCreateProfile:', error);
      console.warn('Falling back to free plan restrictions for security. User:', userId);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
      setProfileError(errorMessage);
      
      // Set fallback profile with free plan for security
      const fallbackProfile: Profile = {
        id: userId,
        email: userEmail,
        full_name: null,
        avatar_url: null,
        plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setProfile(fallbackProfile);

      // Show user-friendly error notification
      toast.error('Profile Loading Issue', {
        description: 'Using default settings. Some features may be limited.',
        action: {
          label: 'Retry',
          onClick: () => retryProfileFetch(),
        },
      });
    } finally {
      profileFetchInProgress.current = false;
      setIsLoadingProfile(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      // Reset the current profile to force a fresh fetch
      setProfile(null);
      setProfileError(null);
      profileFetchInProgress.current = false;
      await fetchOrCreateProfile(user.id, user.email!);
    }
  };

  const retryProfileFetch = async () => {
    if (user) {
      setProfileError(null);
      profileFetchInProgress.current = false;
      await fetchOrCreateProfile(user.id, user.email!);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch or create profile when user authenticates
          await fetchOrCreateProfile(session.user.id, session.user.email!);
        } else {
          // Clear profile and reset state when user signs out
          setProfile(null);
          setIsLoadingProfile(false);
          setProfileError(null);
          profileFetchInProgress.current = false;
          currentUserId.current = null;
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch or create profile for existing session
        await fetchOrCreateProfile(session.user.id, session.user.email!);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clear local state immediately for better UX
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoadingProfile(false);
      setProfileError(null);
      profileFetchInProgress.current = false;
      currentUserId.current = null;

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        
        // Enhanced error handling for sign out failures
        if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Sign Out Failed', {
            description: 'Network error. You may already be signed out.',
          });
        } else {
          toast.error('Sign Out Failed', {
            description: 'An error occurred while signing out. Please try again.',
            action: {
              label: 'Retry',
              onClick: () => signOut(),
            },
          });
        }
        
        throw error;
      }

      toast.success('Signed Out', {
        description: 'You have been successfully signed out.',
      });

      // Navigation is now handled by the calling component
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Re-throw the error so components can handle it
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      isLoadingProfile, 
      profileError,
      signOut, 
      refreshProfile,
      retryProfileFetch
    }}>
      {children}
    </AuthContext.Provider>
  );
};