-- Comprehensive fix for activity_presence table RLS policies
-- This resolves the "new row violates row-level security policy" error

-- First disable RLS temporarily to ensure we can modify the table
ALTER TABLE public.activity_presence DISABLE ROW LEVEL SECURITY;

-- Make sure parent_id column exists
ALTER TABLE public.activity_presence ADD COLUMN IF NOT EXISTS parent_id UUID;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Parents can manage presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can update presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Everyone can read presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Everyone can modify presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can delete presence" ON public.activity_presence;

-- Re-enable RLS
ALTER TABLE public.activity_presence ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies:

-- 1. Everyone can read all presence records
CREATE POLICY "Everyone can read presence" 
ON public.activity_presence 
FOR SELECT 
USING (true);

-- 2. Parents can insert records for their children, setting themselves as parent_id
CREATE POLICY "Parents can insert presence" 
ON public.activity_presence 
FOR INSERT 
TO public
WITH CHECK (auth.uid() = parent_id);

-- 3. Parents can update records where they are the parent_id
CREATE POLICY "Parents can update presence" 
ON public.activity_presence 
FOR UPDATE 
TO public
USING (auth.uid() = parent_id);

-- 4. Parents can delete records where they are the parent_id
CREATE POLICY "Parents can delete presence" 
ON public.activity_presence 
FOR DELETE 
TO public
USING (auth.uid() = parent_id);

-- Force RLS to ensure it's applied
ALTER TABLE public.activity_presence FORCE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
WHERE
    tablename = 'activity_presence';

-- Verify RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'activity_presence'; 