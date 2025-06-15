-- Create function to update club information
CREATE OR REPLACE FUNCTION update_club_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = now();
  
  -- If club name is being updated, also update it in admin_profiles
  IF OLD.name != NEW.name THEN
    UPDATE admin_profiles
    SET club_name = NEW.name
    WHERE user_id = NEW.admin_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function on club updates
DROP TRIGGER IF EXISTS club_update_trigger ON clubs;
CREATE TRIGGER club_update_trigger
BEFORE UPDATE ON clubs
FOR EACH ROW
EXECUTE FUNCTION update_club_info();

-- Create function to sync club data from admin_profiles
CREATE OR REPLACE FUNCTION sync_club_from_admin_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- If club_name is updated in admin_profiles, update it in clubs
  IF OLD.club_name != NEW.club_name THEN
    UPDATE clubs
    SET name = NEW.club_name
    WHERE admin_id = NEW.user_id;
  END IF;
  
  -- If club_location is updated in admin_profiles, update city in clubs
  IF OLD.club_location != NEW.club_location THEN
    UPDATE clubs
    SET city = NEW.club_location
    WHERE admin_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function on admin_profile updates
DROP TRIGGER IF EXISTS admin_profile_update_trigger ON admin_profiles;
CREATE TRIGGER admin_profile_update_trigger
AFTER UPDATE ON admin_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_club_from_admin_profile(); 