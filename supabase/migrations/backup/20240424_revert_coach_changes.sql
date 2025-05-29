-- Drop all the new policies and functions we added
DROP POLICY IF EXISTS "Coaches are viewable by themselves" ON public.coaches;
DROP POLICY IF EXISTS "Coach teams are viewable by assigned coach" ON public.coach_teams;
DROP POLICY IF EXISTS "Teams are viewable by assigned coach" ON public.teams;
DROP POLICY IF EXISTS "Players are viewable by team coach" ON public.players;

-- Drop the new functions
DROP FUNCTION IF EXISTS public.set_coach_context(text);
DROP FUNCTION IF EXISTS public.get_coach_teams(uuid);

-- Drop the coach_teams table if it exists
DROP TABLE IF EXISTS public.coach_teams;

-- Restore original verify_coach_access function
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

-- Restore original RLS policies
CREATE POLICY "Coaches are viewable by admin who created them"
    ON public.coaches FOR SELECT
    USING (auth.uid() = admin_id);

-- Grant necessary permissions
GRANT SELECT ON public.coaches TO anon; 