-- SIMPLE FIX: Add RLS policies to allow master admins to access club_details view
-- This script directly adds the necessary policies

-- 1. Add policy to allow master admins to view club_details
CREATE POLICY IF NOT EXISTS "Master admins can view club_details" ON club_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- 2. Add policy to allow master admins to view admin_profiles
CREATE POLICY IF NOT EXISTS "Master admins can view all admin profiles" ON admin_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- 3. Test the view access
SELECT 
  'Testing club_details access' as info,
  COUNT(*) as total_clubs,
  COUNT(CASE WHEN admin_name IS NOT NULL THEN 1 END) as clubs_with_admin_name,
  COUNT(CASE WHEN admin_email IS NOT NULL THEN 1 END) as clubs_with_admin_email
FROM club_details;

-- 4. Show sample data to verify admin fields are now accessible
SELECT 
  'Sample club_details data' as info,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city
FROM club_details
ORDER BY name
LIMIT 3; 