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

      const { data, error } = await supabase
        .from('flipbooks')
        .select('id,title,description,created_at,is_public,view_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch flipbooks: ${error.message}`);
      }

      return data || [];
    },
    enabled: !!userId, // Only run query when userId is available
    ...queryOptions.flipbooks, // Apply flipbook-specific cache settings
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