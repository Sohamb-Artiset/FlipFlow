import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker with local file first, then CDN fallbacks
const workerSrcs = [
  '/pdf.worker.min.mjs', // Local worker file
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

export class PDFProcessor {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  async loadPDF(pdfUrl: string): Promise<PDFDocument> {
    try {
      // Load the PDF using a resilient worker fallback strategy
      this.pdfDocument = await getDocumentWithWorkerFallback(
        {
          url: pdfUrl,
          disableAutoFetch: false,
          disableStream: false,
        },
        workerSrcs,
        6000
      );
      
      const pages: PDFPage[] = [];
      const totalPages = this.pdfDocument.numPages;

      // Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

        // Create canvas to render the page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Failed to get canvas context');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;

        // Convert canvas to base64 image
        const imageData = canvas.toDataURL('image/jpeg', 0.9);

        pages.push({
          pageNumber: pageNum,
          imageData,
          width: viewport.width,
          height: viewport.height,
        });
      }

        return {
          pages,
          totalPages,
          title: 'Untitled Document',
        };
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error('Failed to load PDF document');
    }
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
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  destroy(): void {
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
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
