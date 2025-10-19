import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { FlipbookUpload } from '@/components/FlipbookUpload';
import { FlipbookCardSkeleton } from '@/components/FlipbookCardSkeleton';
import { PlanStatusSkeleton } from '@/components/PlanStatusSkeleton';
import { ErrorDisplay, ErrorEmptyState } from '@/components/ErrorDisplay';
import { LoadingFeedback, OperationLoading } from '@/components/LoadingFeedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Edit, Share2, Trash2, Plus, FileText, RefreshCw, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { toast } from 'sonner';
import { useErrorHandler } from '@/lib/errorHandling';
import { useFlipbooks } from '@/hooks/useFlipbooks';
import { useDeleteFlipbook } from '@/hooks/useFlipbookMutations';
import { Tables } from '@/integrations/supabase/types';
import { planManager, PlanContext, getPlanUpgradePrompt } from '@/lib/planManager';
import { useFlipbookPermissions } from '@/hooks/usePermissions';
import { FlipbookCard } from '@/components/FlipbookCard';
import { StatsCard } from '@/components/StatsCard';
import { PlanStatus } from '@/components/PlanStatus';
import { useDashboardActions } from '@/hooks/useDashboardActions';

type Flipbook = Tables<'flipbooks'>;

// Extended profile type with plan field
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};



export default function Dashboard() {
  const { user, profile: authProfile, isLoading: authIsLoading } = useAuth();
  const profile = authProfile as Profile | null;
  const navigate = useNavigate();
  const { handleError, handleAsyncOperation } = useErrorHandler();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  
  // Parallel data loading - flipbooks load in parallel with profile data from AuthContext
  const {
    data: flipbooks = [],
    isLoading: flipbooksLoading,
    error,
    refetch: refetchFlipbooks,
    isRefetching,
  } = useFlipbooks(user?.id);

  // Consolidated loading state - single source of truth for all loading states
  const isLoading = authIsLoading || flipbooksLoading;
  const isRefreshing = isRefetching;
  
  // Create plan context for validation
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbooks.length,
    profile: profile,
  };

  const { handleDeleteFlipbook, handleShareFlipbook, formatDate, isDeleting } = useDashboardActions({
    flipbooks,
    userId: user?.id,
    planContext,
  });

  useEffect(() => {
    // Wait for auth to resolve before deciding navigation
    if (authIsLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
  }, [authIsLoading, user, navigate]);

  // Show initial loading state when auth is loading and no user yet
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Flipbooks</h1>
              <p className="text-muted-foreground">Create and manage your interactive flipbooks</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <FlipbookCardSkeleton key={index} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Timeout fallback: if loading hangs > 10s, show error UI instead of skeletons
  useEffect(() => {
    if (isLoading && user) {
      const timer = setTimeout(() => setLoadTimedOut(true), 10000);
      return () => clearTimeout(timer);
    }
    // Reset timeout flag when not loading
    setLoadTimedOut(false);
  }, [isLoading, user]);



  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Header - Always show immediately */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Flipbooks</h1>
            <p className="text-muted-foreground">
              Create and manage your interactive flipbooks
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchFlipbooks()}
              disabled={isRefreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <FlipbookUpload onUploadComplete={() => refetchFlipbooks()} flipbookCount={flipbooks.length} />
          </div>
        </div>

        {/* Plan Status Display - Show skeleton during loading, then show data */}
        {isLoading && !profile ? (
          <PlanStatusSkeleton />
        ) : profile ? (
          <PlanStatus profile={profile} flipbookCount={flipbooks.length} />
        ) : null}

        {/* Enhanced Error State */}
        {error && (
          <ErrorDisplay
            error={error instanceof Error ? error : new Error((error as any)?.message || 'Failed to load flipbooks')}
            onRetry={() => refetchFlipbooks()}
            isRetrying={isRefreshing}
            title="Failed to load flipbooks"
            className="mb-6"
          />
        )}

        {/* Content Area - Progressive Loading with consolidated state */}
        {isLoading && !loadTimedOut && flipbooks.length === 0 ? (
          // Show skeleton cards during initial loading
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <FlipbookCardSkeleton key={index} />
            ))}
          </div>
        ) : loadTimedOut ? (
          <ErrorEmptyState
            error={new Error('The request is taking longer than expected.')}
            onRetry={() => refetchFlipbooks()}
            isRetrying={isRefreshing}
            title="Network delay"
            description="We couldn't load your flipbooks yet. Please try again."
          />
        ) : (!isLoading && flipbooks.length === 0) ? (
          // Show clear empty state if there are no flipbooks and not loading
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No flipbooks yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first interactive flipbook by uploading a PDF
              </p>
              <FlipbookUpload onUploadComplete={() => refetchFlipbooks()} flipbookCount={flipbooks.length} />
            </CardContent>
          </Card>
        ) : (
          /* Flipbooks Grid - Using memoized components */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flipbooks.map((flipbook) => (
              <FlipbookCard
                key={flipbook.id}
                flipbook={flipbook}
                onDelete={handleDeleteFlipbook}
                onShare={handleShareFlipbook}
                formatDate={formatDate}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        )}

        {/* Stats Summary - Only show when flipbooks are loaded and available */}
        {!isLoading && flipbooks.length > 0 && (
          <StatsCard flipbooks={flipbooks} />
        )}


      </main>
    </div>
  );
}