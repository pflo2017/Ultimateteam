-- Drop the existing view
DROP VIEW IF EXISTS public.club_details;

-- Create enhanced club_details view with complete admin profile information
CREATE OR REPLACE VIEW public.club_details AS
SELECT 
  c.id,
  c.name,
  c.city,
  COALESCE(c.country, '') as country,
  c.description,
  c.email as contact_email,
  c.phone_number as contact_phone,
  c.logo_url,
  c.is_suspended,
  c.admin_id,
  c.created_at,
  -- Admin information from admin_profiles
  ap.admin_name,
  ap.admin_email,
  ap.club_logo as admin_club_logo,
  ap.club_location as admin_club_location,
  -- Location formatting
  CASE 
    WHEN c.city IS NOT NULL AND (c.country IS NULL OR c.country = '') THEN c.city
    WHEN c.city IS NOT NULL AND c.country IS NOT NULL AND c.country != '' THEN c.city || ', ' || c.country
    ELSE 'No location data'
  END AS location
FROM 
  public.clubs c
LEFT JOIN
  public.admin_profiles ap ON c.admin_id = ap.user_id;

-- Create function to sync admin_email with auth.users if missing
CREATE OR REPLACE FUNCTION public.sync_missing_admin_emails()
RETURNS VOID AS $$
BEGIN
  -- Update admin_profiles with emails from auth.users where missing
  UPDATE public.admin_profiles ap
  SET admin_email = u.email
  FROM auth.users u
  WHERE ap.user_id = u.id
  AND (ap.admin_email IS NULL OR ap.admin_email = '');

  -- Update admin_name if missing
  UPDATE public.admin_profiles ap
  SET admin_name = COALESCE(u.raw_user_meta_data->>'name', 'Unknown Admin')
  FROM auth.users u
  WHERE ap.user_id = u.id
  AND (ap.admin_name IS NULL OR ap.admin_name = '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to ensure all admin emails are populated
SELECT public.sync_missing_admin_emails();

-- Create trigger to keep admin_email in sync automatically
CREATE OR REPLACE FUNCTION public.sync_admin_email_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If admin_email is NULL or empty, get it from auth.users
  IF NEW.admin_email IS NULL OR NEW.admin_email = '' THEN
    SELECT email INTO NEW.admin_email FROM auth.users WHERE id = NEW.user_id;
  END IF;
  
  -- If admin_name is NULL or empty, get it from auth.users metadata
  IF NEW.admin_name IS NULL OR NEW.admin_name = '' THEN
    SELECT COALESCE(raw_user_meta_data->>'name', 'Unknown Admin') INTO NEW.admin_name 
    FROM auth.users WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger if it doesn't exist
DROP TRIGGER IF EXISTS sync_admin_email_on_insert_trigger ON public.admin_profiles;
CREATE TRIGGER sync_admin_email_on_insert_trigger
BEFORE INSERT OR UPDATE ON public.admin_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_admin_email_on_insert();

-- Add helpful comments
COMMENT ON VIEW public.club_details IS 'Comprehensive view providing club details with full admin profile information';
COMMENT ON FUNCTION public.sync_missing_admin_emails IS 'Function to populate missing admin emails from auth.users table';
COMMENT ON FUNCTION public.sync_admin_email_on_insert IS 'Automatically sync admin_email from auth.users when inserting or updating admin_profiles'; 