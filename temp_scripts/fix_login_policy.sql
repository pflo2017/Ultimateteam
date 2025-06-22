-- Add a more permissive policy for the initial login check
CREATE POLICY "Allow initial login check" 
ON master_admins 
FOR SELECT 
TO authenticated
USING (true);

-- Make sure the user has super admin privileges
UPDATE master_admins
SET is_super_admin = true
WHERE email = 'master.florinp@gmail.com';

-- Verify the user's status
SELECT id, user_id, email, is_super_admin
FROM master_admins
WHERE email = 'master.florinp@gmail.com'; 