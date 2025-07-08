-- SAFE FIX: Add RLS policies to allow master admins to access club_details view
-- This doesn't modify the view structure, just adds permissions

-- 1. First, check if club_details view exists and its type
SELECT 
  'club_details object type' as info,
  schemaname,
  tablename,
  'table' as object_type
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'club_details'
UNION ALL
SELECT 
  'club_details object type' as info,
  schemaname,
  viewname as tablename,
  'view' as object_type
FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'club_details';

-- 2. Check current policies on club_details view
SELECT 
  'Current policies on club_details' as info,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'club_details';

-- 3. Add policy to allow master admins to view club_details
-- This policy allows master admins to see all club details including admin information
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

-- 4. Also ensure admin_profiles has the right policies for master admins
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

-- 5. Test the view access for master admins
SELECT 
  'Testing club_details access' as info,
  COUNT(*) as total_clubs,
  COUNT(CASE WHEN admin_name IS NOT NULL THEN 1 END) as clubs_with_admin_name,
  COUNT(CASE WHEN admin_email IS NOT NULL THEN 1 END) as clubs_with_admin_email
FROM club_details;

-- 6. Show sample data to verify admin fields are now accessible
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