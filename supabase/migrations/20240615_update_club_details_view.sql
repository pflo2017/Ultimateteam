-- Create a clean view for club details without hardcoded values
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
  ap.name AS admin_name,
  COALESCE(ap.email, (SELECT email FROM auth.users WHERE id = c.admin_id)) AS admin_email,
  c.city || CASE WHEN c.country IS NOT NULL AND c.country != '' THEN ', ' || c.country ELSE '' END AS location
FROM 
  clubs c
LEFT JOIN
  admin_profiles ap ON c.admin_id = ap.user_id;

-- Update admin_profiles for FC Titan specifically
UPDATE admin_profiles
SET email = 'prec.florin@gmail.com'
WHERE user_id IN (
  SELECT admin_id FROM clubs WHERE name = 'Acsc Titan' OR name = 'FC Titan'
);

-- Update clubs table for FC Titan
UPDATE clubs
SET 
  city = 'Bucuresti',
  country = 'Romania'
WHERE 
  name = 'Acsc Titan' OR name = 'FC Titan';

-- Log the update for verification
DO $$
DECLARE
  club_record RECORD;
BEGIN
  SELECT * INTO club_record FROM club_details WHERE name = 'Acsc Titan';
  
  RAISE NOTICE 'Club data updated: % (%), Admin: % (%), Location: %', 
    club_record.name, 
    club_record.id, 
    club_record.admin_name, 
    club_record.admin_email,
    club_record.location;
END $$; 