-- Drop existing policies
DROP POLICY IF EXISTS "Teams are viewable by club admin" ON public.teams;
DROP POLICY IF EXISTS "Teams are viewable by assigned coach" ON public.teams;

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
            WHERE is_active = true
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.teams TO anon; 