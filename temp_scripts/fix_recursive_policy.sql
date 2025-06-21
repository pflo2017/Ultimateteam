-- Fix the infinite recursion in master_admins policy

-- First, let's check the current policy
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'master_admins';

-- Current policy causing recursion:
-- "Super admins can manage master_admins" with qualification:
-- EXISTS (SELECT 1 FROM master_admins ma WHERE ((ma.user_id = auth.uid()) AND (ma.is_super_admin = true)))

-- Step 1: Temporarily disable RLS to break the recursion
ALTER TABLE public.master_admins DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies to start clean
DROP POLICY IF EXISTS "Super admins can manage master_admins" ON public.master_admins;
DROP POLICY IF EXISTS "Users can see their own master_admin record" ON public.master_admins;

-- Step 3: Create a bootstrap policy to allow initial access
-- This policy allows any user with role 'authenticated' to see their own record
CREATE POLICY "Users can see their own master_admin record" ON public.master_admins
    FOR SELECT
    USING (auth.uid() = user_id);

-- Step 4: Create a more restrictive policy for all operations except SELECT
-- For non-SELECT operations, ensure the user is a super admin by checking a materialized view or function
-- that doesn't cause recursion

-- First, create a function that can safely check if a user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
    -- Direct query that bypasses RLS
    RETURN EXISTS (
        SELECT 1 
        FROM public.master_admins 
        WHERE user_id = check_user_id AND is_super_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then create a policy that uses this function
CREATE POLICY "Super admins can manage master_admins" ON public.master_admins
    USING (is_super_admin(auth.uid()));

-- Step 5: Re-enable RLS with the fixed policies
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY; 