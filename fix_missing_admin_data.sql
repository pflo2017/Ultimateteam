-- Fix missing admin data by syncing from auth.users to admin_profiles
-- This ensures all club admins have proper name and email in admin_profiles

-- 1. Update admin_profiles with missing admin_email from auth.users
UPDATE public.admin_profiles ap
SET admin_email = u.email
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_email IS NULL OR ap.admin_email = '');

-- 2. Update admin_profiles with missing admin_name from auth.users
UPDATE public.admin_profiles ap
SET admin_name = COALESCE(u.raw_user_meta_data->>'name', 'Unknown Admin')
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_name IS NULL OR ap.admin_name = '');

-- 3. Create admin_profiles records for club admins that don't have them
INSERT INTO public.admin_profiles (user_id, admin_name, admin_email, club_id)
SELECT 
  c.admin_id,
  COALESCE(u.raw_user_meta_data->>'name', 'Unknown Admin') as admin_name,
  u.email as admin_email,
  c.id as club_id
FROM clubs c
JOIN auth.users u ON c.admin_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM admin_profiles ap 
  WHERE ap.user_id = c.admin_id
)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Verify the fixes by checking club_details view
SELECT 
  'After fix - club_details view' as source,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city,
  country
FROM club_details
ORDER BY name;

-- 5. Show summary of what was fixed
SELECT 
  'Summary' as info,
  COUNT(*) as total_clubs,
  COUNT(CASE WHEN admin_name IS NOT NULL AND admin_name != '' THEN 1 END) as clubs_with_admin_name,
  COUNT(CASE WHEN admin_email IS NOT NULL AND admin_email != '' THEN 1 END) as clubs_with_admin_email
FROM club_details; 