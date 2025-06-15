-- First, get the user ID from auth.users
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'master.florinp@gmail.com';
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found in auth.users', v_email;
    END IF;
    
    -- Delete any existing entries for this email to avoid conflicts
    DELETE FROM master_admins WHERE email = v_email;
    
    -- Insert the user into master_admins with the correct user_id
    INSERT INTO master_admins (user_id, email, name, is_super_admin)
    VALUES (v_user_id, v_email, 'Master Admin', true);
    
    -- Verify the insertion
    RAISE NOTICE 'Added user % with ID % to master_admins table', v_email, v_user_id;
END $$; 