-- Create a function to include club_id in admin login response
-- This ensures that the club_id is saved in AsyncStorage for client-side data isolation

-- Create or replace the admin_login function to include club_id
CREATE OR REPLACE FUNCTION public.admin_login(p_email TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_admin_id UUID;
    v_club_id UUID;
    v_club_name TEXT;
    v_admin_name TEXT;
    v_admin_email TEXT;
    v_result JSON;
BEGIN
    -- Validate credentials using Supabase Auth
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid email or password');
    END IF;
    
    -- Check if the user is an admin
    SELECT user_id, name, email INTO v_admin_id, v_admin_name, v_admin_email
    FROM admin_profiles
    WHERE user_id = v_user_id;
    
    IF v_admin_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User is not an admin');
    END IF;
    
    -- Get the club_id and club_name
    SELECT c.id, c.name INTO v_club_id, v_club_name
    FROM clubs c
    WHERE c.admin_id = v_admin_id;
    
    -- Build the result with club_id included
    v_result := json_build_object(
        'success', true,
        'id', v_admin_id,
        'name', v_admin_name,
        'email', v_admin_email,
        'club_id', v_club_id,
        'club_name', v_club_name
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get admin data with club information
CREATE OR REPLACE FUNCTION public.get_admin_with_club_data(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
    v_admin_name TEXT;
    v_admin_email TEXT;
    v_club_id UUID;
    v_club_name TEXT;
    v_result JSON;
BEGIN
    -- Get admin details
    SELECT name, email INTO v_admin_name, v_admin_email
    FROM admin_profiles
    WHERE user_id = p_admin_id;
    
    IF v_admin_name IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Admin not found');
    END IF;
    
    -- Get the club_id and club_name
    SELECT c.id, c.name INTO v_club_id, v_club_name
    FROM clubs c
    WHERE c.admin_id = p_admin_id;
    
    -- Build the result with club_id included
    v_result := json_build_object(
        'success', true,
        'id', p_admin_id,
        'name', v_admin_name,
        'email', v_admin_email,
        'club_id', v_club_id,
        'club_name', v_club_name
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to explain the functions
COMMENT ON FUNCTION public.admin_login IS 'Login function for admins that includes club_id in the response for client-side data isolation';
COMMENT ON FUNCTION public.get_admin_with_club_data IS 'Get admin data including club information for client-side data isolation';
