import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  signOut: async () => {},
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

  const fetchOrCreateProfile = async (userId: string, userEmail: string) => {
    try {
      // First, try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile && !fetchError) {
        // Ensure plan field exists and defaults to 'free' if null/undefined
        const profileWithPlan = {
          ...existingProfile,
          plan: existingProfile.plan || 'free'
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
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        console.warn('Falling back to free plan restrictions for user:', userId);
        // Set a fallback profile with free plan
        setProfile({
          id: userId,
          email: userEmail,
          full_name: null,
          avatar_url: null,
          plan: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return;
      }

      setProfile(newProfile);
    } catch (error) {
      console.error('Unexpected error in fetchOrCreateProfile:', error);
      console.warn('Falling back to free plan restrictions for security. User:', userId);
      // Set fallback profile with free plan for security
      setProfile({
        id: userId,
        email: userEmail,
        full_name: null,
        avatar_url: null,
        plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch or create profile when user authenticates
          await fetchOrCreateProfile(session.user.id, session.user.email!);
        } else {
          // Clear profile when user signs out
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch or create profile for existing session
        await fetchOrCreateProfile(session.user.id, session.user.email!);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};