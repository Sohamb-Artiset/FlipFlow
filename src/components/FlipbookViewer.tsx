import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ZoomIn, ZoomOut, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import HTMLFlipBook from 'react-pageflip';
import { PDFDocument } from '@/lib/pdfProcessor';

interface FlipbookViewerProps {
  pdfDocument: PDFDocument;
  backgroundColor?: string;
  logoUrl?: string;
  className?: string;
}

export const FlipbookViewer = ({ 
  pdfDocument, 
  backgroundColor = '#ffffff',
  logoUrl,
  className = ''
}: FlipbookViewerProps) => {
  const flipBookRef = useRef<HTMLFlipBook>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 400, height: 600 });

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
      flipBookRef.current.pageFlip().flipPrev();
    }
  };

  const goToNextPage = () => {
    if (flipBookRef.current && currentPage < totalPages) {
      flipBookRef.current.pageFlip().flipNext();
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const renderPage = (page: any) => {
    const pageIndex = page - 1;
    const pageData = pdfDocument.pages[pageIndex];
    
    if (!pageData) return null;

    return (
      <div 
        key={pageIndex}
        className="flipbook-page"
        style={{
          backgroundColor,
          backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          backgroundSize: '100px auto',
          padding: '20px',
        }}
      >
        <img
          src={pageData.imageData}
          alt={`Page ${page}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          draggable={false}
        />
      </div>
    );
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
          maxShadowOpacity={0.5}
          showCover={false}
          mobileScrollSupport={true}
          onFlip={handleFlip}
          className="flipbook"
          style={{
            margin: '0 auto',
          }}
        >
          {pdfDocument.pages.map((_, index) => renderPage(index + 1))}
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
                    flipBookRef.current.pageFlip().flip(pageNum - 1);
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
                    flipBookRef.current.pageFlip().flip(totalPages - 1);
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
