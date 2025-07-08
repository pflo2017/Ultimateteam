-- Check the current state of club_details view and admin_profiles table
-- This will help us understand if there are data issues causing empty admin fields

-- 1. Check what's in the club_details view
SELECT 
  'club_details view' as source,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city,
  country
FROM club_details
ORDER BY name;

-- 2. Check what's in the admin_profiles table
SELECT 
  'admin_profiles table' as source,
  user_id,
  admin_name,
  admin_email,
  club_id
FROM admin_profiles
ORDER BY admin_name;

-- 3. Check what's in the clubs table
SELECT 
  'clubs table' as source,
  id,
  name as club_name,
  admin_id,
  email as club_email,
  city,
  country
FROM clubs
ORDER BY name;

-- 4. Check auth.users for admin emails
SELECT 
  'auth.users' as source,
  id,
  email,
  raw_user_meta_data->>'name' as user_name
FROM auth.users
WHERE id IN (SELECT admin_id FROM clubs)
ORDER BY raw_user_meta_data->>'name';

-- 5. Cross-reference to find missing admin data
SELECT 
  c.name as club_name,
  c.admin_id,
  c.email as club_email,
  ap.admin_name,
  ap.admin_email,
  u.email as auth_email,
  u.raw_user_meta_data->>'name' as auth_name,
  CASE 
    WHEN ap.admin_name IS NULL OR ap.admin_name = '' THEN 'Missing admin_name'
    ELSE 'OK'
  END as admin_name_status,
  CASE 
    WHEN ap.admin_email IS NULL OR ap.admin_email = '' THEN 'Missing admin_email'
    ELSE 'OK'
  END as admin_email_status
FROM clubs c
LEFT JOIN admin_profiles ap ON c.admin_id = ap.user_id
LEFT JOIN auth.users u ON c.admin_id = u.id
ORDER BY c.name; 