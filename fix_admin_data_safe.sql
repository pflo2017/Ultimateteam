-- SAFE FIX SCRIPT - ONLY UPDATES DATA, NO STRUCTURAL CHANGES
-- This script only updates missing admin data without touching views or table structures

-- 1. First, let's see what we're working with
SELECT 
  'Before fix - admin_profiles status' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN admin_name IS NOT NULL AND admin_name != '' THEN 1 END) as records_with_admin_name,
  COUNT(CASE WHEN admin_email IS NOT NULL AND admin_email != '' THEN 1 END) as records_with_admin_email
FROM admin_profiles;

-- 2. Update admin_profiles with missing admin_email from auth.users (SAFE)
UPDATE public.admin_profiles ap
SET admin_email = u.email
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_email IS NULL OR ap.admin_email = '');

-- 3. Update admin_profiles with missing admin_name from auth.users (SAFE)
UPDATE public.admin_profiles ap
SET admin_name = COALESCE(u.raw_user_meta_data->>'name', 'Unknown Admin')
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_name IS NULL OR ap.admin_name = '');

-- 4. Create admin_profiles records for club admins that don't have them (SAFE)
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

-- 5. Check the results after the fix
SELECT 
  'After fix - admin_profiles status' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN admin_name IS NOT NULL AND admin_name != '' THEN 1 END) as records_with_admin_name,
  COUNT(CASE WHEN admin_email IS NOT NULL AND admin_email != '' THEN 1 END) as records_with_admin_email
FROM admin_profiles;

-- 6. Test the club_details view to see if it now returns admin data
SELECT 
  'Test club_details view after data fix' as info,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city,
  country
FROM club_details
ORDER BY name; 