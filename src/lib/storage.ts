import { supabase } from '@/integrations/supabase/client';

// Storage bucket names
export const STORAGE_BUCKETS = {
  FLIPBOOK_PDFS: 'flipbook-pdfs',
  FLIPBOOK_ASSETS: 'flipbook-assets',
} as const;

// Upload a PDF file to Supabase Storage
export const uploadPDF = async (
  file: File,
  userId: string,
  flipbookId: string
): Promise<{ data: string | null; error: string | null }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${flipbookId}.${fileExt}`;
    
    console.log('Uploading PDF:', { fileName, userId, flipbookId, fileSize: file.size });
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { data: null, error: `Storage error: ${error.message}` };
    }

    if (!data) {
      console.error('No data returned from storage upload');
      return { data: null, error: 'No data returned from storage' };
    }

    // Get public URL for PDF access
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
      .getPublicUrl(fileName);

    console.log('PDF uploaded successfully:', urlData.publicUrl);
    return { data: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return { data: null, error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

// Upload an asset (logo, image) to Supabase Storage
export const uploadAsset = async (
  file: File,
  userId: string,
  type: 'logo' | 'cover' = 'logo'
): Promise<{ data: string | null; error: string | null }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${type}_${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.FLIPBOOK_ASSETS)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading asset:', error);
      return { data: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.FLIPBOOK_ASSETS)
      .getPublicUrl(fileName);

    return { data: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading asset:', error);
    return { data: null, error: 'Failed to upload asset' };
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
      console.error('Error deleting file:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { error: 'Failed to delete file' };
  }
};

// Get a signed URL for private file access
export const getSignedUrl = async (
  bucket: string,
  fileName: string,
  expiresIn: number = 3600
): Promise<{ data: string | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { data: null, error: error.message };
    }

    return { data: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return { data: null, error: 'Failed to create signed URL' };
  }
};

// Get public URL for a file
export const getPublicUrl = (bucket: string, fileName: string): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  return data.publicUrl;
};

// Get a fresh signed URL for PDF access
export const getPDFUrl = async (fileName: string): Promise<{ data: string | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.FLIPBOOK_PDFS)
      .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours expiry

    if (error) {
      console.error('Error creating PDF signed URL:', error);
      return { data: null, error: error.message };
    }

    return { data: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error creating PDF signed URL:', error);
    return { data: null, error: 'Failed to create PDF URL' };
  }
};
