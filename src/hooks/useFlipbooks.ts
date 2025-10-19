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

      // Trust AuthContext for authentication state - no redundant session validation
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
    ...queryOptions.flipbooks, // Use optimized query options with exponential backoff
    // Enhanced background refetching for stale data without loading indicators
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60 * 1000, // Background refetch every 5 minutes
    refetchIntervalInBackground: false, // Only refetch when tab is active
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
    // Background refetching for individual flipbooks
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    throwOnError: false,
  });
};