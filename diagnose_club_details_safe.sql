-- SAFE DIAGNOSTIC SCRIPT - NO DESTRUCTIVE CHANGES
-- This script only reads data and checks the current state

-- 1. Check current club_details view structure
SELECT 
  'Current club_details view structure' as info,
  column_name,
  data_type,
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name = 'club_details'
ORDER BY 
  ordinal_position;

-- 2. Check what data is actually in the club_details view
SELECT 
  'Data from club_details view' as info,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city,
  country
FROM club_details
ORDER BY name;

-- 3. Check if admin_profiles has the correct data
SELECT 
  'admin_profiles data' as info,
  user_id,
  admin_name,
  admin_email,
  club_id
FROM admin_profiles
ORDER BY admin_name;

-- 4. Cross-reference to see if the join is working
SELECT 
  'Cross-reference check' as info,
  c.name as club_name,
  c.admin_id,
  ap.admin_name,
  ap.admin_email,
  CASE 
    WHEN ap.admin_name IS NULL THEN 'Missing admin_name in admin_profiles'
    ELSE 'admin_name exists'
  END as admin_name_status,
  CASE 
    WHEN ap.admin_email IS NULL THEN 'Missing admin_email in admin_profiles'
    ELSE 'admin_email exists'
  END as admin_email_status
FROM clubs c
LEFT JOIN admin_profiles ap ON c.admin_id = ap.user_id
ORDER BY c.name;

-- 5. Check if there are any column name mismatches
SELECT 
  'Column name check' as info,
  'club_details view columns:' as detail,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'club_details'
UNION ALL
SELECT 
  'admin_profiles table columns:' as info,
  'admin_profiles columns:' as detail,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_profiles'; 