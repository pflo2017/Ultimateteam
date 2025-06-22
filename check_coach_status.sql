-- Function to check coach registration status
CREATE OR REPLACE FUNCTION public.check_coach_registration_status(
    p_phone_number TEXT
)
RETURNS TABLE (
    coach_id UUID,
    coach_name TEXT,
    phone_number TEXT,
    user_id UUID,
    auth_user_id UUID,
    auth_phone TEXT,
    registration_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH auth_data AS (
        SELECT 
            id, 
            phone
        FROM 
            auth.users
        WHERE 
            phone = p_phone_number
            OR phone = REPLACE(p_phone_number, '+', '')
            OR phone = SUBSTRING(p_phone_number FROM 2)
    )
    SELECT 
        c.id AS coach_id,
        c.name AS coach_name,
        c.phone_number,
        c.user_id,
        a.id AS auth_user_id,
        a.phone AS auth_phone,
        CASE
            WHEN c.id IS NULL THEN 'NO_COACH_FOUND'
            WHEN c.user_id IS NULL AND a.id IS NULL THEN 'NEEDS_REGISTRATION'
            WHEN c.user_id IS NULL AND a.id IS NOT NULL THEN 'AUTH_EXISTS_NEEDS_LINKING'
            WHEN c.user_id IS NOT NULL AND c.user_id = a.id THEN 'FULLY_REGISTERED'
            WHEN c.user_id IS NOT NULL AND a.id IS NULL THEN 'COACH_HAS_USER_ID_BUT_NO_AUTH'
            WHEN c.user_id IS NOT NULL AND c.user_id != a.id THEN 'USER_ID_MISMATCH'
            ELSE 'UNKNOWN'
        END AS registration_status
    FROM 
        coaches c
    LEFT JOIN 
        auth_data a ON TRUE
    WHERE 
        c.phone_number = p_phone_number
        OR c.phone_number = REPLACE(p_phone_number, '+', '')
        OR c.phone_number = SUBSTRING(p_phone_number FROM 2);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status TO anon;

-- Comment on function
COMMENT ON FUNCTION public.check_coach_registration_status IS 'Check registration status of a coach by phone number';

-- Example usage:
-- SELECT * FROM check_coach_registration_status('+40700002002'); 