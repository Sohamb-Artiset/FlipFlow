import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ZoomIn, ZoomOut, Maximize, Minimize, ChevronLeft, ChevronRight, Download, Lock, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import HTMLFlipBook from 'react-pageflip';
import { PDFDocument } from '@/lib/pdfProcessor';
import { PageCover, Page } from '@/components/PageComponents';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { planManager, PlanContext, getPlanUpgradePrompt } from '@/lib/planManager';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useFlipbookPermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface FlipbookViewerProps {
  pdfDocument: PDFDocument;
  backgroundColor?: string;
  logoUrl?: string;
  className?: string;
  flipbook?: Tables<'flipbooks'>;
  flipbookCount?: number;
}

export const FlipbookViewer = ({ 
  pdfDocument, 
  backgroundColor = '#ffffff',
  logoUrl,
  className = '',
  flipbook,
  flipbookCount = 0
}: FlipbookViewerProps) => {
  const { user, profile } = useAuth();
  const showCovers = flipbook?.show_covers ?? false;
  const flipBookRef = useRef<typeof HTMLFlipBook>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 400, height: 600 });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Check permissions for this flipbook
  const permissions = useFlipbookPermissions(flipbook);

  // Create plan context for validation
  const planContext: PlanContext = {
    userId: user?.id,
    currentFlipbookCount: flipbookCount,
    profile: profile,
  };

  // Early return if user doesn't have permission to view this flipbook
  if (!permissions.canView) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <div className="flex flex-col items-center space-y-4">
          <Lock className="w-12 h-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Access Restricted</h3>
          <p className="text-muted-foreground max-w-md">
            This flipbook is private and you don't have permission to view it. 
            {!user && " Please sign in if you have access to this content."}
          </p>
          {!user && (
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          )}
        </div>
      </Card>
    );
  }

  useEffect(() => {
    setTotalPages(pdfDocument.pages.length);
    setCurrentPage(1);
    
    // Extract PDF dimensions from the first page
    // Divide by 2 since PDF is rendered at 2x scale in pdfProcessor
    if (pdfDocument.pages.length > 0) {
      const firstPage = pdfDocument.pages[0];
      setPdfDimensions({
        width: firstPage.width / 2,
        height: firstPage.height / 2
      });
    }
    
    setIsLoading(false);
  }, [pdfDocument]);

  const handleFlip = useCallback((e: any) => {
    setCurrentPage(e.data + 1);
  }, []);

  const goToPrevPage = () => {
    if (flipBookRef.current && currentPage > 1) {
      (flipBookRef.current as any).pageFlip().flipPrev();
    }
  };

  const goToNextPage = () => {
    if (flipBookRef.current && currentPage < totalPages) {
      (flipBookRef.current as any).pageFlip().flipNext();
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const toggleFullscreen = () => {
    // Check if user can access fullscreen (premium feature)
    const validation = planManager.validateAction('advanced_features', planContext);
    if (!validation.allowed) {
      const upgradePrompt = getPlanUpgradePrompt(
        planManager.getUsageSummary(planContext).plan,
        'advanced_features',
        planContext
      );
      toast.error(upgradePrompt.title, {
        description: upgradePrompt.message,
      });
      setShowUpgradePrompt(true);
      return;
    }

    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleExportFlipbook = () => {
    // Check if user can export flipbooks (premium feature)
    const validation = planManager.validateAction('export_flipbook', planContext);
    if (!validation.allowed) {
      const upgradePrompt = getPlanUpgradePrompt(
        planManager.getUsageSummary(planContext).plan,
        'export_flipbook',
        planContext
      );
      toast.error(upgradePrompt.title, {
        description: upgradePrompt.message,
      });
      setShowUpgradePrompt(true);
      return;
    }

    // Export functionality would go here
    toast.success('Export feature coming soon!', {
      description: 'PDF export functionality will be available in the next update.',
    });
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const renderPage = (pageIndex: number) => {
    const pageData = pdfDocument.pages[pageIndex];
    
    if (!pageData) return null;

    const showCovers = flipbook?.show_covers || false;
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;
    const shouldUseCover = showCovers && (isFirstPage || isLastPage);

    const pageProps = {
      pageData,
      backgroundColor,
      logoUrl,
      pageNumber: pageIndex + 1,
    };

    if (shouldUseCover) {
      return <PageCover key={pageIndex} {...pageProps} />;
    } else {
      return <Page key={pageIndex} {...pageProps} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading flipbook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flipbook-container ${className}`}>
      {/* Upgrade Prompt */}
      {showUpgradePrompt && (
        <Card className="mb-4">
          <UpgradePrompt
            config={getPlanUpgradePrompt(
              planManager.getUsageSummary(planContext).plan,
              'advanced_features',
              planContext
            )}
            compact={false}
          />
        </Card>
      )}

      {/* Controls */}
      <Card className="mb-4 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <span className="text-sm text-muted-foreground min-w-[80px] text-center">
              {currentPage} / {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 2}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFlipbook}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Flipbook */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: zoom }}
        transition={{ duration: 0.3 }}
        className="flipbook-wrapper"
      >
        <HTMLFlipBook
          ref={flipBookRef}
          width={pdfDimensions.width}
          height={pdfDimensions.height}
          size="stretch"
          minWidth={Math.min(pdfDimensions.width * 0.5, 200)}
          maxWidth={Math.max(pdfDimensions.width * 1.5, 600)}
          minHeight={Math.min(pdfDimensions.height * 0.5, 300)}
          maxHeight={Math.max(pdfDimensions.height * 1.5, 900)}
          startPage={0}
          drawShadow={true}
          flippingTime={1000}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showCover={flipbook?.show_covers || false}
          mobileScrollSupport={true}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          onFlip={handleFlip}
          className="flipbook"
          style={{
            margin: '0 auto',
          }}
        >
          {pdfDocument.pages.map((_, index) => renderPage(index))}
        </HTMLFlipBook>
      </motion.div>

      {/* Page Navigation */}
      <Card className="mt-4 p-3">
        <div className="flex items-center justify-center space-x-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const pageNum = i + 1;
            const isActive = pageNum === currentPage;
            
            return (
              <Button
                key={pageNum}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (flipBookRef.current) {
                    (flipBookRef.current as any).pageFlip().flip(pageNum - 1);
                  }
                }}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
          {totalPages > 10 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button
                variant={totalPages === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (flipBookRef.current) {
                    (flipBookRef.current as any).pageFlip().flip(totalPages - 1);
                  }
                }}
                className="w-8 h-8 p-0"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
