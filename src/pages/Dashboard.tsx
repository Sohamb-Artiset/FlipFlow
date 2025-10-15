import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { FlipbookUpload } from '@/components/FlipbookUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Edit, Share2, Trash2, Plus, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [flipbooks, setFlipbooks] = useState<Flipbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchFlipbooks();
  }, [user, navigate]);

  const fetchFlipbooks = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('flipbooks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error('Failed to fetch flipbooks');
      }

      setFlipbooks(data || []);
    } catch (err: any) {
      console.error('Error fetching flipbooks:', err);
      setError(err.message || 'Failed to load flipbooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFlipbook = async (flipbookId: string) => {
    if (!confirm('Are you sure you want to delete this flipbook? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('flipbooks')
        .delete()
        .eq('id', flipbookId);

      if (error) {
        throw new Error('Failed to delete flipbook');
      }

      toast({
        title: 'Success',
        description: 'Flipbook deleted successfully',
      });

      // Refresh the list
      fetchFlipbooks();
    } catch (err: any) {
      console.error('Error deleting flipbook:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete flipbook',
        variant: 'destructive',
      });
    }
  };

  const handleShareFlipbook = async (flipbookId: string) => {
    const url = `${window.location.origin}/flipbook/${flipbookId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Copied!',
        description: 'Flipbook URL copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Share this flipbook',
        description: url,
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Flipbooks</h1>
            <p className="text-muted-foreground">
              Create and manage your interactive flipbooks
            </p>
          </div>
          <FlipbookUpload onUploadComplete={fetchFlipbooks} flipbookCount={flipbooks.length} />
        </div>

        {/* Plan Status Display */}
        {profile && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-semibold text-sm">Current Plan</h3>
                    <p className="text-muted-foreground text-sm">
                      {profile.plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <h3 className="font-semibold text-sm">Flipbook Usage</h3>
                    <p className="text-muted-foreground text-sm">
                      {profile.plan === 'premium' 
                        ? `${flipbooks.length} flipbooks (Unlimited)` 
                        : `${flipbooks.length}/3 flipbooks used`
                      }
                    </p>
                  </div>
                </div>
                {profile.plan === 'free' && flipbooks.length >= 2 && (
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
                {profile.plan === 'premium' && (
                  <Badge variant="default" className="bg-green-600">
                    Premium
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading flipbooks...</p>
            </div>
          </div>
        ) : flipbooks.length === 0 ? (
          /* Empty State */
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No flipbooks yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first interactive flipbook by uploading a PDF
              </p>
              <FlipbookUpload onUploadComplete={fetchFlipbooks} flipbookCount={flipbooks.length} />
            </CardContent>
          </Card>
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

        {/* Stats Summary */}
        {flipbooks.length > 0 && (
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
      </main>
    </div>
  );
}