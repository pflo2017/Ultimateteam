-- Drop existing policies
DROP POLICY IF EXISTS "Players are viewable by club admin" ON public.players;
DROP POLICY IF EXISTS "Players are viewable by team coach" ON public.players;

-- Create policy for admins to view their club's players
CREATE POLICY "Players are viewable by club admin"
    ON public.players FOR SELECT
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
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
            AND c.is_active = true
            AND c.access_code = current_setting('app.coach_access_code', true)
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.players TO anon; 