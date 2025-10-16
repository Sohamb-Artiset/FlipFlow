-- Add policy to allow anyone to view public flipbooks
CREATE POLICY "Anyone can view public flipbooks"
ON public.flipbooks
FOR SELECT
USING (is_public = true);