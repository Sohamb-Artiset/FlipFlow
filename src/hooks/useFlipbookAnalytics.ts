import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useFlipbookAnalytics = () => {
  const trackView = useCallback(async (flipbookId: string) => {
    try {
      // Get user's IP and user agent
      const userAgent = navigator.userAgent;
      
      // Insert view record
      await supabase
        .from('flipbook_views')
        .insert({
          flipbook_id: flipbookId,
          ip_address: null, // Will be handled by Supabase RLS
          user_agent: userAgent,
        });

      // Increment view count atomically
      await supabase.rpc('increment_view_count', { 
        flipbook_id: flipbookId 
      });

    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't throw error to avoid breaking user experience
    }
  }, []);

  const getFlipbookStats = useCallback(async (flipbookId: string) => {
    try {
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
      console.error('Error fetching flipbook stats:', error);
      return {
        totalViews: 0,
        recentViews: [],
        views: [],
      };
    }
  }, []);

  const getUserStats = useCallback(async (userId: string) => {
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
      console.error('Error fetching user stats:', error);
      return {
        totalViews: 0,
        totalFlipbooks: 0,
        publicFlipbooks: 0,
        flipbooks: [],
      };
    }
  }, []);

  return {
    trackView,
    getFlipbookStats,
    getUserStats,
  };
};
