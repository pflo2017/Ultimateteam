-- Fix permissions for parents to update their own data
BEGIN;

-- Confirm Row Level Security is enabled
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Drop any existing update policy to recreate it
DROP POLICY IF EXISTS "Parents can update own data" ON public.parents;

-- Create clear policy for parents to update their own data
CREATE POLICY "Parents can update own data"
ON public.parents
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure correct permissions are granted
GRANT UPDATE ON public.parents TO authenticated;
GRANT UPDATE ON public.parents TO anon;

-- Add policy for public to read non-sensitive fields (for login etc)
DROP POLICY IF EXISTS "Allow public to verify parent accounts" ON public.parents;
CREATE POLICY "Allow public to verify parent accounts"
ON public.parents
FOR SELECT 
TO anon
USING (true);

-- Force reload of RLS policies in PostgREST
NOTIFY pgrst, 'reload config';

COMMIT; 