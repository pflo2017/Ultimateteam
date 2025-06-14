-- Fix admin club association to ensure admin_profiles have club_id
-- This ensures that admins can access their club data properly

-- First, add club_id to admin_profiles if it doesn't exist
ALTER TABLE admin_profiles 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id);

-- Update admin_profiles to set club_id based on the clubs table
UPDATE admin_profiles ap
SET club_id = c.id
FROM clubs c
WHERE c.admin_id = ap.user_id
AND ap.club_id IS NULL;

-- Create a function to ensure admin_profiles always have the correct club_id
CREATE OR REPLACE FUNCTION sync_admin_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new admin_profile is created or updated, set the club_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.club_id IS NULL THEN
    SELECT c.id INTO NEW.club_id
    FROM clubs c
    WHERE c.admin_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set club_id on admin_profiles
DROP TRIGGER IF EXISTS sync_admin_club_id_trigger ON admin_profiles;
CREATE TRIGGER sync_admin_club_id_trigger
BEFORE INSERT OR UPDATE ON admin_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_admin_club_id();

-- Create a function to get an admin's club_id
CREATE OR REPLACE FUNCTION get_admin_club_id(p_admin_id UUID)
RETURNS UUID AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- First try to get from admin_profiles
  SELECT club_id INTO v_club_id
  FROM admin_profiles
  WHERE user_id = p_admin_id;
  
  -- If not found, try to get from clubs
  IF v_club_id IS NULL THEN
    SELECT id INTO v_club_id
    FROM clubs
    WHERE admin_id = p_admin_id
    LIMIT 1;
  END IF;
  
  RETURN v_club_id;
END;
$$ LANGUAGE plpgsql;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS admin_profiles_club_id_idx ON admin_profiles(club_id);

-- Add a comment to explain the purpose
COMMENT ON FUNCTION get_admin_club_id IS 'Gets the club_id for an admin user, first checking admin_profiles then clubs table';
