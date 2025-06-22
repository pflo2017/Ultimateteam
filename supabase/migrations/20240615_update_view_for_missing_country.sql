-- Update the club_details view to better handle missing country data
DROP VIEW IF EXISTS club_details;

CREATE OR REPLACE VIEW club_details AS
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
  ap.admin_name,
  COALESCE(ap.admin_email, (SELECT email FROM auth.users WHERE id = c.admin_id)) AS admin_email,
  -- Use city as location if country is missing
  CASE 
    WHEN c.city IS NOT NULL AND (c.country IS NULL OR c.country = '') THEN c.city
    WHEN c.city IS NOT NULL AND c.country IS NOT NULL AND c.country != '' THEN c.city || ', ' || c.country
    ELSE 'No location data'
  END AS location
FROM 
  clubs c
LEFT JOIN
  admin_profiles ap ON c.admin_id = ap.user_id; 