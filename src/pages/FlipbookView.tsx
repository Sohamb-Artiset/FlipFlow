import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
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
  const [currentPhase, setCurrentPhase] = useState<FlipbookLoadingPhase>('initialization');
  const [performanceTimingId, setPerformanceTimingId] = useState<string | null>(null);
  const [progressTrackerId, setProgressTrackerId] = useState<string | null>(null);
  
  // Debug hooks for development
  const { debugState, actions: debugActions } = useFlipbookDebug(id);
  const pdfDebug = useFlipbookPDFDebug(id);
  const networkDebug = useFlipbookNetworkDebug(id);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Enhanced loading state management
  const [loadingState, setLoadingState] = useState<DetailedLoadingState>('idle');
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    phase: 'idle',
    percentage: 0,
    message: 'Initializing...',
    startTime: Date.now(),
    timeElapsed: 0,
  });
  
  // Timeout management
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [canExtendTimeout, setCanExtendTimeout] = useState(false);
  
  // Update time elapsed every second during loading
  useEffect(() => {
    if (loadingState === 'complete' || loadingState === 'error' || loadingState === 'idle' || loadingState === 'timeout') {
      return;
    }
    
    const interval = setInterval(() => {
      setLoadingProgress(prev => ({
        ...prev,
        timeElapsed: Date.now() - prev.startTime,
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [loadingState]);

  // Timeout detection for each phase
  useEffect(() => {
    if (loadingState === 'complete' || loadingState === 'error' || loadingState === 'idle' || loadingState === 'timeout') {
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      return;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set timeout for current phase
    const phaseTimeout = PHASE_TIMEOUTS[loadingState as keyof typeof PHASE_TIMEOUTS];
    if (phaseTimeout) {
      const newTimeoutId = setTimeout(() => {
        handleTimeout(loadingState);
      }, phaseTimeout);
      
      setTimeoutId(newTimeoutId);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadingState]);

  // Helper function to update loading progress with smooth transitions
  const updateLoadingState = (
    phase: DetailedLoadingState, 
    percentage: number, 
    message: string, 
    estimatedDuration?: number
  ) => {
    setLoadingState(phase);
    setLoadingProgress(prev => ({
      phase,
      percentage,
      message,
      startTime: phase !== prev.phase ? Date.now() : prev.startTime,
      estimatedDuration,
      timeElapsed: phase !== prev.phase ? 0 : prev.timeElapsed,
    }));
    setIsTimedOut(false);
    setCanExtendTimeout(false);
  };

  // Handle timeout for current phase
  const handleTimeout = (phase: DetailedLoadingState) => {
    const phaseTimeout = PHASE_TIMEOUTS[phase as keyof typeof PHASE_TIMEOUTS];
    const timeoutSeconds = phaseTimeout ? Math.round(phaseTimeout / 1000) : 30;
    
    logFlipbookError(
      new Error(`Operation timeout: ${phase} exceeded ${timeoutSeconds}s limit`),
      flipbook?.id || id || 'unknown',
      phase,
      'handleTimeout',
      { 
        phase, 
        timeoutDuration: phaseTimeout,
        timeElapsed: loadingProgress.timeElapsed 
      }
    );

    setIsTimedOut(true);
    setCanExtendTimeout(true);
    setLoadingState('timeout');
    updateLoadingState('timeout', 0, `Operation timed out after ${timeoutSeconds} seconds`);
  };

  // Extend timeout for current operation
  const extendTimeout = () => {
    if (!canExtendTimeout || loadingState === 'timeout') return;
    
    const currentPhase = loadingProgress.phase;
    logFlipbookOperation('Timeout extended by user', flipbook?.id || id || 'unknown', currentPhase, {
      originalTimeout: PHASE_TIMEOUTS[currentPhase as keyof typeof PHASE_TIMEOUTS],
      timeElapsed: loadingProgress.timeElapsed,
    });

    setIsTimedOut(false);
    setCanExtendTimeout(false);
    
    // Restart the operation based on current phase
    if (currentPhase === 'fetching_metadata') {
      fetchFlipbook();
    } else if (currentPhase === 'downloading_pdf' || currentPhase === 'processing_pdf') {
      loadPDF();
    }
  };

  // Cancel current operation
  const cancelOperation = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    
    logFlipbookOperation('Operation cancelled by user', flipbook?.id || id || 'unknown', loadingState, {
      phase: loadingState,
      timeElapsed: loadingProgress.timeElapsed,
    });

    setIsProcessing(false);
    setLoadingState('idle');
    setError('Operation was cancelled');
  };

  // Try alternative loading method
  const tryAlternativeLoading = () => {
    if (!flipbook?.pdf_url) return;
    
    logFlipbookOperation('User requested alternative loading method', flipbook.id, loadingState, {
      originalUrl: flipbook.pdf_url,
      timeElapsed: loadingProgress.timeElapsed,
    });

    // Open PDF in new tab as fallback
    window.open(flipbook.pdf_url, '_blank');
    
    // Show user-friendly message
    setError('Opening PDF in new tab as alternative. You can also try refreshing this page.');
  };

  // Detect slow connection based on timing
  const isSlowConnection = loadingProgress.timeElapsed > 15000 && loadingProgress.percentage < 50;

  useEffect(() => {
    if (!id) return;
    
    fetchFlipbook();
  }, [id]);

  useEffect(() => {
    if (flipbook && !pdfDocument && !isProcessing && flipbook.pdf_url) {
      logFlipbookOperation(
        'Auto-loading PDF triggered',
        flipbook.id,
        'downloading_pdf',
        {
          pdfUrl: flipbook.pdf_url,
          hasExistingDocument: !!pdfDocument,
          isCurrentlyProcessing: isProcessing,
        }
      );
      // Start PDF loading automatically after flipbook data is fetched
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
    const timingId = startFlipbookTiming('trackView', flipbookId, 'tracking_view');
    
    try {
      setCurrentPhase('tracking_view');
      updateLoadingState('tracking_view', 50, 'Recording view...', 2000);
      
      flipbookLogger.logPhaseTransition('fetching_metadata', 'tracking_view', {
        flipbookId,
        userId: user?.id,
        component: 'FlipbookView',
      });

      logFlipbookOperation('Starting view tracking', flipbookId, 'tracking_view', {
        userAgent: navigator.userAgent,
      });

      const { error: viewError } = await supabase.rpc('record_flipbook_view', {
        p_flipbook_id: flipbookId,
        p_user_agent: navigator.userAgent,
      });

      if (viewError) {
        logFlipbookError(
          new Error(`View tracking failed: ${viewError.message}`),
          flipbookId,
          'tracking_view',
          'trackView',
          { supabaseError: viewError }
        );
      } else {
        updateLoadingState('tracking_view', 70, 'View recorded successfully', 2000);
        logFlipbookOperation('View tracking completed successfully', flipbookId, 'tracking_view');
      }

      endFlipbookTiming(timingId, 'trackView', flipbookId, 'tracking_view', {
        success: !viewError,
        error: viewError?.message,
      });

    } catch (error) {
      logFlipbookError(
        error as Error,
        flipbookId,
        'tracking_view',
        'trackView'
      );

      // Use centralized error handling for analytics tracking
      handleError(error, {
        component: 'FlipbookView',
        operation: 'trackView',
        metadata: { flipbookId: id },
      }, {
        showToast: false, // Don't show error to user for analytics
        logError: true,
        reportError: false, // Analytics errors are not critical
      });

      endFlipbookTiming(timingId, 'trackView', flipbookId, 'tracking_view', {
        success: false,
        error: (error as Error).message,
      });
    }
  };

  const loadPDF = async () => {
    if (!flipbook?.pdf_url) {
      flipbookLogger.warn('loadPDF called without PDF URL', {
        flipbookId: flipbook?.id,
        component: 'FlipbookView',
        phase: 'downloading_pdf',
      });
      return;
    }

    const timingId = startFlipbookTiming('loadPDF', flipbook.id, 'downloading_pdf');
    const performanceId = startFlipbookOperation('loadPDF', 'downloading_pdf', flipbook.id);
    const progressId = trackFlipbookProgress('PDF Loading', 4, flipbook.id, 10000); // Estimate 10 seconds
    
    setPerformanceTimingId(performanceId);
    setProgressTrackerId(progressId);
    
    // Start profiling if in debug mode
    if (debugState.isDebugMode) {
      startFlipbookProfiling('loadPDF');
      debugActions.logDebugStep('Starting PDF loading operation', { 
        flipbookId: flipbook.id,
        pdfUrl: flipbook.pdf_url,
      });
    }
    
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
    
    logFlipbookOperation('Share button clicked', flipbook?.id || 'unknown', currentPhase, {
      url,
      method: 'clipboard',
    });
    
    try {
      await navigator.clipboard.writeText(url);
      
      logFlipbookOperation('Share completed successfully', flipbook?.id || 'unknown', currentPhase, {
        url,
        method: 'clipboard',
        success: true,
      });
      
      toast.success('Link Copied!', {
        description: 'Flipbook URL has been copied to your clipboard.',
      });
    } catch (error) {
      logFlipbookError(
        error as Error,
        flipbook?.id || 'unknown',
        currentPhase,
        'handleShare',
        { url, method: 'clipboard' }
      );

      // Use centralized error handling for clipboard failures
      handleError(error, {
        component: 'FlipbookView',
        operation: 'copyToClipboard',
        metadata: { url },
      }, {
        showToast: false, // We'll show custom fallback
      });

      // Enhanced fallback with retry option
      toast.info('Share this flipbook', {
        description: url,
        action: {
          label: 'Copy',
          onClick: () => {
            logFlipbookOperation('Fallback copy attempted', flipbook?.id || 'unknown', currentPhase, {
              url,
              method: 'fallback',
            });

            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              
              logFlipbookOperation('Fallback copy successful', flipbook?.id || 'unknown', currentPhase, {
                url,
                method: 'fallback',
                success: true,
              });
              
              toast.success('Copied!', { description: 'URL copied to clipboard.' });
            } catch (err) {
              logFlipbookError(
                err as Error,
                flipbook?.id || 'unknown',
                currentPhase,
                'handleShare',
                { url, method: 'fallback' }
              );

              handleError(err, {
                component: 'FlipbookView',
                operation: 'fallbackCopy',
              });
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

  // Debug utility - expose performance data in development
  useEffect(() => {
    if (isDevelopment) {
      (window as any).flipbookDebug = {
        getPerformanceData: () => flipbookPerformanceMonitor.exportPerformanceData(),
        getPerformanceSummary: () => flipbookPerformanceMonitor.getPerformanceSummary(),
        getLogs: () => flipbookLogger.exportLogsForDebugging(),
        getLogsForFlipbook: (flipbookId: string) => flipbookLogger.getLogsForFlipbook(flipbookId),
        clearMetrics: () => {
          flipbookPerformanceMonitor.clearMetrics();
          flipbookLogger.clearLogs();
        },
        showDebugPanel: () => setShowDebugPanel(true),
        hideDebugPanel: () => setShowDebugPanel(false),
        toggleDebugPanel: () => setShowDebugPanel(!showDebugPanel),
        exportDebugData: () => debugActions.exportDebugData(),
      };
    }
  }, [showDebugPanel, debugActions]);

  // Keyboard shortcut to toggle debug panel in development
  useEffect(() => {
    if (!isDevelopment) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebugPanel(!showDebugPanel);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDebugPanel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (performanceTimingId) {
        endFlipbookOperation(performanceTimingId, { cancelled: true });
      }
      if (progressTrackerId) {
        completeFlipbookProgress(progressTrackerId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [performanceTimingId, progressTrackerId, timeoutId]);

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

  if (queryError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorDisplay
          error={queryError as Error}
          variant="card"
          title="Unable to Load Flipbook"
          onRetry={() => refetch()}
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

  // Check if flipbook is public
  if (!flipbook.is_public) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorDisplay
          error={new Error('This flipbook is private')}
          variant="card"
          title="Private Flipbook"
          showDetails={false}
          className="w-full max-w-md"
        />
      </div>
    );
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

        {/* Debug Panel for Development */}
        {isDevelopment && showDebugPanel && (
          <div className="mb-8">
            <FlipbookDebugPanel 
              flipbookId={flipbook?.id} 
              onClose={() => setShowDebugPanel(false)} 
            />
          </div>
        )}

        {/* Debug Toggle Button for Development */}
        {isDevelopment && !showDebugPanel && (
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugPanel(true)}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Bug className="w-4 h-4 mr-2" />
              Debug Tools
            </Button>
          </div>
        )}

        {/* Enhanced Loading State Display with User Controls */}
        {(loadingState !== 'complete' && loadingState !== 'idle' && loadingState !== 'timeout' && !pdfDocument) && (
          <div className="mb-8 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-4">
            <FlipbookLoading
              phase={loadingState as any}
              progress={loadingProgress.percentage}
              message={loadingProgress.message}
              timeElapsed={loadingProgress.timeElapsed}
              estimatedTimeRemaining={loadingProgress.estimatedDuration ? loadingProgress.estimatedDuration - loadingProgress.timeElapsed : undefined}
              onCancel={cancelOperation}
              onExtendTimeout={extendTimeout}
              onTryAlternative={tryAlternativeLoading}
              showControls={true}
              isSlowConnection={isSlowConnection}
              className="transition-all duration-300 ease-in-out"
            />
          </div>
        )}

        {/* Alternative: Cancellable Loading for Long Operations */}
        {isProcessing && loadingProgress.timeElapsed > 20000 && (
          <div className="mb-8 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-bottom-4">
            <CancellableLoading
              operation="Processing Large PDF"
              progress={loadingProgress.percentage}
              timeElapsed={loadingProgress.timeElapsed}
              onCancel={cancelOperation}
              onExtendTimeout={extendTimeout}
              onTryAlternative={tryAlternativeLoading}
              showAlternativeAfter={25000}
            />
          </div>
        )}

        {/* Timeout State with Enhanced UI */}
        {loadingState === 'timeout' && (
          <div className="mb-8 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-4">
            <Card className="border-red-200 border-2 bg-red-50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-full bg-red-100 border border-red-200">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-red-700">Operation Timed Out</h3>
                      <p className="text-sm text-red-600">
                        This is taking longer than expected. You can extend the timeout or cancel the operation.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-red-600">
                    <span>Phase: {loadingProgress.phase.replace('_', ' ')}</span>
                    <span>
                      {Math.round(loadingProgress.timeElapsed / 1000)}s elapsed
                    </span>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={extendTimeout}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Extend Timeout
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={cancelOperation}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Processing - Enhanced with smooth transitions */}
        {isProcessing && loadingState === 'complete' && (
          <div className="mb-8 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-bottom-4">
            <Card className="border-green-200 border-2 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-full bg-green-100 border border-green-200">
                    <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-green-700">Finalizing Flipbook</h3>
                    <p className="text-sm text-green-600">
                      PDF processed successfully, preparing viewer...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
            flipbookCount={flipbooks.length}
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
