-- Drop existing policies
DROP POLICY IF EXISTS "Coaches are viewable by admin who created them" ON public.coaches;
DROP POLICY IF EXISTS "Coaches are viewable by club admin" ON public.coaches;
DROP POLICY IF EXISTS "Allow anonymous coach verification" ON public.coaches;

-- Create new policies for coaches
CREATE POLICY "Coaches are viewable by their admin"
    ON public.coaches FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Coaches are viewable by themselves"
    ON public.coaches FOR SELECT
    USING (
        access_code = current_setting('app.coach_access_code', true)
        AND is_active = true
    );

-- Grant necessary permissions
GRANT SELECT ON public.coaches TO anon;

-- Update verify_coach_access function
CREATE OR REPLACE FUNCTION public.verify_coach_access(p_access_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
                'is_active', c.is_active
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