-- Create storage buckets for flipbooks
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'flipbook-pdfs',
    'flipbook-pdfs',
    true,
    104857600, -- 100MB limit
    ARRAY['application/pdf']
  ),
  (
    'flipbook-assets',
    'flipbook-assets',
    true,
    5242880, -- 5MB limit for logos and images
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  );

-- RLS policies for flipbook-pdfs bucket (public read)
CREATE POLICY "Anyone can view PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'flipbook-pdfs');

CREATE POLICY "Users can upload their own PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flipbook-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'flipbook-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'flipbook-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for flipbook-assets bucket (public read, authenticated write)
CREATE POLICY "Anyone can view assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'flipbook-assets');

CREATE POLICY "Users can upload their own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flipbook-assets' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'flipbook-assets' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'flipbook-assets' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to increment view count atomically
CREATE OR REPLACE FUNCTION increment_view_count(flipbook_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.flipbooks 
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = flipbook_id;
END;
$$;
