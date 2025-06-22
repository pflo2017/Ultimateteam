-- Update FC Titan club data
UPDATE clubs
SET 
  city = 'Bucuresti',
  country = 'Romania',
  name = 'Acsc Titan'
WHERE 
  name = 'FC Titan' OR name = 'Acsc Titan';

-- Ensure admin_profiles has the correct data for FC Titan's admin
INSERT INTO admin_profiles (user_id, name, email)
SELECT 
  c.admin_id, 
  'Florin Preda',
  'prec.florin@gmail.com'
FROM 
  clubs c
WHERE 
  c.name = 'Acsc Titan'
ON CONFLICT (user_id) 
DO UPDATE SET 
  name = 'Florin Preda',
  email = 'prec.florin@gmail.com';

-- Log the update for verification
DO $$
DECLARE
  club_record RECORD;
BEGIN
  SELECT * INTO club_record FROM club_details WHERE name = 'Acsc Titan';
  
  RAISE NOTICE 'Club data updated: % (%), Admin: % (%), Location: %, %', 
    club_record.name, 
    club_record.id, 
    club_record.admin_name, 
    club_record.admin_email,
    club_record.city,
    club_record.country;
END $$; 