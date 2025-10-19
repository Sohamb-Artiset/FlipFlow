import { useCallback } from 'react';
import { useErrorHandler } from '@/lib/errorHandling';
import { useDeleteFlipbook } from '@/hooks/useFlipbookMutations';
import { useFlipbookPermissions } from '@/hooks/usePermissions';
import { planManager, PlanContext, getPlanUpgradePrompt } from '@/lib/planManager';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

interface UseDashboardActionsProps {
  flipbooks: Flipbook[];
  userId?: string;
  planContext: PlanContext;
}

export const useDashboardActions = ({ flipbooks, userId, planContext }: UseDashboardActionsProps) => {
  const { handleError, handleAsyncOperation } = useErrorHandler();
  const deleteFlipbookMutation = useDeleteFlipbook(userId || '', planContext);

  const handleDeleteFlipbook = useCallback(async (flipbookId: string) => {
    const flipbook = flipbooks.find(fb => fb.id === flipbookId);
    if (!flipbook) {
      toast.error('Flipbook not found', {
        description: 'The flipbook you are trying to delete could not be found.',
      });
      return;
    }

    const permissions = useFlipbookPermissions(flipbook);
    if (!permissions.canDelete) {
      toast.error('Permission Denied', {
        description: 'You do not have permission to delete this flipbook. Only the owner can delete flipbooks.',
      });
      return;
    }

    const validation = planManager.validateAction('delete_flipbook', planContext);
    if (!validation.allowed) {
      const upgradePrompt = getPlanUpgradePrompt(
        planManager.getUsageSummary(planContext).plan,
        'delete_flipbook',
        planContext
      );
      toast.error(upgradePrompt.title, {
        description: upgradePrompt.message,
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this flipbook? This action cannot be undone.')) {
      return;
    }

    const result = await handleAsyncOperation(
      () => deleteFlipbookMutation.mutateAsync(flipbookId),
      { 
        component: 'Dashboard',
        operation: 'deleteFlipbook',
        userId: userId,
        metadata: { flipbookId }
      }
    );

    if (result !== null) {
      toast.success('Flipbook deleted successfully', {
        description: 'The flipbook has been permanently removed from your account.',
      });
    }
  }, [deleteFlipbookMutation, handleAsyncOperation, userId, planContext, flipbooks]);

  const handleShareFlipbook = useCallback(async (flipbookId: string) => {
    const url = `${window.location.origin}/flipbook/${flipbookId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link Copied!', {
        description: 'Flipbook URL has been copied to your clipboard.',
      });
    } catch (error) {
      handleError(error, {
        component: 'Dashboard',
        operation: 'copyToClipboard',
        metadata: { url },
      }, {
        showToast: false,
      });

      toast.info('Share this flipbook', {
        description: url,
        action: {
          label: 'Copy',
          onClick: () => {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              toast.success('Copied!', { description: 'URL copied to clipboard.' });
            } catch (err) {
              handleError(err, {
                component: 'Dashboard',
                operation: 'fallbackCopy',
              });
              toast.error('Copy Failed', { description: 'Please copy the URL manually.' });
            }
            document.body.removeChild(textArea);
          },
        },
      });
    }
  }, [handleError]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  return {
    handleDeleteFlipbook,
    handleShareFlipbook,
    formatDate,
    isDeleting: deleteFlipbookMutation.isPending,
  };
};