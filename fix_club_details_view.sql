-- Check current club_details view structure
SELECT 
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

-- Drop and recreate the club_details view with the correct structure
DROP VIEW IF EXISTS public.club_details;

CREATE OR REPLACE VIEW public.club_details AS
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
  -- Admin information from admin_profiles - use the correct column names
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

-- Verify the view structure after recreation
SELECT 
  'After fix - club_details view structure' as info,
  column_name,
  data_type
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name = 'club_details'
ORDER BY 
  ordinal_position;

-- Test the view with actual data
SELECT 
  'Test data from club_details view' as info,
  id,
  name as club_name,
  admin_id,
  admin_name,
  admin_email,
  city,
  country
FROM club_details
ORDER BY name; 