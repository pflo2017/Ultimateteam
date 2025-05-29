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

-- Drop existing verification policy if it exists
DROP POLICY IF EXISTS "Allow team code verification" ON public.teams;

-- Create policy to allow public access for team code verification
CREATE POLICY "Allow team code verification"
ON public.teams
FOR SELECT
USING (
    is_active = true
);

-- Grant necessary permissions
GRANT SELECT ON public.teams TO anon; 