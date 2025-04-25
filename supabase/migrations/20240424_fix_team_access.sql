-- Add policy for coaches to view their assigned teams
CREATE POLICY "Teams are viewable by assigned coach"
    ON public.teams FOR SELECT
    USING (
        coach_id IN (
            SELECT id FROM public.coaches 
            WHERE access_code = current_setting('app.coach_access_code', true)
            AND is_active = true
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.teams TO anon; 