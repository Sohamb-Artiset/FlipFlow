-- Fix flipbook_views RLS policies to allow public analytics
DROP POLICY IF EXISTS "Anyone can insert views" ON public.flipbook_views;
DROP POLICY IF EXISTS "Flipbook owners can view their analytics" ON public.flipbook_views;

-- Allow anyone to insert views (for public flipbook tracking)
CREATE POLICY "Anyone can insert views"
ON public.flipbook_views
FOR INSERT
TO public
WITH CHECK (true);

-- Allow flipbook owners to view analytics
CREATE POLICY "Owners can view analytics"
ON public.flipbook_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.flipbooks
    WHERE flipbooks.id = flipbook_views.flipbook_id
    AND flipbooks.user_id = auth.uid()
  )
);

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Users can upload their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public assets" ON storage.objects;

-- Add storage RLS policies for flipbook-pdfs bucket
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'flipbook-pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'flipbook-pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'flipbook-pdfs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view public PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'flipbook-pdfs');

-- Add storage RLS policies for flipbook-assets bucket
CREATE POLICY "Users can upload their own assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'flipbook-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'flipbook-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'flipbook-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view public assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'flipbook-assets');