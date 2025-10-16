-- Grant execute permission on increment_view_count to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO anon, authenticated;

-- Ensure RLS policy allows anonymous insertions
DROP POLICY IF EXISTS "Anyone can insert views" ON public.flipbook_views;
CREATE POLICY "Anyone can insert views"
ON public.flipbook_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);