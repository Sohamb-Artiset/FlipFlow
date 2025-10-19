import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { planManager, PlanContext } from '@/lib/planManager';

export const useFlipbookAnalytics = (flipbookCount: number = 0) => {
  const { user, profile } = useAuth();

  // Create plan context for validation
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbookCount,
    profile: profile,
  };

  // Check if user can access analytics (premium feature)
  const analyticsValidation = planManager.validateAction('access_analytics', planContext);
  const trackView = useCallback(async (flipbookId: string) => {
    try {
      const userAgent = navigator.userAgent;
      const { error } = await supabase.rpc('record_flipbook_view', {
        p_flipbook_id: flipbookId,
        p_user_agent: userAgent,
      });
      if (error) {
        console.error('Error recording view:', error);
      }
    } catch (error) {
      // Use centralized error handling for analytics tracking
      const { errorHandler } = await import('@/lib/errorHandling');
      errorHandler.handleError(error, {
        component: 'useFlipbookAnalytics',
        operation: 'trackView',
        metadata: { flipbookId }
      }, {
        showToast: false, // Don't show toast for analytics errors
        logError: true,
        reportError: false // Analytics errors are less critical
      });
    }
  }, []);

  const getFlipbookStats = useCallback(async (flipbookId: string) => {
    // Check plan permissions for analytics access
    if (!analyticsValidation.allowed) {
      throw new Error('Analytics access requires Premium subscription');
    }

    try {
      // First check if user has access to this flipbook (owner only via RLS)
      const { data: flipbookData, error: flipbookError } = await supabase
        .from('flipbooks')
        .select('id, user_id')
        .eq('id', flipbookId)
        .single();

      if (flipbookError) {
        throw new Error('Flipbook not found or access denied');
      }

      // Now fetch views (RLS will ensure only owner can see)
      const { data, error } = await supabase
        .from('flipbook_views')
        .select('*')
        .eq('flipbook_id', flipbookId)
        .order('viewed_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch analytics');
      }

      return {
        totalViews: data?.length || 0,
        recentViews: data?.slice(0, 10) || [],
        views: data || [],
      };
    } catch (error) {
      // Use centralized error handling for stats fetching
      const { errorHandler } = await import('@/lib/errorHandling');
      errorHandler.handleError(error, {
        component: 'useFlipbookAnalytics',
        operation: 'getFlipbookStats',
        metadata: { flipbookId }
      }, {
        showToast: false,
        logError: true,
        reportError: false
      });

      return {
        totalViews: 0,
        recentViews: [],
        views: [],
      };
    }
  }, [analyticsValidation.allowed]);

  const getUserStats = useCallback(async (userId: string) => {
    // Check plan permissions for analytics access
    if (!analyticsValidation.allowed) {
      throw new Error('Analytics access requires Premium subscription');
    }

    try {
      const { data, error } = await supabase
        .from('flipbooks')
        .select('id, title, view_count, created_at, is_public')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch user stats');
      }

      const totalViews = data?.reduce((sum, flipbook) => sum + (flipbook.view_count || 0), 0) || 0;
      const publicFlipbooks = data?.filter(fb => fb.is_public).length || 0;
      const totalFlipbooks = data?.length || 0;

      return {
        totalViews,
        totalFlipbooks,
        publicFlipbooks,
        flipbooks: data || [],
      };
    } catch (error) {
      // Use centralized error handling for user stats fetching
      const { errorHandler } = await import('@/lib/errorHandling');
      errorHandler.handleError(error, {
        component: 'useFlipbookAnalytics',
        operation: 'getUserStats',
        metadata: { userId }
      }, {
        showToast: false,
        logError: true,
        reportError: false
      });

      return {
        totalViews: 0,
        totalFlipbooks: 0,
        publicFlipbooks: 0,
        flipbooks: [],
      };
    }
  }, [analyticsValidation.allowed]);

  return {
    trackView,
    getFlipbookStats,
    getUserStats,
    canAccessAnalytics: analyticsValidation.allowed,
    analyticsValidation,
  };
};
