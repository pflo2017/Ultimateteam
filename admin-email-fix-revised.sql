-- First, drop the view if it exists to avoid column rename issues
DROP VIEW IF EXISTS public.club_details;

-- Then create the view with the desired structure
CREATE VIEW public.club_details AS
SELECT 
  c.id,
  c.name,
  c.city,
  COALESCE(c.country, '') as country,
  c.description,
  c.email,
  c.phone_number,
  c.logo_url,
  c.is_suspended,
  c.admin_id,
  c.created_at,
  -- Admin information from admin_profiles
  ap.admin_name,
  ap.admin_email,
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

-- Update admin_profiles where email is missing
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

-- Log the update
SELECT 'Admin emails and names synchronized with auth.users for any missing values'; 