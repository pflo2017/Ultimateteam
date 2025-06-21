-- Fix activity_presence table policies
-- Based on database inspection results

-- Add missing DELETE policy for parents
CREATE POLICY "Parents can delete presence" 
ON public.activity_presence
FOR DELETE 
TO public
USING (auth.uid() = parent_id);

-- Verify existing policies are correct
-- The following policies should already exist:
-- 1. "Everyone can read presence" (SELECT - PERMISSIVE)
-- 2. "Parents can manage presence" (INSERT - PERMISSIVE)
-- 3. "Parents can update presence" (UPDATE - PERMISSIVE)

-- Make sure Row Level Security remains enabled
ALTER TABLE public.activity_presence FORCE ROW LEVEL SECURITY;

-- Verify RLS is enabled with:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'activity_presence'; 