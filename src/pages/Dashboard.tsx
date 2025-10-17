import { useEffect, useState } from 'react';
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
import { Eye, Edit, Share2, Trash2, Plus, FileText, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { toast } from 'sonner';
import { useErrorHandler } from '@/lib/errorHandling';
import { useFlipbooks } from '@/hooks/useFlipbooks';
import { useDeleteFlipbook } from '@/hooks/useFlipbookMutations';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

// Extended profile type with plan field
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

export default function Dashboard() {
  const { user, profile: authProfile, isLoadingProfile, authLoading } = useAuth();
  const profile = authProfile as Profile | null;
  const navigate = useNavigate();
  const { handleError, handleAsyncOperation } = useErrorHandler();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  
  // Use React Query for optimized flipbook data fetching
  const {
    data: flipbooks = [],
    isLoading,
    error,
    refetch: refetchFlipbooks,
    isRefetching,
    fetchStatus,
    isFetching,
    status,
  } = useFlipbooks(user?.id);
  
  // Use React Query mutation for delete operations
  const deleteFlipbookMutation = useDeleteFlipbook(user?.id || '');

  useEffect(() => {
    // Wait for auth to resolve before deciding navigation
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
  }, [authLoading, user, navigate]);

  // If auth is still loading, render initial skeleton UI and avoid triggering queries
  if (authLoading) {
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

  // Timeout fallback: if fetch hangs > 10s, show error UI instead of skeletons
  useEffect(() => {
    if (fetchStatus === 'fetching') {
      const timer = setTimeout(() => setLoadTimedOut(true), 10000);
      return () => clearTimeout(timer);
    }
    // Reset timeout flag when not fetching
    setLoadTimedOut(false);
  }, [fetchStatus]);

  const handleDeleteFlipbook = async (flipbookId: string) => {
    if (!confirm('Are you sure you want to delete this flipbook? This action cannot be undone.')) {
      return;
    }

    const result = await handleAsyncOperation(
      () => deleteFlipbookMutation.mutateAsync(flipbookId),
      { 
        component: 'Dashboard',
        operation: 'deleteFlipbook',
        userId: user?.id,
        metadata: { flipbookId }
      }
    );

    if (result !== null) {
      toast.success('Flipbook deleted successfully', {
        description: 'The flipbook has been permanently removed from your account.',
      });
    }
    // Error handling is now managed by the error handler utility
  };

  const handleShareFlipbook = async (flipbookId: string) => {
    const url = `${window.location.origin}/flipbook/${flipbookId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link Copied!', {
        description: 'Flipbook URL has been copied to your clipboard.',
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      toast.info('Share this flipbook', {
        description: url,
        action: {
          label: 'Copy',
          onClick: () => {
            // Try alternative copy method
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              toast.success('Copied!', { description: 'URL copied to clipboard.' });
            } catch (err) {
              toast.error('Copy Failed', { description: 'Please copy the URL manually.' });
            }
            document.body.removeChild(textArea);
          },
        },
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
              disabled={isRefetching}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <FlipbookUpload onUploadComplete={() => refetchFlipbooks()} flipbookCount={flipbooks.length} />
          </div>
        </div>

        {/* Plan Status Display - Show skeleton while loading profile */}
        {isLoadingProfile ? (
          <PlanStatusSkeleton />
        ) : profile ? (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-semibold text-sm">Current Plan</h3>
                    <p className="text-muted-foreground text-sm">
                      {(profile.plan || 'free') === 'premium' ? 'Premium Plan' : 'Free Plan'}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <h3 className="font-semibold text-sm">Flipbook Usage</h3>
                    <p className="text-muted-foreground text-sm">
                      {(profile.plan || 'free') === 'premium' 
                        ? `${flipbooks.length} flipbooks (Unlimited)` 
                        : `${flipbooks.length}/3 flipbooks used`
                      }
                    </p>
                  </div>
                </div>
                {(profile.plan || 'free') === 'free' && flipbooks.length >= 2 && (
                  <div className="text-right">
                    {flipbooks.length === 2 ? (
                      <Badge variant="secondary" className="text-amber-600">
                        1 remaining
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        Limit reached
                      </Badge>
                    )}
                  </div>
                )}
                {(profile.plan || 'free') === 'premium' && (
                  <Badge variant="default" className="bg-green-600">
                    Premium
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Enhanced Error State */}
        {error && (
          <ErrorDisplay
            error={error instanceof Error ? error : new Error((error as any)?.message || 'Failed to load flipbooks')}
            onRetry={() => refetchFlipbooks()}
            isRetrying={isRefetching}
            title="Failed to load flipbooks"
            className="mb-6"
          />
        )}

        {/* Content Area - Progressive Loading */}
        {((fetchStatus === 'fetching') || isFetching) && !loadTimedOut ? (
          /* Show skeleton cards while loading flipbooks */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <FlipbookCardSkeleton key={index} />
            ))}
          </div>
        ) : loadTimedOut ? (
          <ErrorEmptyState
            error={new Error('The request is taking longer than expected.')}
            onRetry={() => refetchFlipbooks()}
            isRetrying={isRefetching}
            title="Network delay"
            description="We couldn't load your flipbooks yet. Please try again."
          />
        ) : flipbooks.length === 0 ? (
          /* Enhanced Empty State */
          !error ? (
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
            <ErrorEmptyState
              error={error}
              onRetry={() => refetchFlipbooks()}
              isRetrying={isRefetching}
              title="Unable to load flipbooks"
              description="We couldn't load your flipbooks. Please try again."
            />
          )
        ) : (
          /* Flipbooks Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flipbooks.map((flipbook) => (
              <Card key={flipbook.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1 line-clamp-2">
                        {flipbook.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {flipbook.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant={flipbook.is_public ? "default" : "secondary"}>
                      {flipbook.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Eye className="w-4 h-4" />
                        <span>{flipbook.view_count || 0} views</span>
                      </div>
                      <span>{formatDate(flipbook.created_at!)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Link to={`/flipbook/${flipbook.id}`} className="flex-1" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      
                      <Link to={`/flipbook/${flipbook.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareFlipbook(flipbook.id)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFlipbook(flipbook.id)}
                        disabled={deleteFlipbookMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats Summary - Only show when flipbooks are loaded and available */}
        {!(fetchStatus === 'fetching' || isFetching) && flipbooks.length > 0 && (
          <Card className="mt-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {flipbooks.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Flipbooks
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {flipbooks.reduce((sum, fb) => sum + (fb.view_count || 0), 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Views
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {flipbooks.filter(fb => fb.is_public).length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Public Flipbooks
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DEBUG: Remove after verifying fix */}
        <Card className="mt-6">
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div><span className="font-semibold">User ID:</span> {user?.id || 'none'}</div>
            <div><span className="font-semibold">isLoading:</span> {String(isLoading)}</div>
            <div><span className="font-semibold">isFetching:</span> {String(isFetching)}</div>
            <div><span className="font-semibold">fetchStatus:</span> {String(fetchStatus)}</div>
            <div><span className="font-semibold">status:</span> {String(status)}</div>
            <div><span className="font-semibold">timedOut:</span> {String(loadTimedOut)}</div>
            <div><span className="font-semibold">error:</span> {(error as any)?.message || (error as any) || 'none'}</div>
            <div><span className="font-semibold">flipbooks:</span> {flipbooks.length}</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}