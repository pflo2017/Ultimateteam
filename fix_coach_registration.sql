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

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.update_coach_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id TO anon;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id_by_phone TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_coach_user_id_by_phone TO anon;

-- Fix existing coaches with NULL user_id
-- This will run for any coach that has a phone number in auth.users but no user_id in coaches table
DO $$
DECLARE
    coach_record RECORD;
    auth_user_id UUID;
BEGIN
    FOR coach_record IN 
        SELECT c.id, c.phone_number, c.email 
        FROM coaches c 
        WHERE c.user_id IS NULL
    LOOP
        -- Try to find matching user in auth.users by phone
        SELECT id INTO auth_user_id
        FROM auth.users
        WHERE phone = coach_record.phone_number
        OR phone = REPLACE(coach_record.phone_number, '+', '')
        OR phone = SUBSTRING(coach_record.phone_number FROM 2)
        LIMIT 1;
        
        IF auth_user_id IS NOT NULL THEN
            RAISE NOTICE 'Fixing coach % with phone % - found auth user %', 
                coach_record.id, coach_record.phone_number, auth_user_id;
                
            -- Update the coach record
            UPDATE coaches
            SET user_id = auth_user_id
            WHERE id = coach_record.id;
        END IF;
    END LOOP;
END;
$$; 