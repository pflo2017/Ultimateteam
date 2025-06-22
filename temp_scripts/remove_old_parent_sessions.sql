-- Script to remove sessions for the old parent account that can't be used anymore

-- First, verify the user ID and check how many sessions will be affected
SELECT COUNT(*) as sessions_to_delete 
FROM auth.sessions 
WHERE user_id = '53d30ae1-7653-4889-a561-addc19227410';

-- View the sessions that will be deleted
SELECT * 
FROM auth.sessions 
WHERE user_id = '53d30ae1-7653-4889-a561-addc19227410'
ORDER BY created_at DESC;

-- Delete the sessions for this specific user ID
DELETE FROM auth.sessions 
WHERE user_id = '53d30ae1-7653-4889-a561-addc19227410';

-- Verify the sessions are gone
SELECT COUNT(*) as remaining_sessions 
FROM auth.sessions 
WHERE user_id = '53d30ae1-7653-4889-a561-addc19227410';

-- Show total remaining sessions in the system
SELECT COUNT(*) as total_remaining_sessions FROM auth.sessions; 