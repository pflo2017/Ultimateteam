-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.verify_coach_access(text);

-- Create function to verify coach access
CREATE OR REPLACE FUNCTION public.verify_coach_access(p_access_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coach_exists boolean;
    v_coach_data json;
    v_result json;
BEGIN
    -- Get coach data if exists and is active
    SELECT 
        CASE WHEN c.id is not null THEN
            json_build_object(
                'id', c.id,
                'name', c.name,
                'club_id', c.club_id,
                'is_active', c.is_active,
                'access_code', c.access_code
            )
        ELSE
            null
        END
    INTO v_coach_data
    FROM public.coaches c
    WHERE c.access_code = p_access_code
        AND c.is_active = true;

    -- Check if coach exists
    v_coach_exists := v_coach_data is not null;

    -- Set the coach access code in the session if valid
    IF v_coach_exists THEN
        PERFORM set_config('app.coach_access_code', p_access_code, true);
    END IF;

    -- Construct the result
    v_result := json_build_object(
        'is_valid', v_coach_exists,
        'coach', v_coach_data
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission to the anon role
GRANT EXECUTE ON FUNCTION public.verify_coach_access(text) TO anon; 