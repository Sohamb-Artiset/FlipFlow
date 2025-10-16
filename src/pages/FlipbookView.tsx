import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlipbookViewer } from '@/components/FlipbookViewer';
import { PDFProcessor } from '@/lib/pdfProcessor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ErrorDisplay, ErrorEmptyState } from '@/components/ErrorDisplay';
import { LoadingFeedback, OperationLoading } from '@/components/LoadingFeedback';
import { Share2, Eye, Calendar } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

export default function FlipbookView() {
  const { id } = useParams<{ id: string }>();
  const [flipbook, setFlipbook] = useState<Flipbook | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    fetchFlipbook();
  }, [id]);

  useEffect(() => {
    if (flipbook && !pdfDocument && !isProcessing) {
      loadPDF();
    }
  }, [flipbook]);

  const fetchFlipbook = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch flipbook data
      const { data, error: fetchError } = await supabase
        .from('flipbooks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error('Flipbook not found');
      }

      if (!data.is_public) {
        throw new Error('This flipbook is private');
      }

      setFlipbook(data);

      // Track view
      trackView(data.id);

    } catch (err: any) {
      console.error('Error fetching flipbook:', err);
      setError(err.message || 'Failed to load flipbook');
    } finally {
      setIsLoading(false);
    }
  };

  const trackView = async (flipbookId: string) => {
    try {
      // Use the database function to safely increment view count and insert view record
      const { error: rpcError } = await supabase.rpc('increment_view_count', {
        flipbook_id: flipbookId
      });

      if (rpcError) {
        console.error('Error calling increment_view_count:', rpcError);
      }

      // Insert view record with user agent
      const { error: insertError } = await supabase
        .from('flipbook_views')
        .insert({
          flipbook_id: flipbookId,
          ip_address: null,
          user_agent: navigator.userAgent,
        });

      if (insertError) {
        console.error('Error inserting view record:', insertError);
      }

    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't show error to user for analytics tracking
    }
  };

  const loadPDF = async () => {
    if (!flipbook?.pdf_url) return;

    try {
      setIsProcessing(true);
      setError(null);

      const processor = new PDFProcessor();
      const document = await processor.loadPDF(flipbook.pdf_url);
      
      setPdfDocument(document);
      
      // Clean up processor
      processor.destroy();

    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || 'Failed to load PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link Copied!', {
        description: 'Flipbook URL has been copied to your clipboard.',
      });
    } catch (error) {
      // Enhanced fallback with retry option
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
              toast.error('Copy Failed', { 
                description: 'Please copy the URL manually from your browser address bar.' 
              });
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
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingFeedback 
          type="card" 
          message="Loading flipbook details..." 
          size="lg"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorDisplay
          error={new Error(error)}
          variant="card"
          title="Unable to Load Flipbook"
          onRetry={() => fetchFlipbook()}
          isRetrying={isLoading}
          showDetails={false}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (!flipbook) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{flipbook.title}</h1>
              {flipbook.description && (
                <p className="text-muted-foreground text-lg mb-4">
                  {flipbook.description}
                </p>
              )}
              
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{flipbook.view_count || 0} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDate(flipbook.created_at!)}</span>
                </div>
              </div>
            </div>
            
            <Button onClick={handleShare} variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* PDF Loading */}
        {!pdfDocument && !isProcessing && (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Ready to view</h3>
              <p className="text-muted-foreground mb-4">
                Click the button below to load and view the flipbook
              </p>
              <Button onClick={loadPDF}>
                Load Flipbook
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Processing */}
        {isProcessing && (
          <Card className="mb-8">
            <CardContent className="p-8">
              <OperationLoading 
                operation="download" 
                message="Processing PDF for viewing..." 
              />
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <ErrorDisplay
            error={new Error(error)}
            variant="alert"
            onRetry={() => {
              setError(null);
              if (flipbook?.pdf_url) {
                loadPDF();
              } else {
                fetchFlipbook();
              }
            }}
            isRetrying={isLoading || isProcessing}
            className="mb-8"
          />
        )}

        {/* Flipbook Viewer */}
        {pdfDocument && (
          <FlipbookViewer
            pdfDocument={pdfDocument}
            backgroundColor={flipbook.background_color || '#ffffff'}
            logoUrl={flipbook.logo_url || undefined}
            flipbook={flipbook}
          />
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-muted-foreground">
          <p>Created with FlipFlow</p>
        </div>
      </div>
    </div>
  );
}
