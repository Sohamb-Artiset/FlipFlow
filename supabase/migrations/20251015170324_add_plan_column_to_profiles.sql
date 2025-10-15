-- Add plan column to profiles table for subscription plan limits feature
-- This migration adds a plan column with default 'free' value to support
-- the subscription plan limits functionality

-- Add plan column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN plan TEXT DEFAULT 'free' NOT NULL;

-- Add check constraint to ensure only valid plan values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_plan_check 
CHECK (plan IN ('free', 'premium'));

-- Create index on plan column for efficient queries
CREATE INDEX idx_profiles_plan ON public.profiles(plan);

-- Update the handle_new_user function to explicitly set plan for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles with explicit plan assignment
  INSERT INTO public.profiles (id, email, full_name, plan)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free'  -- Explicitly set new users to free plan
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Ensure all existing profiles have the free plan (safety measure)
-- This handles any edge cases where existing data might not have the default applied
UPDATE public.profiles 
SET plan = 'free' 
WHERE plan IS NULL;