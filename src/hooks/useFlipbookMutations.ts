import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, getFlipbookListInvalidationKeys, getFlipbookDetailInvalidationKeys } from '@/lib/queryKeys';
import { Tables } from '@/integrations/supabase/types';
import { planManager, PlanContext } from '@/lib/planManager';

type Flipbook = Tables<'flipbooks'>;

/**
 * Hook for flipbook deletion with optimistic updates and rollback
 */
export const useDeleteFlipbook = (userId: string, planContext?: PlanContext) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (flipbookId: string): Promise<void> => {
      // Validate plan permissions for delete operation
      if (planContext) {
        const validation = planManager.validateAction('delete_flipbook', planContext);
        if (!validation.allowed) {
          throw new Error(validation.reason || 'Delete operation not allowed');
        }
      }

      const { error } = await supabase
        .from('flipbooks')
        .delete()
        .eq('id', flipbookId);

      if (error) {
        throw new Error(`Failed to delete flipbook: ${error.message}`);
      }
    },
    onMutate: async (flipbookId: string) => {
      // Cancel outgoing refetches for flipbook lists
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.flipbooks.list(userId) 
      });

      // Snapshot the previous flipbooks list
      const previousFlipbooks = queryClient.getQueryData<Flipbook[]>(
        queryKeys.flipbooks.list(userId)
      );

      // Optimistically remove the flipbook from the list
      queryClient.setQueryData(
        queryKeys.flipbooks.list(userId),
        (old: Flipbook[] | undefined) => 
          old ? old.filter(flipbook => flipbook.id !== flipbookId) : []
      );

      return { previousFlipbooks, flipbookId };
    },
    onError: (err, flipbookId, context: { previousFlipbooks?: Flipbook[]; flipbookId: string } | undefined) => {
      // Rollback on error - restore the previous flipbooks list
      if (context?.previousFlipbooks) {
        queryClient.setQueryData(
          queryKeys.flipbooks.list(userId),
          context.previousFlipbooks
        );
      }
    },
    onSettled: () => {
      // Precise cache invalidation - only invalidate flipbook lists for this user
      const invalidationKeys = getFlipbookListInvalidationKeys(userId);
      invalidationKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
};

/**
 * Hook for creating flipbook with optimistic updates
 */
export const useCreateFlipbook = (userId: string, planContext?: PlanContext) => {
  const queryClient = useQueryClient();

  return useMutation<Flipbook, Error, Omit<Flipbook, 'id' | 'created_at' | 'updated_at' | 'view_count'>>({
    mutationFn: async (flipbookData): Promise<Flipbook> => {
      // Validate plan permissions for create operation
      if (planContext) {
        const validation = planManager.validateAction('create_flipbook', planContext);
        if (!validation.allowed) {
          throw new Error(validation.reason || 'Create operation not allowed');
        }
      }

      const { data, error } = await supabase
        .from('flipbooks')
        .insert(flipbookData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create flipbook: ${error.message}`);
      }

      return data;
    },
    onMutate: async (newFlipbook) => {
      // Cancel outgoing refetches for flipbook lists
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.flipbooks.list(userId) 
      });

      // Snapshot the previous flipbooks list
      const previousFlipbooks = queryClient.getQueryData<Flipbook[]>(
        queryKeys.flipbooks.list(userId)
      );

      // Create optimistic flipbook with temporary data
      const optimisticFlipbook: Flipbook = {
        ...newFlipbook,
        id: `temp-${Date.now()}`, // Temporary ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        view_count: 0,
      };

      // Optimistically add the new flipbook to the list
      queryClient.setQueryData(
        queryKeys.flipbooks.list(userId),
        (old: Flipbook[] | undefined) => 
          old ? [optimisticFlipbook, ...old] : [optimisticFlipbook]
      );

      return { previousFlipbooks, optimisticFlipbook };
    },
    onError: (err, newFlipbook, context: { previousFlipbooks?: Flipbook[]; optimisticFlipbook: Flipbook } | undefined) => {
      // Rollback on error - restore the previous flipbooks list
      if (context?.previousFlipbooks) {
        queryClient.setQueryData(
          queryKeys.flipbooks.list(userId),
          context.previousFlipbooks
        );
      }
    },
    onSuccess: (data, variables, context) => {
      // Replace the optimistic entry with the real data
      queryClient.setQueryData(
        queryKeys.flipbooks.list(userId),
        (old: Flipbook[] | undefined) => {
          if (!old || !context?.optimisticFlipbook) return old;
          return old.map(flipbook => 
            flipbook.id === context.optimisticFlipbook.id ? data : flipbook
          );
        }
      );
    },
    onSettled: () => {
      // Precise cache invalidation - only invalidate flipbook lists for this user
      const invalidationKeys = getFlipbookListInvalidationKeys(userId);
      invalidationKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
};

/**
 * Hook for updating flipbook data with optimistic updates
 */
export const useUpdateFlipbook = (userId: string, planContext?: PlanContext) => {
  const queryClient = useQueryClient();

  return useMutation<Flipbook, Error, { flipbookId: string; updates: Partial<Flipbook> }>({
    mutationFn: async ({ 
      flipbookId, 
      updates 
    }: { 
      flipbookId: string; 
      updates: Partial<Flipbook> 
    }): Promise<Flipbook> => {
      // Validate plan permissions for update operation
      if (planContext) {
        const validation = planManager.validateAction('update_flipbook', planContext);
        if (!validation.allowed) {
          throw new Error(validation.reason || 'Update operation not allowed');
        }
      }

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
      const previousFlipbook = queryClient.getQueryData<Flipbook>(
        queryKeys.flipbooks.detail(flipbookId)
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.flipbooks.detail(flipbookId),
        (old: Flipbook | undefined) => old ? { ...old, ...updates } : undefined
      );

      return { previousFlipbook };
    },
    onError: (err, { flipbookId }, context: { previousFlipbook?: Flipbook } | undefined) => {
      // Rollback on error
      if (context?.previousFlipbook) {
        queryClient.setQueryData(
          queryKeys.flipbooks.detail(flipbookId),
          context.previousFlipbook
        );
      }
    },
    onSettled: (data, error, { flipbookId }) => {
      // Precise invalidation for the specific flipbook and user's list
      const invalidationKeys = getFlipbookDetailInvalidationKeys(flipbookId, userId);
      invalidationKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
};