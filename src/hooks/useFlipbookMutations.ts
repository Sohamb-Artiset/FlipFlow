import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, getFlipbookInvalidationKeys } from '@/lib/queryKeys';
import { defaultMutationOptions } from '@/lib/queryUtils';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

/**
 * Hook for flipbook deletion with optimized cache invalidation
 */
export const useDeleteFlipbook = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flipbookId: string): Promise<void> => {
      const { error } = await supabase
        .from('flipbooks')
        .delete()
        .eq('id', flipbookId);

      if (error) {
        throw new Error(`Failed to delete flipbook: ${error.message}`);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch flipbook queries for this user
      const invalidationKeys = getFlipbookInvalidationKeys(userId);
      invalidationKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    ...defaultMutationOptions,
  });
};

/**
 * Hook for updating flipbook data with optimistic updates
 */
export const useUpdateFlipbook = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      flipbookId, 
      updates 
    }: { 
      flipbookId: string; 
      updates: Partial<Flipbook> 
    }): Promise<Flipbook> => {
      const { data, error } = await supabase
        .from('flipbooks')
        .update(updates)
        .eq('id', flipbookId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update flipbook: ${error.message}`);
      }

      return data;
    },
    onMutate: async ({ flipbookId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.flipbooks.detail(flipbookId) 
      });

      // Snapshot the previous value
      const previousFlipbook = queryClient.getQueryData(
        queryKeys.flipbooks.detail(flipbookId)
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.flipbooks.detail(flipbookId),
        (old: Flipbook | undefined) => old ? { ...old, ...updates } : undefined
      );

      return { previousFlipbook };
    },
    onError: (err, { flipbookId }, context) => {
      // Rollback on error
      if (context?.previousFlipbook) {
        queryClient.setQueryData(
          queryKeys.flipbooks.detail(flipbookId),
          context.previousFlipbook
        );
      }
    },
    onSettled: (data, error, { flipbookId }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.flipbooks.detail(flipbookId) 
      });
      
      // Also invalidate the user's flipbook list
      const invalidationKeys = getFlipbookInvalidationKeys(userId);
      invalidationKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    ...defaultMutationOptions,
  });
};