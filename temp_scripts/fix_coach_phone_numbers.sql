-- Fix coach phone numbers by replacing +0 prefix with +4
-- This script identifies coaches with phone numbers starting with +0 and updates them to +4

-- First, let's create a backup of the coaches table
CREATE TABLE IF NOT EXISTS coaches_backup_before_phone_fix AS
SELECT * FROM coaches;

-- Display the coaches with +0 prefix before the update
SELECT id, name, phone_number, user_id 
FROM coaches 
WHERE phone_number LIKE '+0%';

-- Update phone numbers that start with +0 to use +4 instead
UPDATE coaches
SET phone_number = '+4' || SUBSTRING(phone_number, 3)
WHERE phone_number LIKE '+0%';

-- Display the updated coaches after the fix
SELECT id, name, phone_number, user_id 
FROM coaches 
WHERE phone_number LIKE '+4%' AND id IN (
  SELECT id FROM coaches_backup_before_phone_fix WHERE phone_number LIKE '+0%'
);

-- Count how many records were updated
SELECT 'Updated ' || COUNT(*) || ' coach records' as result
FROM coaches_backup_before_phone_fix
WHERE phone_number LIKE '+0%';

-- Add a comment explaining what this script does
COMMENT ON TABLE coaches_backup_before_phone_fix IS 'Backup of coaches table before fixing phone number formats from +0 to +4 prefix'; 