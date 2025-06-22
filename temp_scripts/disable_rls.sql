-- Drop all existing policies on master_admins table
DROP POLICY IF EXISTS "Super admins can manage master admins" ON master_admins;
DROP POLICY IF EXISTS "All master admins can view other master admins" ON master_admins;
DROP POLICY IF EXISTS "Authenticated users can view master_admins" ON master_admins;
DROP POLICY IF EXISTS "Allow initial login check" ON master_admins;
DROP POLICY IF EXISTS "master_admin_view_admins" ON master_admins;
DROP POLICY IF EXISTS "super_admin_manage_admins" ON master_admins;
DROP POLICY IF EXISTS "Regular admins can view master_admins" ON master_admins;
DROP POLICY IF EXISTS "Allow all authenticated users to view master_admins" ON master_admins;
DROP POLICY IF EXISTS "Allow super admins to manage master_admins" ON master_admins;

-- Completely disable RLS on the master_admins table
ALTER TABLE master_admins DISABLE ROW LEVEL SECURITY;

-- Make sure our user is still in the master_admins table with super admin privileges
SELECT * FROM master_admins WHERE email = 'master.florinp@gmail.com';

-- If needed, update the user to be a super admin
UPDATE master_admins
SET is_super_admin = true
WHERE email = 'master.florinp@gmail.com';
