-- Store the user ID for testing
DO $$
DECLARE
    v_user_id UUID := '9314b117-c11b-4c22-9bca-e8952b2061e8'; -- Your user ID from the previous query
BEGIN
    -- Set the authenticated user for testing RLS policies
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, false);
    
    -- Log the current user
    RAISE NOTICE 'Testing as user: %', auth.uid();
END $$;

-- Test if the authenticated user can see the master_admins table
SELECT * FROM master_admins;

-- Test if the user can see their own record
SELECT * FROM master_admins WHERE user_id = auth.uid();

-- Test if the user is recognized as a super admin
SELECT EXISTS (
    SELECT 1 FROM master_admins 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
) AS is_super_admin; 