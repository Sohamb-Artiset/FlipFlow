import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useErrorHandler } from '@/lib/errorHandling';
import { useFlipbooks } from '@/hooks/useFlipbooks';
import { useDeleteFlipbook } from '@/hooks/useFlipbookMutations';
import { useFlipbookPermissions } from '@/hooks/usePermissions';
import { planManager, PlanContext, getPlanUpgradePrompt } from '@/lib/planManager';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

export const useDashboard = () => {
  const { user, profile: authProfile, isLoading: authIsLoading } = useAuth();
  const profile = authProfile as Profile | null;
  const navigate = useNavigate();
  const { handleError, handleAsyncOperation } = useErrorHandler();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  
  const {
    data: flipbooks = [],
    isLoading: flipbooksLoading,
    error,
    refetch: refetchFlipbooks,
    isRefetching,
  } = useFlipbooks(user?.id);

  const isLoading = authIsLoading || flipbooksLoading;
  const isRefreshing = isRefetching;
  
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbooks.length,
    profile: profile,
  };
  
  const deleteFlipbookMutation = useDeleteFlipbook(user?.id || '', planContext);  useEf
fect(() => {
    if (authIsLoading) return;
    if (!user) {
      navigate('/auth');
