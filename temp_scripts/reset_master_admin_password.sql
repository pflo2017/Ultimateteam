-- IMPORTANT: This script must be run by a Supabase superuser or service role
-- It will reset the password for the master admin account

-- First, check if the user exists
SELECT id, email 
FROM auth.users
WHERE email = 'master.florinp@gmail.com';

-- Reset the password (replace 'new_password' with your desired password)
-- IMPORTANT: The password will be hashed automatically
UPDATE auth.users
SET encrypted_password = crypt('new_password', gen_salt('bf'))
WHERE email = 'master.florinp@gmail.com';

-- Alternatively, if you have access to the Supabase dashboard:
-- 1. Go to Authentication > Users
-- 2. Find the user with email master.florinp@gmail.com
-- 3. Click the three dots menu and select "Reset password"
-- 4. Enter a new password and confirm 