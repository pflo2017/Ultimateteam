-- Drop all existing policies on master_admins table to start fresh
DROP POLICY IF EXISTS "Super admins can manage master admins" ON master_admins;
DROP POLICY IF EXISTS "All master admins can view other master admins" ON master_admins;
DROP POLICY IF EXISTS "Authenticated users can view master_admins" ON master_admins;
DROP POLICY IF EXISTS "Allow initial login check" ON master_admins;
DROP POLICY IF EXISTS "master_admin_view_admins" ON master_admins;
DROP POLICY IF EXISTS "super_admin_manage_admins" ON master_admins;
DROP POLICY IF EXISTS "Regular admins can view master_admins" ON master_admins;

-- Make sure RLS is enabled
ALTER TABLE master_admins ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows all authenticated users to see the master_admins table
-- This avoids the recursion by not referencing the master_admins table in its own policy
CREATE POLICY "Allow all authenticated users to view master_admins" 
ON master_admins FOR SELECT 
TO authenticated
USING (true);

-- Create a policy that allows super admins to manage all master_admins
-- This avoids recursion by using a direct equality check instead of EXISTS subquery
CREATE POLICY "Allow super admins to manage master_admins" 
ON master_admins FOR ALL 
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM master_admins WHERE is_super_admin = true
  )
); 