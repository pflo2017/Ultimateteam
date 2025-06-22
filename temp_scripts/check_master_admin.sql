-- Check if the master_admins table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'master_admins'
);

-- Check the structure of the master_admins table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'master_admins';

-- Check if the user exists in the master_admins table
SELECT * FROM master_admins;

-- Check if the user exists in auth.users
SELECT id, email, last_sign_in_at
FROM auth.users
WHERE email = 'master.florinp@gmail.com';

-- Check if there are any RLS policies that might be affecting login
SELECT * FROM pg_policies 
WHERE tablename = 'master_admins';

-- Check if the user has the correct role
SELECT id, email, role
FROM auth.users
WHERE email = 'master.florinp@gmail.com';

-- Check if the user exists in auth.users
SELECT id, email 
FROM auth.users 
WHERE email = 'master.florinp@gmail.com';

-- Check if the user exists in master_admins table
SELECT ma.id, ma.user_id, ma.email, ma.is_super_admin 
FROM master_admins ma 
WHERE ma.email = 'master.florinp@gmail.com';

-- Check if the user_id in master_admins matches the id in auth.users
SELECT au.id as auth_user_id, au.email as auth_email, 
       ma.user_id as master_admin_user_id, ma.email as master_admin_email
FROM auth.users au
JOIN master_admins ma ON au.id = ma.user_id
WHERE au.email = 'master.florinp@gmail.com'; 