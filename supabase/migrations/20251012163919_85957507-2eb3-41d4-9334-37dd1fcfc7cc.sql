-- Fix search_path for increment_view_count function to address security warning
DROP FUNCTION IF EXISTS public.increment_view_count(uuid);

CREATE OR REPLACE FUNCTION public.increment_view_count(flipbook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.flipbooks 
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = flipbook_id;
END;
$$;