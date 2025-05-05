-- Drop existing functions
DROP FUNCTION IF EXISTS public.set_coach_access_code(text);
DROP FUNCTION IF EXISTS public.set_coach_access_code(json);
DROP FUNCTION IF EXISTS public.set_coach_context(text);

-- Create function to set coach access code
CREATE OR REPLACE FUNCTION public.set_coach_access_code(p_access_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Set the coach access code in the session with LOCAL setting
    PERFORM set_config('app.coach_access_code', p_access_code, true);
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.set_coach_access_code(text) TO anon;

-- Create policy for admins to view their club's teams
CREATE POLICY "Teams are viewable by club admin"
    ON public.teams FOR SELECT
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

-- Create policy for coaches to view their assigned teams
CREATE POLICY "Teams are viewable by assigned coach"
    ON public.teams FOR SELECT
    USING (
        coach_id IN (
            SELECT id FROM public.coaches 
            WHERE coaches.access_code = current_setting('app.coach_access_code', true)
            AND coaches.is_active = true
        )
    );

-- Create policy for coaches to view players in their teams
CREATE POLICY "Players are viewable by team coach"
    ON public.players FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.coaches c ON c.id = t.coach_id
            WHERE t.id = players.team_id
            AND t.is_active = true
            AND c.access_code = current_setting('app.coach_access_code', true)
            AND c.is_active = true
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.teams TO anon;
GRANT SELECT ON public.players TO anon; 