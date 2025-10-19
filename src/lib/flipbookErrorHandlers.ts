/**
 * Specific error handlers for different flipbook failure types
 * Handles network connectivity, CORS, PDF validation, and authentication issues
 */

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { flipbookLogger, logFlipbookError, logFlipbookOperation } from './flipbookLogger';
import { FlipbookError, retryFlipbookOperation } from './flipbookErrorRecovery';

export interface ErrorHandlerResult {
  success: boolean;
  message: string;
  shouldRetry: boolean;
  fallbackAction?: () => void | Promise<void>;
  data?: any;
}

/**
 * Network connectivity error handler
 */
export class NetworkErrorHandler {
  /**
   * Check if user is online
   */
  static isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Test network connectivity by pinging a reliable endpoint
   */
  static async testConnectivity(): Promise<boolean> {
    try {
      // Try to fetch a small resource with no-cache to test real connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Handle network connectivity issues
   */
  static async handleNetworkError(
    error: Error,
    context: { flipbookId?: string; operation?: string }
  ): Promise<ErrorHandlerResult> {
    logFlipbookOperation(
      'Handling network error',
      context.flipbookId || 'unknown',
      'error',
      { online: this.isOnline(), errorMessage: error.message }
    );

    // Check if user is offline
    if (!this.isOnline()) {
      return {
        success: false,
        message: 'No internet connection detected. Please check your network connection.',
        shouldRetry: false,
        fallbackAction: () => {
          toast.info('Offline Mode', {
            description: 'You appear to be offline. Please check your internet connection and try again.',
            action: {
              label: 'Retry',
              onClick: () => window.location.reload()
            }
          });
        }
      };
    }

    // Test actual connectivity
    const hasConnectivity = await this.testConnectivity();
    if (!hasConnectivity) {
      return {
        success: false,
        message: 'Unable to reach our servers. Please check your internet connection.',
        shouldRetry: true,
        fallbackAction: () => {
          toast.error('Connection Problem', {
            description: 'Unable to reach our servers. This might be a temporary network issue.',
            action: {
              label: 'Test Connection',
              onClick: () => {
                window.open('https://www.google.com', '_blank');
              }
            }
          });
        }
      };
    }

    // Network is available, suggest retry
    return {
      success: false,
      message: 'Network request failed. This might be a temporary issue.',
      shouldRetry: true,
      fallbackAction: () => {
        toast.info('Network Issue', {
          description: 'The request failed but your connection appears to be working. This might be a temporary server issue.',
        });
      }
    };
  }
}

/**
 * CORS error handler with proxy fallback
 */
export class CORSErrorHandler {
  /**
   * Detect if error is CORS-related
   */
  static isCORSError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('cors') || 
           message.includes('cross-origin') ||
           message.includes('blocked by cors') ||
           message.includes('access-control-allow-origin');
  }

  /**
   * Generate proxy URL for CORS bypass
   */
  static generateProxyUrl(originalUrl: string): string {
    // In a real implementation, you might use a CORS proxy service
    // For now, we'll use a simple proxy endpoint
    const proxyBase = '/api/proxy';
    return `${proxyBase}?url=${encodeURIComponent(originalUrl)}`;
  }

  /**
   * Handle CORS errors with proxy fallback
   */
  static async handleCORSError(
    error: Error,
    originalUrl: string,
    context: { flipbookId?: string; operation?: string }
  ): Promise<ErrorHandlerResult> {
    logFlipbookOperation(
      'Handling CORS error',
      context.flipbookId || 'unknown',
      'error',
      { originalUrl, errorMessage: error.message }
    );

    // Try proxy URL as fallback
    const proxyUrl = this.generateProxyUrl(originalUrl);
    
    try {
      // Test if proxy URL works
      const response = await fetch(proxyUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        logFlipbookOperation(
          'CORS proxy fallback available',
          context.flipbookId || 'unknown',
          'error',
          { proxyUrl, success: true }
        );

        return {
          success: true,
          message: 'Using proxy to bypass CORS restrictions.',
          shouldRetry: true,
          data: { proxyUrl },
          fallbackAction: () => {
            toast.info('Using Alternative Route', {
              description: 'We\'re using an alternative method to access the PDF file.'
            });
          }
        };
      }
    } catch (proxyError) {
      logFlipbookError(
        proxyError as Error,
        context.flipbookId || 'unknown',
        'error',
        'corsProxyFallback',
        { proxyUrl, originalUrl }
      );
    }

    // Proxy not available, suggest alternatives
    return {
      success: false,
      message: 'Unable to access the PDF file due to security restrictions.',
      shouldRetry: false,
      fallbackAction: () => {
        toast.error('Access Restricted', {
          description: 'The PDF file cannot be accessed due to security restrictions. You can try downloading it directly.',
          action: {
            label: 'Download PDF',
            onClick: () => {
              window.open(originalUrl, '_blank');
            }
          }
        });
      }
    };
  }
}

/**
 * PDF format validation and corruption detection
 */
export class PDFValidationHandler {
  /**
   * Validate PDF URL accessibility
   */
  static async validatePDFUrl(url: string): Promise<{ valid: boolean; error?: string; size?: number }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `PDF not accessible (HTTP ${response.status})`
        };
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf')) {
        return {
          valid: false,
          error: `Invalid content type: ${contentType}. Expected PDF file.`
        };
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength, 10) : undefined;

      // Check if file is too large (>100MB)
      if (size && size > 100 * 1024 * 1024) {
        return {
          valid: false,
          error: 'PDF file is too large (>100MB). Please use a smaller file.',
          size
        };
      }

      // Check if file is empty
      if (size === 0) {
        return {
          valid: false,
          error: 'PDF file appears to be empty.',
          size
        };
      }

      return { valid: true, size };
    } catch (error) {
      return {
        valid: false,
        error: `Unable to validate PDF: ${(error as Error).message}`
      };
    }
  }

  /**
   * Detect PDF corruption by attempting to read header
   */
  static async detectPDFCorruption(url: string): Promise<{ corrupted: boolean; error?: string }> {
    try {
      // Fetch first few bytes to check PDF header
      const response = await fetch(url, {
        headers: {
          'Range': 'bytes=0-1023' // First 1KB should contain PDF header
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return {
          corrupted: true,
          error: 'Unable to read PDF file'
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Check for PDF header (%PDF-)
      const pdfHeader = '%PDF-';
      const headerBytes = new TextDecoder().decode(bytes.slice(0, 5));
      
      if (!headerBytes.startsWith(pdfHeader)) {
        return {
          corrupted: true,
          error: 'File does not appear to be a valid PDF (missing PDF header)'
        };
      }

      return { corrupted: false };
    } catch (error) {
      return {
        corrupted: true,
        error: `Unable to validate PDF format: ${(error as Error).message}`
      };
    }
  }

  /**
   * Handle PDF format and corruption errors
   */
  static async handlePDFValidationError(
    error: Error,
    pdfUrl: string,
    context: { flipbookId?: string; operation?: string }
  ): Promise<ErrorHandlerResult> {
    logFlipbookOperation(
      'Handling PDF validation error',
      context.flipbookId || 'unknown',
      'error',
      { pdfUrl, errorMessage: error.message }
    );

    // First, validate URL accessibility
    const urlValidation = await this.validatePDFUrl(pdfUrl);
    if (!urlValidation.valid) {
      return {
        success: false,
        message: urlValidation.error || 'PDF file is not accessible',
        shouldRetry: false,
        fallbackAction: () => {
          toast.error('PDF Not Accessible', {
            description: urlValidation.error,
            action: {
              label: 'Try Direct Link',
              onClick: () => {
                window.open(pdfUrl, '_blank');
              }
            }
          });
        }
      };
    }

    // Check for corruption
    const corruptionCheck = await this.detectPDFCorruption(pdfUrl);
    if (corruptionCheck.corrupted) {
      return {
        success: false,
        message: corruptionCheck.error || 'PDF file appears to be corrupted',
        shouldRetry: false,
        fallbackAction: () => {
          toast.error('PDF File Issue', {
            description: 'The PDF file appears to be corrupted or in an unsupported format.',
            action: {
              label: 'Download Original',
              onClick: () => {
                window.open(pdfUrl, '_blank');
              }
            }
          });
        }
      };
    }

    // PDF seems valid, suggest retry
    return {
      success: false,
      message: 'PDF processing failed but the file appears to be valid. This might be a temporary issue.',
      shouldRetry: true,
      fallbackAction: () => {
        toast.info('Processing Issue', {
          description: 'The PDF file appears to be valid but processing failed. This might be a temporary issue with the PDF processor.'
        });
      }
    };
  }
}

/**
 * Authentication error handler with automatic token refresh
 */
export class AuthenticationErrorHandler {
  /**
   * Detect if error is authentication-related
   */
  static isAuthError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('auth') || 
           message.includes('unauthorized') || 
           message.includes('token') ||
           message.includes('session') ||
           message.includes('401');
  }

  /**
   * Attempt to refresh authentication token
   */
  static async refreshAuthToken(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (data.session) {
        return { success: true };
      }

      return {
        success: false,
        error: 'No active session found'
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle authentication errors with automatic refresh
   */
  static async handleAuthError(
    error: Error,
    context: { flipbookId?: string; operation?: string }
  ): Promise<ErrorHandlerResult> {
    logFlipbookOperation(
      'Handling authentication error',
      context.flipbookId || 'unknown',
      'error',
      { errorMessage: error.message }
    );

    // Try to refresh the token
    const refreshResult = await this.refreshAuthToken();
    
    if (refreshResult.success) {
      logFlipbookOperation(
        'Authentication token refreshed successfully',
        context.flipbookId || 'unknown',
        'error',
        { success: true }
      );

      return {
        success: true,
        message: 'Authentication token refreshed successfully.',
        shouldRetry: true,
        fallbackAction: () => {
          toast.success('Authentication Restored', {
            description: 'Your session has been refreshed. Please try again.'
          });
        }
      };
    }

    // Token refresh failed, redirect to login
    logFlipbookError(
      new Error(`Token refresh failed: ${refreshResult.error}`),
      context.flipbookId || 'unknown',
      'error',
      'authTokenRefresh'
    );

    return {
      success: false,
      message: 'Authentication session expired. Please sign in again.',
      shouldRetry: false,
      fallbackAction: () => {
        toast.error('Session Expired', {
          description: 'Your session has expired. Please sign in again to continue.',
          action: {
            label: 'Sign In',
            onClick: () => {
              // Clear any cached auth data
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/auth';
            }
          }
        });
      }
    };
  }
}

/**
 * Comprehensive error handler that routes to specific handlers
 */
export class FlipbookErrorHandler {
  /**
   * Handle any flipbook-related error with appropriate strategy
   */
  static async handleError(
    error: Error,
    context: { 
      flipbookId?: string; 
      operation?: string; 
      pdfUrl?: string;
      [key: string]: any;
    }
  ): Promise<ErrorHandlerResult> {
    logFlipbookOperation(
      'Processing error with comprehensive handler',
      context.flipbookId || 'unknown',
      'error',
      { errorType: error.name, errorMessage: error.message, operation: context.operation }
    );

    // Route to specific error handlers based on error type
    if (NetworkErrorHandler.isOnline() === false || error.message.toLowerCase().includes('network')) {
      return NetworkErrorHandler.handleNetworkError(error, context);
    }

    if (CORSErrorHandler.isCORSError(error)) {
      return CORSErrorHandler.handleCORSError(error, context.pdfUrl || '', context);
    }

    if (AuthenticationErrorHandler.isAuthError(error)) {
      return AuthenticationErrorHandler.handleAuthError(error, context);
    }

    if (error.message.toLowerCase().includes('pdf') && context.pdfUrl) {
      return PDFValidationHandler.handlePDFValidationError(error, context.pdfUrl, context);
    }

    // Default error handling
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      shouldRetry: true,
      fallbackAction: () => {
        toast.error('Unexpected Error', {
          description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
          action: {
            label: 'Retry',
            onClick: () => {
              window.location.reload();
            }
          }
        });
      }
    };
  }
}