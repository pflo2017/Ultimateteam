-- Check existing RLS policies on master_admins table
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'master_admins';

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Super admins can manage master admins" ON master_admins;
DROP POLICY IF EXISTS "All master admins can view other master admins" ON master_admins;

-- Make sure RLS is enabled
ALTER TABLE master_admins ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to see master_admins
-- This is important for the initial login check
CREATE POLICY "Authenticated users can view master_admins" 
ON master_admins FOR SELECT 
TO authenticated
USING (true);

-- Create a policy that allows super admins to manage all master_admins
CREATE POLICY "Super admins can manage master_admins" 
ON master_admins FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma 
    WHERE ma.user_id = auth.uid() 
    AND ma.is_super_admin = true
  )
);

-- Create a policy that allows regular master admins to view other master_admins
CREATE POLICY "Regular admins can view master_admins" 
ON master_admins FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma 
    WHERE ma.user_id = auth.uid()
  )
); 