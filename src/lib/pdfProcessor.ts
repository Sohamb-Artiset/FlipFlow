import * as pdfjsLib from 'pdfjs-dist';
import { retryWithRecovery, ErrorContext } from './errorRecovery';
import { errorHandler } from './errorHandling';
import { retryFlipbookOperation, classifyFlipbookError } from './flipbookErrorRecovery';
import { FlipbookErrorHandler } from './flipbookErrorHandlers';

// Configure PDF.js worker with local file first, then CDN fallbacks
// Use Vite base URL so deployments under a subpath don't 404 the worker
const BASE_URL = (import.meta as any)?.env?.BASE_URL || '/';
const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
const localWorkerPath = `${normalizedBase}/pdf.worker.min.mjs`;

const workerSrcs = [
  localWorkerPath, // Local worker file served from public/
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`
];

// Helper: race a promise against a timeout
const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
};

// Attempt to set a working PDF.js worker source by trying candidates in order
// This avoids the common issue where a local worker path 404s and PDF.js hangs
const getDocumentWithWorkerFallback = async (
  params: Parameters<typeof pdfjsLib.getDocument>[0],
  candidates: string[],
  timeoutMs: number
) => {
  let lastError: unknown = null;
  for (const src of candidates) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = src;
      const docProxy = await withTimeout(
        pdfjsLib.getDocument(params).promise,
        timeoutMs,
        `PDF worker load timed out (${timeoutMs}ms) for: ${src}`
      );
      return docProxy;
    } catch (err) {
      lastError = err;
      // Try next candidate
    }
  }
  throw lastError ?? new Error('Failed to initialize PDF.js worker');
};

export interface PDFPage {
  pageNumber: number;
  imageData: string; // base64 data URL
  width: number;
  height: number;
}

export interface PDFDocument {
  pages: PDFPage[];
  totalPages: number;
  title?: string;
}

export interface PDFLoadingProgress {
  phase: 'downloading' | 'processing' | 'rendering';
  percentage: number;
  currentPage?: number;
  totalPages?: number;
  bytesLoaded?: number;
  totalBytes?: number;
  message: string;
}

export type ProgressCallback = (progress: PDFLoadingProgress) => void;

export class PDFProcessor {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  private progressCallback?: ProgressCallback;

  /**
   * Validates a PDF URL before attempting to load it
   */
  private async validatePDFUrl(url: string): Promise<void> {
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid PDF URL format');
    }

    // Check if URL is accessible
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout for validation
      });
      
      if (!response.ok) {
        throw new Error(`PDF URL not accessible: ${response.status} ${response.statusText}`);
      }

      // Check content type if available
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        console.warn(`Unexpected content type for PDF: ${contentType}`);
      }

      // Check content length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeInMB > 100) {
          throw new Error(`PDF file too large: ${sizeInMB.toFixed(1)}MB (max 100MB)`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('PDF URL validation timed out - server may be slow or unreachable');
        }
        throw error;
      }
      throw new Error('Failed to validate PDF URL accessibility');
    }
  }

  /**
   * Comprehensive PDF accessibility and format validation
   */
  private async validatePDFAccessibilityAndFormat(url: string): Promise<{ size: number; contentType: string }> {
    try {
      // First check with HEAD request for basic accessibility
      let response: Response;
      try {
        response = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
          credentials: 'omit' // Avoid sending credentials for CORS issues
        });
      } catch (headError) {
        // If HEAD fails, try GET with range to check accessibility
        console.warn('HEAD request failed, trying GET with range:', headError);
        response = await fetch(url, { 
          method: 'GET',
          headers: { 'Range': 'bytes=0-1023' }, // First 1KB
          signal: AbortSignal.timeout(8000),
          credentials: 'omit'
        });
      }

      // Check response status
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('PDF access forbidden - check authentication or permissions');
        }
        if (response.status === 404) {
          throw new Error('PDF file not found');
        }
        if (response.status === 429) {
          throw new Error('Too many requests - server is rate limiting');
        }
        if (response.status >= 500) {
          throw new Error('Server error - PDF may be temporarily unavailable');
        }
        throw new Error(`PDF not accessible: ${response.status} ${response.statusText}`);
      }

      // Check CORS headers
      const corsOrigin = response.headers.get('access-control-allow-origin');
      if (corsOrigin === null && window.location.origin !== new URL(url).origin) {
        console.warn('PDF may have CORS restrictions, but will attempt to load');
      }

      // Validate content type
      const contentType = response.headers.get('content-type') || '';
      const validContentTypes = [
        'application/pdf',
        'application/octet-stream',
        'binary/octet-stream'
      ];
      
      if (!validContentTypes.some(type => contentType.includes(type))) {
        // If content type is not PDF-like, try to validate by fetching first few bytes
        if (response.status === 206 || response.headers.get('content-range')) {
          // We got partial content, check if it starts with PDF signature
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const pdfSignature = [0x25, 0x50, 0x44, 0x46]; // %PDF
          
          if (bytes.length >= 4) {
            const hasValidSignature = pdfSignature.every((byte, index) => bytes[index] === byte);
            if (!hasValidSignature) {
              throw new Error(`Invalid PDF format - file does not start with PDF signature`);
            }
          }
        } else {
          console.warn(`Unexpected content type: ${contentType}, but will attempt to process as PDF`);
        }
      }

      // Check file size
      const contentLength = response.headers.get('content-length');
      let fileSize = 0;
      
      if (contentLength) {
        fileSize = parseInt(contentLength);
        const sizeInMB = fileSize / (1024 * 1024);
        
        if (fileSize === 0) {
          throw new Error('PDF file is empty');
        }
        
        if (sizeInMB > 100) {
          throw new Error(`PDF file too large: ${sizeInMB.toFixed(1)}MB (maximum: 100MB)`);
        }
        
        if (sizeInMB > 50) {
          console.warn(`Large PDF file detected: ${sizeInMB.toFixed(1)}MB - loading may be slow`);
        }
      }

      return { size: fileSize, contentType };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('PDF accessibility check timed out - server may be slow or unreachable');
        }
        if (error.message.includes('CORS') || error.message.includes('cors')) {
          throw new Error('PDF blocked by CORS policy - contact administrator');
        }
        if (error.message.includes('network') || error.name === 'TypeError') {
          throw new Error('Network error accessing PDF - check internet connection');
        }
        throw error;
      }
      throw new Error('Failed to validate PDF accessibility and format');
    }
  }

  /**
   * Validates PDF format by checking file signature and basic structure
   */
  private async validatePDFFormat(pdfDocument: pdfjsLib.PDFDocumentProxy): Promise<void> {
    try {
      // Check if document has pages
      if (!pdfDocument.numPages || pdfDocument.numPages === 0) {
        throw new Error('PDF document contains no pages');
      }

      // Check for reasonable page count
      if (pdfDocument.numPages > 500) {
        throw new Error(`PDF has too many pages (${pdfDocument.numPages}). Maximum supported: 500 pages`);
      }

      // Try to get document info to validate structure
      try {
        const info = await pdfDocument.getMetadata();
        if (info && info.info) {
          // Document has valid metadata structure
          console.log('PDF metadata validated successfully');
        }
      } catch (metadataError) {
        console.warn('PDF metadata could not be read, but document structure appears valid');
      }

      // Test first page accessibility
      try {
        const firstPage = await pdfDocument.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.0 });
        
        if (viewport.width <= 0 || viewport.height <= 0) {
          throw new Error('PDF has invalid page dimensions');
        }
        
        // Clean up test page
        firstPage.cleanup();
      } catch (pageError) {
        throw new Error(`PDF first page is corrupted or unreadable: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
      }

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`PDF format validation failed: ${error.message}`);
      }
      throw new Error('PDF format validation failed with unknown error');
    }
  }

  /**
   * Cleans up resources and handles memory management
   */
  private cleanup(): void {
    if (this.pdfDocument) {
      try {
        this.pdfDocument.destroy();
      } catch (error) {
        console.warn('Error during PDF document cleanup:', error);
      } finally {
        this.pdfDocument = null;
      }
    }
  }

  /**
   * Reports progress to the callback if available
   */
  private reportProgress(progress: PDFLoadingProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Loads PDF with progressive loading for large files
   */
  async loadPDFWithProgress(pdfUrl: string, progressCallback?: ProgressCallback): Promise<PDFDocument> {
    this.progressCallback = progressCallback;
    
    try {
      this.reportProgress({
        phase: 'downloading',
        percentage: 0,
        message: 'Starting PDF download...'
      });

      // Step 1: Validate PDF URL before attempting to load
      await this.validatePDFUrl(pdfUrl);
      
      this.reportProgress({
        phase: 'downloading',
        percentage: 10,
        message: 'Validating PDF accessibility...'
      });
      
      // Step 2: Comprehensive accessibility and format validation
      const validationResult = await this.validatePDFAccessibilityAndFormat(pdfUrl);
      const isLargeFile = validationResult.size > 10 * 1024 * 1024; // 10MB threshold
      
      this.reportProgress({
        phase: 'downloading',
        percentage: 20,
        message: `PDF validated - ${formatFileSize(validationResult.size)}`
      });

      if (isLargeFile) {
        return await this.loadLargePDFProgressively(pdfUrl, validationResult.size);
      } else {
        return await this.loadStandardPDF(pdfUrl);
      }
    } finally {
      this.progressCallback = undefined;
    }
  }

  /**
   * Loads large PDFs with chunked processing and progress reporting
   */
  private async loadLargePDFProgressively(pdfUrl: string, fileSize: number): Promise<PDFDocument> {
    const context = {
      operation: 'loadLargePDFProgressively',
      pdfUrl,
      component: 'PDFProcessor',
      fileSize
    };

    this.reportProgress({
      phase: 'downloading',
      percentage: 25,
      totalBytes: fileSize,
      message: 'Downloading large PDF file...'
    });

    // Use enhanced retry mechanism with exponential backoff
    const result = await retryFlipbookOperation(
      async () => {
        try {
          // Clean up any existing document before loading new one
          this.cleanup();

          // Load the PDF using a resilient worker fallback strategy with progress tracking
          this.pdfDocument = await this.loadDocumentWithProgress(pdfUrl, fileSize);
          
          // Step 3: Validate the loaded document format and structure
          await this.validatePDFFormat(this.pdfDocument);

          this.reportProgress({
            phase: 'processing',
            percentage: 60,
            totalPages: this.pdfDocument.numPages,
            message: `Processing ${this.pdfDocument.numPages} pages...`
          });

          // Process pages in chunks to avoid memory issues
          const pages: PDFPage[] = [];
          const totalPages = this.pdfDocument.numPages;
          const chunkSize = Math.min(10, Math.max(1, Math.floor(50 / Math.sqrt(totalPages)))); // Adaptive chunk size

          for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
            const endPage = Math.min(startPage + chunkSize - 1, totalPages);
            
            this.reportProgress({
              phase: 'rendering',
              percentage: 60 + (startPage / totalPages) * 35,
              currentPage: startPage,
              totalPages: totalPages,
              message: `Rendering pages ${startPage}-${endPage} of ${totalPages}...`
            });

            // Process chunk of pages
            const chunkPages = await this.processPageChunk(startPage, endPage);
            pages.push(...chunkPages);

            // Force garbage collection hint for large files
            if (typeof window !== 'undefined' && (window as any).gc) {
              (window as any).gc();
            }

            // Small delay to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          this.reportProgress({
            phase: 'rendering',
            percentage: 95,
            message: 'Finalizing PDF processing...'
          });

          if (pages.length === 0) {
            throw new Error('No pages could be processed from the PDF');
          }

          return {
            pages,
            totalPages: pages.length,
            title: 'Untitled Document',
          };
        } catch (processingError) {
          // Clean up on any processing error
          this.cleanup();
          throw processingError;
        }
      },
      context,
      {
        maxRetries: 2, // Fewer retries for large files
        baseDelay: 3000, // Longer delay for large files
        exponentialBackoff: true,
        jitter: true
      }
    );

    if (result.success && result.data) {
      this.reportProgress({
        phase: 'rendering',
        percentage: 100,
        message: 'PDF processing completed!'
      });
      return result.data;
    }

    // Handle retry failure
    if (result.error) {
      const handlerResult = await FlipbookErrorHandler.handleError(
        new Error(result.error.message),
        context
      );
      
      if (handlerResult.fallbackAction) {
        handlerResult.fallbackAction();
      }
    }

    throw new Error(result.error?.userMessage || 'Failed to load large PDF document');
  }

  /**
   * Loads document with progress tracking for downloads
   */
  private async loadDocumentWithProgress(pdfUrl: string, expectedSize: number): Promise<pdfjsLib.PDFDocumentProxy> {
    // For large files, we'll track download progress if possible
    let loadedBytes = 0;
    
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      disableAutoFetch: false,
      disableStream: false,
    });

    // Track loading progress if supported
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      loadedBytes = progressData.loaded;
      const totalBytes = progressData.total || expectedSize;
      const percentage = Math.min(95, 25 + (loadedBytes / totalBytes) * 35); // 25-60% for download
      
      this.reportProgress({
        phase: 'downloading',
        percentage,
        bytesLoaded: loadedBytes,
        totalBytes: totalBytes,
        message: `Downloaded ${formatFileSize(loadedBytes)} of ${formatFileSize(totalBytes)}...`
      });
    };

    return await loadingTask.promise;
  }

  /**
   * Processes a chunk of PDF pages with memory optimization
   */
  private async processPageChunk(startPage: number, endPage: number): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    
    if (!this.pdfDocument) {
      throw new Error('PDF document not loaded');
    }

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        // Validate viewport dimensions
        if (viewport.width <= 0 || viewport.height <= 0) {
          console.warn(`Invalid viewport dimensions for page ${pageNum}, skipping`);
          page.cleanup();
          continue;
        }

        // Create canvas to render the page
        const canvas = document.createElement('canvas');
        const canvasContext = canvas.getContext('2d');
        
        if (!canvasContext) {
          page.cleanup();
          throw new Error(`Failed to get canvas context for page ${pageNum}`);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the page to canvas with timeout
        await Promise.race([
          page.render({
            canvasContext: canvasContext,
            viewport: viewport,
            canvas: canvas,
          }).promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Page ${pageNum} rendering timed out`)), 30000)
          )
        ]);

        // Convert canvas to base64 image with optimized quality for large files
        const quality = this.pdfDocument.numPages > 100 ? 0.8 : 0.9; // Lower quality for very large documents
        const imageData = canvas.toDataURL('image/jpeg', quality);

        pages.push({
          pageNumber: pageNum,
          imageData,
          width: viewport.width,
          height: viewport.height,
        });

        // Clean up page resources immediately
        page.cleanup();
        
        // Clear canvas to free memory
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        // Continue with other pages instead of failing completely
        continue;
      }
    }

    return pages;
  }

  /**
   * Loads standard-sized PDFs without progressive loading
   */
  private async loadStandardPDF(pdfUrl: string): Promise<PDFDocument> {
    this.reportProgress({
      phase: 'downloading',
      percentage: 30,
      message: 'Loading PDF document...'
    });

    // Use the existing loadPDF logic but with progress reporting
    const context = {
      operation: 'loadStandardPDF',
      pdfUrl,
      component: 'PDFProcessor'
    };

    const result = await retryFlipbookOperation(
      async () => {
        try {
          this.cleanup();

          this.pdfDocument = await getDocumentWithWorkerFallback(
            {
              url: pdfUrl,
              disableAutoFetch: false,
              disableStream: false,
            },
            workerSrcs,
            6000
          );
          
          await this.validatePDFFormat(this.pdfDocument);

          this.reportProgress({
            phase: 'processing',
            percentage: 70,
            totalPages: this.pdfDocument.numPages,
            message: `Processing ${this.pdfDocument.numPages} pages...`
          });

          const pages: PDFPage[] = [];
          const totalPages = this.pdfDocument.numPages;

          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            this.reportProgress({
              phase: 'rendering',
              percentage: 70 + (pageNum / totalPages) * 25,
              currentPage: pageNum,
              totalPages: totalPages,
              message: `Rendering page ${pageNum} of ${totalPages}...`
            });

            try {
              const page = await this.pdfDocument.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2.0 });

              if (viewport.width <= 0 || viewport.height <= 0) {
                console.warn(`Invalid viewport dimensions for page ${pageNum}, skipping`);
                continue;
              }

              const canvas = document.createElement('canvas');
              const canvasContext = canvas.getContext('2d');
              
              if (!canvasContext) {
                throw new Error(`Failed to get canvas context for page ${pageNum}`);
              }

              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await Promise.race([
                page.render({
                  canvasContext: canvasContext,
                  viewport: viewport,
                  canvas: canvas,
                }).promise,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`Page ${pageNum} rendering timed out`)), 30000)
                )
              ]);

              const imageData = canvas.toDataURL('image/jpeg', 0.9);

              pages.push({
                pageNumber: pageNum,
                imageData,
                width: viewport.width,
                height: viewport.height,
              });

              page.cleanup();
            } catch (pageError) {
              console.error(`Error processing page ${pageNum}:`, pageError);
              continue;
            }
          }

          if (pages.length === 0) {
            throw new Error('No pages could be processed from the PDF');
          }

          return {
            pages,
            totalPages: pages.length,
            title: 'Untitled Document',
          };
        } catch (processingError) {
          this.cleanup();
          throw processingError;
        }
      },
      context,
      {
        maxRetries: 3,
        baseDelay: 2000,
        exponentialBackoff: true,
        jitter: true
      }
    );

    if (result.success && result.data) {
      return result.data;
    }

    if (result.error) {
      const handlerResult = await FlipbookErrorHandler.handleError(
        new Error(result.error.message),
        context
      );
      
      if (handlerResult.fallbackAction) {
        handlerResult.fallbackAction();
      }
    }

    throw new Error(result.error?.userMessage || 'Failed to load PDF document');
  }

  async loadPDF(pdfUrl: string): Promise<PDFDocument> {
    // Use the new progressive loading method without progress callback for backward compatibility
    return await this.loadPDFWithProgress(pdfUrl);
  }

  async loadPDFFromFile(file: File): Promise<PDFDocument> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Load PDF from array buffer
          this.pdfDocument = await pdfjsLib.getDocument({
            data: uint8Array,
          }).promise;
          
          const pages: PDFPage[] = [];
          const totalPages = this.pdfDocument.numPages;

          // Process each page
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await this.pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) {
              throw new Error('Failed to get canvas context');
            }

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas,
            }).promise;

            const imageData = canvas.toDataURL('image/jpeg', 0.9);

            pages.push({
              pageNumber: pageNum,
              imageData,
              width: viewport.width,
              height: viewport.height,
            });
          }

          resolve({
            pages,
            totalPages,
            title: file.name.replace('.pdf', ''),
          });
        } catch (error) {
          const context: ErrorContext = {
            component: 'pdfProcessor',
            operation: 'loadPDFFromFile',
            metadata: { fileName: file.name, fileSize: file.size }
          };
          
          errorHandler.handleError(error, context, {
            showToast: false,
            logError: true,
            reportError: true
          });
          
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  destroy(): void {
    this.cleanup();
  }
}

// Utility function to validate PDF file
export const validatePDFFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Please upload a valid PDF file' };
  }

  // Check file size (100MB limit)
  const maxSize = 100 * 1024 * 1024; // 100MB in bytes
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 100MB' };
  }

  // Check if file is empty
  if (file.size === 0) {
    return { valid: false, error: 'File cannot be empty' };
  }

  return { valid: true };
};

// Utility function to get file size in human readable format
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
