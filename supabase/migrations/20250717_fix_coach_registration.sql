-- Create a function to update coach user_id directly
CREATE OR REPLACE FUNCTION public.update_coach_user_id(
    p_coach_id UUID,
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    -- Log the function call
    RAISE LOG 'update_coach_user_id called with coach_id=%, user_id=%, email=%', p_coach_id, p_user_id, p_email;
    
    -- First try to update by coach ID
    UPDATE coaches
    SET 
        user_id = p_user_id,
        email = COALESCE(p_email, email)
    WHERE id = p_coach_id;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RAISE LOG 'update_coach_user_id: Updated % rows by coach_id', v_updated;
    
    RETURN v_updated > 0;
END;
$$;

-- Create a function to update coach user_id by phone number
CREATE OR REPLACE FUNCTION public.update_coach_user_id_by_phone(
    p_phone_number TEXT,
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    -- Log the function call
    RAISE LOG 'update_coach_user_id_by_phone called with phone=%, user_id=%, email=%', p_phone_number, p_user_id, p_email;
    
    -- Try to update by phone number
    UPDATE coaches
    SET 
        user_id = p_user_id,
        email = COALESCE(p_email, email)
    WHERE phone_number = p_phone_number;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RAISE LOG 'update_coach_user_id_by_phone: Updated % rows by phone', v_updated;
    
    RETURN v_updated > 0;
END;
$$;

-- Add comments to explain the functions
COMMENT ON FUNCTION public.update_coach_user_id IS 'Update coach user_id by coach ID (security definer to bypass RLS)';
COMMENT ON FUNCTION public.update_coach_user_id_by_phone IS 'Update coach user_id by phone number (security definer to bypass RLS)'; 