-- Diagnose coach authentication flow issues
-- This script checks for coaches that might be incorrectly linked to auth users

-- 1. Check for coaches with phone number +0721101101 (the specific example)
SELECT id, name, phone_number, user_id, is_active, created_at
FROM coaches 
WHERE phone_number = '+0721101101' OR phone_number = '+40721101101';

-- 2. Check if there's an auth user with this phone number
SELECT id, phone, email, created_at
FROM auth.users
WHERE phone = '+0721101101' OR phone = '+40721101101';

-- 3. Check for auth users created without linking to coaches
WITH coach_phones AS (
  SELECT phone_number FROM coaches
)
SELECT u.id, u.phone, u.created_at
FROM auth.users u
WHERE u.phone IN (SELECT phone_number FROM coach_phones)
AND NOT EXISTS (
  SELECT 1 FROM coaches c WHERE c.user_id = u.id
);

-- 4. Check for coaches that should be in registration flow but might be incorrectly flagged
SELECT c.id, c.name, c.phone_number, c.user_id, 
       u.id as auth_user_id, u.phone as auth_phone
FROM coaches c
LEFT JOIN auth.users u ON c.phone_number = u.phone
WHERE c.user_id IS NULL AND u.id IS NOT NULL;

-- 5. Fix: Update coaches to NULL user_id where they might be incorrectly linked
-- IMPORTANT: Review results before uncommenting this update!
/*
UPDATE coaches c
SET user_id = NULL
WHERE c.user_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM auth.users u 
  WHERE u.id = c.user_id AND u.phone != c.phone_number
);
*/

-- 6. Fix: For the specific coach with phone +0721101101/+40721101101, ensure user_id is NULL
-- IMPORTANT: Review results before uncommenting this update!
/*
UPDATE coaches
SET user_id = NULL
WHERE phone_number IN ('+0721101101', '+40721101101')
AND user_id IS NOT NULL
RETURNING id, name, phone_number, user_id;
*/

-- 7. Check if there are auth.users entries without corresponding coaches
SELECT u.id, u.phone, u.created_at
FROM auth.users u
LEFT JOIN coaches c ON u.phone = c.phone_number
WHERE c.id IS NULL; 