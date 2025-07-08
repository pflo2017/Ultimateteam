-- FINAL FIX: Add RLS policies to allow master admins to access club_details
-- This script safely adds the necessary policies

-- 1. Add policy to allow master admins to view club_details
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'club_details' 
    AND policyname = 'Master admins can view club_details'
  ) THEN
    -- Create policy for master admins to view club_details
    EXECUTE '
      CREATE POLICY "Master admins can view club_details" ON club_details
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM master_admins ma
          WHERE ma.user_id = auth.uid()
        )
      );
    ';
    
    RAISE NOTICE 'Successfully created policy for master admins to view club_details';
  ELSE
    RAISE NOTICE 'Policy already exists for master admins to view club_details';
  END IF;
END $$;

-- 2. Add policy to allow master admins to view admin_profiles
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_profiles' 
    AND policyname = 'Master admins can view all admin profiles'
  ) THEN
    -- Create policy for master admins to view admin_profiles
    EXECUTE '
      CREATE POLICY "Master admins can view all admin profiles" ON admin_profiles
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM master_admins ma
          WHERE ma.user_id = auth.uid()
        )
      );
    ';
    
    RAISE NOTICE 'Successfully created policy for master admins to view admin_profiles';
  ELSE
    RAISE NOTICE 'Policy already exists for master admins to view admin_profiles';
  END IF;
END $$;

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

-- Fix club_details view permissions for master admins
-- Since club_details is a view, we need to add policies to the underlying tables

-- First, let's check what tables the club_details view depends on
DO $$
BEGIN
  RAISE NOTICE 'Adding RLS policies to underlying tables for club_details view access';
END $$;

-- Add policy to clubs table for master admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clubs' 
    AND policyname = 'Master admins can view clubs'
  ) THEN
    CREATE POLICY "Master admins can view clubs" ON clubs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM master_admins ma
        WHERE ma.user_id = auth.uid()
      )
    );
    RAISE NOTICE 'Created policy "Master admins can view clubs"';
  ELSE
    RAISE NOTICE 'Policy "Master admins can view clubs" already exists';
  END IF;
END $$;

-- Add policy to admin_profiles table for master admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_profiles' 
    AND policyname = 'Master admins can view admin_profiles'
  ) THEN
    CREATE POLICY "Master admins can view admin_profiles" ON admin_profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM master_admins ma
        WHERE ma.user_id = auth.uid()
      )
    );
    RAISE NOTICE 'Created policy "Master admins can view admin_profiles"';
  ELSE
    RAISE NOTICE 'Policy "Master admins can view admin_profiles" already exists';
  END IF;
END $$;

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('clubs', 'admin_profiles')
AND policyname LIKE '%Master admins%';

-- Test the club_details view access
SELECT 
  'Testing club_details view access' as test_description,
  COUNT(*) as total_clubs,
  COUNT(admin_name) as clubs_with_admin_name,
  COUNT(admin_email) as clubs_with_admin_email
FROM club_details; 