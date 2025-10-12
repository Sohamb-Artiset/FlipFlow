import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FlipbookCustomization } from '@/components/FlipbookCustomization';
import { FlipbookViewer } from '@/components/FlipbookViewer';
import { PDFProcessor } from '@/lib/pdfProcessor';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';

type Flipbook = Tables<'flipbooks'>;

export default function FlipbookEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [flipbook, setFlipbook] = useState<Flipbook | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    
    fetchFlipbook();
  }, [id, user]);

  const fetchFlipbook = async () => {
    if (!id || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch flipbook data
      const { data, error: fetchError } = await supabase
        .from('flipbooks')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user owns this flipbook
        .single();

      if (fetchError) {
        throw new Error('Flipbook not found or access denied');
      }

      setFlipbook(data);
      
      // Load PDF for preview
      await loadPDF(data.pdf_url);

    } catch (err: any) {
      console.error('Error fetching flipbook:', err);
      setError(err.message || 'Failed to load flipbook');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPDF = async (pdfUrl: string) => {
    try {
      setIsProcessing(true);
      setError(null);

      const processor = new PDFProcessor();
      const document = await processor.loadPDF(pdfUrl);
      
      setPdfDocument(document);
      
      // Clean up processor
      processor.destroy();

    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || 'Failed to load PDF for preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdate = (updates: Partial<Flipbook>) => {
    if (!flipbook) return;
    setFlipbook({ ...flipbook, ...updates });
  };

  const handleSave = async (updates: Partial<Flipbook>) => {
    if (!id || !flipbook) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('flipbooks')
        .update(updates)
        .eq('id', id);

      if (error) {
        throw new Error('Failed to save changes');
      }

      // Update local state
      setFlipbook({ ...flipbook, ...updates });

    } catch (err: any) {
      console.error('Error saving flipbook:', err);
      throw err; // Re-throw to be handled by the component
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewFlipbook = () => {
    if (flipbook) {
      navigate(`/flipbook/${flipbook.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading flipbook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!flipbook) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Edit Flipbook</h1>
              <p className="text-muted-foreground">{flipbook.title}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button onClick={handleViewFlipbook}>
              View Published
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customization Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customize Your Flipbook</CardTitle>
                <CardDescription>
                  Modify settings and appearance. Changes are saved automatically.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <FlipbookCustomization
              flipbook={flipbook}
              onUpdate={handleUpdate}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Live Preview</CardTitle>
                  <CardDescription>
                    See how your flipbook will look with current settings
                  </CardDescription>
                </CardHeader>
              </Card>

              {isProcessing ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading PDF preview...</p>
                  </CardContent>
                </Card>
              ) : pdfDocument ? (
                <div className="border rounded-lg p-4 bg-card">
                  <FlipbookViewer
                    pdfDocument={pdfDocument}
                    backgroundColor={flipbook.background_color || '#ffffff'}
                    logoUrl={flipbook.logo_url || undefined}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      PDF preview will appear here once loaded
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Full Width Preview */}
        {!showPreview && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Your flipbook preview with current settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Loading PDF preview...</p>
                </div>
              ) : pdfDocument ? (
                <FlipbookViewer
                  pdfDocument={pdfDocument}
                  backgroundColor={flipbook.background_color || '#ffffff'}
                  logoUrl={flipbook.logo_url || undefined}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    PDF preview will appear here once loaded
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
