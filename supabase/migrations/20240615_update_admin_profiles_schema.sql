-- Ensure admin_profiles table has all necessary columns
DO $$
BEGIN
  -- Add club_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_profiles' AND column_name = 'club_name'
  ) THEN
    ALTER TABLE admin_profiles ADD COLUMN club_name TEXT;
  END IF;

  -- Add club_location column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_profiles' AND column_name = 'club_location'
  ) THEN
    ALTER TABLE admin_profiles ADD COLUMN club_location TEXT;
  END IF;

  -- Add club_logo column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_profiles' AND column_name = 'club_logo'
  ) THEN
    ALTER TABLE admin_profiles ADD COLUMN club_logo TEXT;
  END IF;
END
$$;

-- Sync club data from clubs table to admin_profiles
UPDATE admin_profiles ap
SET 
  club_name = c.name,
  club_location = c.city
FROM 
  clubs c
WHERE 
  ap.user_id = c.admin_id
  AND (ap.club_name IS NULL OR ap.club_location IS NULL); 