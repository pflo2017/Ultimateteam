-- Safe update to ensure club_details view has correct admin information
-- First, create the view if it doesn't exist, otherwise update it

DO $$
DECLARE
  view_exists boolean;
BEGIN
  -- Check if the view exists
  SELECT EXISTS (
    SELECT FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'club_details'
  ) INTO view_exists;
  
  IF view_exists THEN
    -- View exists, create a safer updated version that preserves existing columns
    EXECUTE '
      CREATE OR REPLACE VIEW public.club_details AS
      SELECT 
        c.id,
        c.name,
        c.city,
        COALESCE(c.country, '''') as country,
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
        -- Location formatting
        CASE 
          WHEN c.city IS NOT NULL AND (c.country IS NULL OR c.country = '''') THEN c.city
          WHEN c.city IS NOT NULL AND c.country IS NOT NULL AND c.country != '''' THEN c.city || '', '' || c.country
          ELSE ''No location data''
        END AS location
      FROM 
        public.clubs c
      LEFT JOIN
        public.admin_profiles ap ON c.admin_id = ap.user_id;
    ';
    
    -- Log a success message
    RAISE NOTICE 'Successfully updated club_details view with admin information';
  ELSE
    -- View doesn't exist, so create it
    EXECUTE '
      CREATE VIEW public.club_details AS
      SELECT 
        c.id,
        c.name,
        c.city,
        COALESCE(c.country, '''') as country,
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
        -- Location formatting
        CASE 
          WHEN c.city IS NOT NULL AND (c.country IS NULL OR c.country = '''') THEN c.city
          WHEN c.city IS NOT NULL AND c.country IS NOT NULL AND c.country != '''' THEN c.city || '', '' || c.country
          ELSE ''No location data''
        END AS location
      FROM 
        public.clubs c
      LEFT JOIN
        public.admin_profiles ap ON c.admin_id = ap.user_id;
    ';
    
    -- Log a success message
    RAISE NOTICE 'Successfully created club_details view with admin information';
  END IF;
END $$;

-- Just update admin_profiles where email is missing (non-destructive)
-- This ensures all admin emails are populated from auth.users if missing
UPDATE public.admin_profiles ap
SET admin_email = u.email
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_email IS NULL OR ap.admin_email = '');

-- Log a simple message
SELECT 'Admin emails synchronized with auth.users for any missing values'; 