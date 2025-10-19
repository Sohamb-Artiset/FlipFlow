import { supabase } from '@/integrations/supabase/client';
import { retryWithRecovery, ErrorContext } from './errorRecovery';
import { errorHandler } from './errorHandling';
import { debugLog } from './debugUtils';

// Storage bucket names
export const STORAGE_BUCKETS = {
  FLIPBOOK_PDFS: 'flipbook-pdfs',
  FLIPBOOK_ASSETS: 'flipbook-assets',
} as const;

// Upload a PDF file to Supabase Storage with error recovery
export const uploadPDF = async (
  file: File,
  userId: string,
  flipbookId: string
): Promise<{ data: string | null; error: string | null }> => {
  const context: ErrorContext = {
    component: 'storage',
    operation: 'uploadPDF',
    userId,
    metadata: { flipbookId, fileSize: file.size, fileName: file.name }
  };

  try {
    const result = await retryWithRecovery(
      async () => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${flipbookId}.${fileExt}`;
        
        debugLog.log('Uploading PDF:', { fileName, userId, flipbookId, fileSize: file.size });
        
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/pdf',
          });

        if (error) {
          throw new Error(`Storage error: ${error.message}`);
        }

        if (!data) {
          throw new Error('No data returned from storage');
        }

        // Get public URL for PDF access
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
          .getPublicUrl(fileName);

        debugLog.log('PDF uploaded successfully:', urlData.publicUrl);
        return urlData.publicUrl;
      },
      context,
      {
        maxRetries: 3,
        baseDelay: 2000,
        exponentialBackoff: true,
        onRetry: (attempt, delay) => {
          debugLog.log(`Retrying PDF upload (attempt ${attempt}) in ${delay}ms`);
        }
      }
    );

    return { data: result, error: null };
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, {
      showToast: false, // Let calling component handle user feedback
      logError: true,
      reportError: true
    });
    
    return { 
      data: null, 
      error: errorReport.message || 'Upload failed: Unknown error'
    };
  }
};

// Upload an asset (logo, image) to Supabase Storage with error recovery
export const uploadAsset = async (
  file: File,
  userId: string,
  type: 'logo' | 'cover' = 'logo'
): Promise<{ data: string | null; error: string | null }> => {
  const context: ErrorContext = {
    component: 'storage',
    operation: 'uploadAsset',
    userId,
    metadata: { type, fileSize: file.size, fileName: file.name }
  };

  try {
    const result = await retryWithRecovery(
      async () => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${type}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.FLIPBOOK_ASSETS)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw new Error(`Asset upload error: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.FLIPBOOK_ASSETS)
          .getPublicUrl(fileName);

        return urlData.publicUrl;
      },
      context,
      {
        maxRetries: 3,
        baseDelay: 1500,
        exponentialBackoff: true,
        onRetry: (attempt, delay) => {
          debugLog.log(`Retrying asset upload (attempt ${attempt}) in ${delay}ms`);
        }
      }
    );

    return { data: result, error: null };
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, {
      showToast: false,
      logError: true,
      reportError: true
    });
    
    return { 
      data: null, 
      error: errorReport.message || 'Failed to upload asset'
    };
  }
};

// Delete a file from Supabase Storage
export const deleteFile = async (
  bucket: string,
  fileName: string
): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      debugLog.error('Error deleting file:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    debugLog.error('Error deleting file:', error);
    return { error: 'Failed to delete file' };
  }
};

// Get a signed URL for private file access with error recovery
export const getSignedUrl = async (
  bucket: string,
  fileName: string,
  expiresIn: number = 3600
): Promise<{ data: string | null; error: string | null }> => {
  const context: ErrorContext = {
    component: 'storage',
    operation: 'getSignedUrl',
    metadata: { bucket, fileName, expiresIn }
  };

  try {
    const result = await retryWithRecovery(
      async () => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(fileName, expiresIn);

        if (error) {
          throw new Error(`Signed URL error: ${error.message}`);
        }

        return data.signedUrl;
      },
      context,
      {
        maxRetries: 2,
        baseDelay: 1000,
        exponentialBackoff: true,
        onRetry: (attempt, delay) => {
          debugLog.log(`Retrying signed URL creation (attempt ${attempt}) in ${delay}ms`);
        }
      }
    );

    return { data: result, error: null };
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, {
      showToast: false,
      logError: true,
      reportError: false // Less critical operation
    });
    
    return { 
      data: null, 
      error: errorReport.message || 'Failed to create signed URL'
    };
  }
};

// Get public URL for a file
export const getPublicUrl = (bucket: string, fileName: string): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  return data.publicUrl;
};

// Get a fresh signed URL for PDF access with error recovery
export const getPDFUrl = async (fileName: string): Promise<{ data: string | null; error: string | null }> => {
  const context: ErrorContext = {
    component: 'storage',
    operation: 'getPDFUrl',
    metadata: { fileName }
  };

  try {
    const result = await retryWithRecovery(
      async () => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
          .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours expiry

        if (error) {
          throw new Error(`PDF URL error: ${error.message}`);
        }

        return data.signedUrl;
      },
      context,
      {
        maxRetries: 2,
        baseDelay: 1000,
        exponentialBackoff: true,
        onRetry: (attempt, delay) => {
          debugLog.log(`Retrying PDF URL creation (attempt ${attempt}) in ${delay}ms`);
        }
      }
    );

    return { data: result, error: null };
  } catch (error) {
    const errorReport = errorHandler.handleError(error, context, {
      showToast: false,
      logError: true,
      reportError: false // Less critical operation
    });
    
    return { 
      data: null, 
      error: errorReport.message || 'Failed to create PDF URL'
    };
  }
};
