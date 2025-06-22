-- Script to clean up test sessions from auth.sessions

-- First, get the schema information to see the correct column names
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'sessions';

-- Look up the users first to find their user_ids
SELECT id, email FROM auth.users WHERE email = 'sima20@gmail.com';

-- First, let's check how many sessions we'll be affecting (using user_id instead)
SELECT COUNT(*) as sessions_to_delete 
FROM auth.sessions 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'sima20@gmail.com');

-- If you want to see the actual sessions before deleting
SELECT s.* 
FROM auth.sessions s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'sima20@gmail.com';

-- To delete the sessions for the specific test email
DELETE FROM auth.sessions 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'sima20@gmail.com');

-- Verify they're gone
SELECT COUNT(*) as remaining_test_sessions 
FROM auth.sessions s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'sima20@gmail.com';

-- If you want to delete ALL test sessions with test accounts,
-- UNCOMMENT the following (be careful!):
/*
DELETE FROM auth.sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%example.com' 
     OR email LIKE '%test%'
);
*/

-- Show remaining sessions
SELECT COUNT(*) as total_remaining_sessions FROM auth.sessions; 