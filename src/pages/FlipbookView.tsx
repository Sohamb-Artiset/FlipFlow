import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlipbookViewer } from '@/components/FlipbookViewer';
import { PDFProcessor } from '@/lib/pdfProcessor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Share2, Eye } from 'lucide-react';
import { useFlipbook } from '@/hooks/useFlipbooks';

export default function FlipbookView() {
  const { id } = useParams<{ id: string }>();
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Use the React Query hook for flipbook data
  const { data: flipbook, isLoading, error, refetch } = useFlipbook(id);

  // Record view when flipbook loads
  useEffect(() => {
    if (flipbook?.id) {
      const recordView = async () => {
        try {
          await supabase.rpc('record_flipbook_view', {
            p_flipbook_id: flipbook.id,
            p_user_agent: navigator.userAgent,
          });
        } catch (err) {
          console.warn('Failed to record view:', err);
        }
      };
      recordView();
    }
  }, [flipbook?.id]);

  // Process PDF when flipbook data is available
  useEffect(() => {
    if (!flipbook?.pdf_url || pdfDocument) return;

    const loadPDF = async () => {
      setIsProcessingPDF(true);
      setPdfError(null);

      try {
        const processor = new PDFProcessor();
        const doc = await processor.loadPDF(flipbook.pdf_url);
        setPdfDocument(doc);
      } catch (err) {
        console.error('PDF loading error:', err);
        setPdfError(err instanceof Error ? err.message : 'Failed to load PDF');
        toast.error('Failed to load PDF', {
          description: 'Please try refreshing the page',
        });
      } finally {
        setIsProcessingPDF(false);
      }
    };

    loadPDF();
  }, [flipbook?.pdf_url, pdfDocument]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!', {
        description: 'Share this link with others to view the flipbook',
      });
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  // Loading state
  if (isLoading || isProcessingPDF) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {isProcessingPDF ? 'Loading PDF...' : 'Loading flipbook...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || pdfError || !flipbook) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorDisplay
          error={error instanceof Error ? error : new Error(pdfError || 'Flipbook not found')}
          onRetry={() => {
            setPdfError(null);
            setPdfDocument(null);
            refetch();
          }}
          title={!flipbook ? 'Flipbook not found' : 'Failed to load flipbook'}
          className="max-w-md"
        />
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{flipbook.title}</h1>
                {flipbook.description && (
                  <p className="text-muted-foreground mb-4">{flipbook.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{flipbook.view_count || 0} views</span>
                  </div>
                  {flipbook.is_public && (
                    <Badge variant="secondary">Public</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Flipbook Viewer */}
        {pdfDocument && (
          <FlipbookViewer
            pdfDocument={pdfDocument}
            flipbook={flipbook}
          />
        )}
      </div>
    </div>
  );
}
