/**
 * Flipbook Analytics Component
 * 
 * Displays analytics data for flipbooks with plan validation.
 * Shows upgrade prompts for free users trying to access premium analytics.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, Eye, Users, TrendingUp, Calendar, Lock } from 'lucide-react';
import { useFlipbookAnalytics } from '@/hooks/useFlipbookAnalytics';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { planManager, getPlanUpgradePrompt, PlanContext } from '@/lib/planManager';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingFeedback } from '@/components/LoadingFeedback';
import { usePermission } from '@/hooks/usePermissions';
import { Tables } from '@/integrations/supabase/types';

interface FlipbookAnalyticsProps {
  flipbookId: string;
  flipbook?: Tables<'flipbooks'> | null;
  flipbookCount?: number;
  className?: string;
}

interface AnalyticsData {
  totalViews: number;
  recentViews: any[];
  views: any[];
}

export const FlipbookAnalytics = ({ 
  flipbookId, 
  flipbook = null,
  flipbookCount = 0,
  className = '' 
}: FlipbookAnalyticsProps) => {
  const { user, profile } = useAuth();
  const { getFlipbookStats, canAccessAnalytics, analyticsValidation } = useFlipbookAnalytics(flipbookCount);
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permission to view analytics for this specific flipbook
  const analyticsPermission = usePermission('flipbook_view', 'view', {
    flipbook: flipbook
  });

  // Create plan context for validation
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbookCount,
    profile: profile,
  };

  const usageSummary = planManager.getUsageSummary(planContext);

  // Early return if user doesn't have permission to view analytics
  if (!analyticsPermission.allowed) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Analytics Access Restricted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {analyticsPermission.requiresAuth 
                  ? "Please sign in to view analytics for this flipbook."
                  : "You can only view analytics for flipbooks you own."
                }
              </p>
            </div>
            {analyticsPermission.requiresAuth && (
              <Button onClick={() => window.location.href = '/auth'}>
                Sign In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    if (canAccessAnalytics && flipbookId) {
      loadAnalytics();
    }
  }, [flipbookId, canAccessAnalytics]);

  const loadAnalytics = async () => {
    if (!canAccessAnalytics) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getFlipbookStats(flipbookId);
      setAnalyticsData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Show upgrade prompt for free users
  if (!canAccessAnalytics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics & Insights</span>
            <Badge variant="secondary">Premium</Badge>
          </CardTitle>
          <CardDescription>
            Get detailed insights into your flipbook performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpgradePrompt
            config={getPlanUpgradePrompt(usageSummary.plan, 'access_analytics', planContext)}
            compact={false}
          />
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics & Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingFeedback type="inline" message="Loading analytics..." />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics & Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-2">{error}</p>
            <Button variant="outline" onClick={loadAnalytics}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Analytics data display
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Analytics & Insights</span>
          <Badge variant="default" className="bg-green-600">Premium</Badge>
        </CardTitle>
        <CardDescription>
          Detailed performance metrics for your flipbook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {analyticsData && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <Eye className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{analyticsData.totalViews}</p>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{analyticsData.views.length}</p>
                  <p className="text-sm text-muted-foreground">Unique Sessions</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{analyticsData.recentViews.length}</p>
                  <p className="text-sm text-muted-foreground">Recent Views</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            {analyticsData.recentViews.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Recent Activity</span>
                </h4>
                <div className="space-y-2">
                  {analyticsData.recentViews.slice(0, 5).map((view, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">View #{analyticsData.totalViews - index}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(view.viewed_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {analyticsData.totalViews === 0 && (
              <div className="text-center py-8">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-semibold mb-2">No Views Yet</h4>
                <p className="text-muted-foreground">
                  Share your flipbook to start collecting analytics data.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Dashboard Analytics Summary Component
 * Shows overall analytics for all user flipbooks
 */
interface DashboardAnalyticsProps {
  userId: string;
  flipbookCount: number;
  className?: string;
}

export const DashboardAnalytics = ({ 
  userId, 
  flipbookCount,
  className = '' 
}: DashboardAnalyticsProps) => {
  const { user, profile } = useAuth();
  const { getUserStats, canAccessAnalytics } = useFlipbookAnalytics(flipbookCount);
  
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create plan context for validation
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbookCount,
    profile: profile,
  };

  const usageSummary = planManager.getUsageSummary(planContext);

  useEffect(() => {
    if (canAccessAnalytics && userId) {
      loadUserStats();
    }
  }, [userId, canAccessAnalytics]);

  const loadUserStats = async () => {
    if (!canAccessAnalytics) return;

    setIsLoading(true);
    try {
      const data = await getUserStats(userId);
      setStatsData(data);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show upgrade prompt for free users
  if (!canAccessAnalytics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics Overview</span>
            <Badge variant="secondary">Premium</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UpgradePrompt
            config={getPlanUpgradePrompt(usageSummary.plan, 'access_analytics', planContext)}
            compact={true}
          />
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !statsData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingFeedback type="inline" message="Loading analytics..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Analytics Overview</span>
          <Badge variant="default" className="bg-green-600">Premium</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{statsData.totalViews}</p>
            <p className="text-sm text-muted-foreground">Total Views</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{statsData.publicFlipbooks}</p>
            <p className="text-sm text-muted-foreground">Public Flipbooks</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};