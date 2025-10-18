import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { queryOptions, handleQueryError } from '@/lib/queryUtils';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

/**
 * Hook to fetch flipbooks for a specific user using optimized React Query configuration
 * 
 * Features:
 * - Proper caching with 5-minute stale time
 * - Exponential backoff retry logic
 * - Consistent error handling
 * - Background refetching
 */
export const useFlipbooks = (userId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.flipbooks.byUser(userId || ''),
    queryFn: async (): Promise<Flipbook[]> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      console.log('Fetching flipbooks for user:', userId);

      // Get current session to ensure we're authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No valid session:', sessionError);
        throw new Error('Authentication required. Please sign in again.');
      }

      console.log('Session valid, fetching flipbooks...');

      const { data, error } = await supabase
        .from('flipbooks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching flipbooks:', error);
        throw new Error(`Failed to fetch flipbooks: ${error.message}`);
      }

      console.log('Flipbooks fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!userId, // Only run query when userId is available
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
    throwOnError: false, // Handle errors gracefully in components
  });
};

/**
 * Hook to fetch a single flipbook by ID
 */
export const useFlipbook = (flipbookId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.flipbooks.detail(flipbookId || ''),
    queryFn: async (): Promise<Flipbook> => {
      if (!flipbookId) {
        throw new Error('Flipbook ID is required');
      }

      const { data, error } = await supabase
        .from('flipbooks')
        .select('*')
        .eq('id', flipbookId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch flipbook: ${error.message}`);
      }

      return data;
    },
    enabled: !!flipbookId,
    ...queryOptions.flipbooks,
    throwOnError: false,
  });
};