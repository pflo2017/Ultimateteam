-- Script to diagnose and fix coach login issues
-- This script checks for common issues that prevent coaches from logging in

-- 1. Check for coaches without user_id
SELECT id, name, phone_number, is_active, user_id
FROM coaches
WHERE user_id IS NULL
ORDER BY created_at DESC;

-- 2. Check for coaches with phone numbers in wrong format
SELECT id, name, phone_number, is_active, user_id
FROM coaches
WHERE phone_number NOT LIKE '+%'
   OR phone_number LIKE '+0%';

-- 3. Check for auth users with phone numbers matching coaches
WITH coach_phones AS (
  SELECT phone_number FROM coaches
)
SELECT id, phone, email, created_at 
FROM auth.users
WHERE phone IN (SELECT phone_number FROM coach_phones);

-- 4. Check for coaches with user_id that doesn't exist in auth.users
SELECT c.id, c.name, c.phone_number, c.user_id
FROM coaches c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE c.user_id IS NOT NULL AND u.id IS NULL;

-- 5. Check for duplicate phone numbers in coaches table
SELECT phone_number, COUNT(*) as count
FROM coaches
GROUP BY phone_number
HAVING COUNT(*) > 1;

-- 6. Check for inactive coaches
SELECT id, name, phone_number, user_id
FROM coaches
WHERE is_active = false;

-- 7. Fix phone numbers starting with +0 (should be +4 for Romania)
UPDATE coaches
SET phone_number = '+4' || SUBSTRING(phone_number, 3)
WHERE phone_number LIKE '+0%'
RETURNING id, name, phone_number;

-- 8. Find auth users with phone numbers that match coaches but aren't linked
SELECT u.id as auth_user_id, u.phone, c.id as coach_id, c.name, c.phone_number
FROM auth.users u
JOIN coaches c ON u.phone = c.phone_number
WHERE c.user_id IS NULL OR c.user_id != u.id;

-- 9. Link coaches to existing auth users where phone numbers match but user_id is null
UPDATE coaches c
SET user_id = u.id
FROM auth.users u
WHERE c.phone_number = u.phone
  AND c.user_id IS NULL
RETURNING c.id, c.name, c.phone_number, c.user_id; 