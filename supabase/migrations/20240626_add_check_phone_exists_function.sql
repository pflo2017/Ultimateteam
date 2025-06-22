-- Create a function to check if a phone number exists in auth.users
-- This is safer than trying to sign in with a dummy password

CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_param TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_exists BOOLEAN;
    result jsonb;
BEGIN
    -- Check if the phone number exists in auth.users
    SELECT EXISTS(
        SELECT 1 
        FROM auth.users 
        WHERE phone = phone_param
    ) INTO user_exists;
    
    -- Build the result
    result := jsonb_build_object(
        'exists', user_exists
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO anon;

-- Add a comment explaining what this function does
COMMENT ON FUNCTION public.check_phone_exists IS 'Checks if a phone number exists in auth.users table. Returns a JSON object with an "exists" boolean field.'; 