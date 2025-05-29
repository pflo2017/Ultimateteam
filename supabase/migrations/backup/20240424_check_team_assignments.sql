-- First, let's check if there are any teams assigned to this coach
SELECT id, name, coach_id, is_active
FROM public.teams
WHERE coach_id = '32efbe39-15ca-417a-b340-4d7eb4324db6';

-- Check all teams and their coaches
SELECT t.id, t.name, t.coach_id, t.is_active, c.name as coach_name
FROM public.teams t
LEFT JOIN public.coaches c ON c.id = t.coach_id
ORDER BY t.name;

-- Create a policy that allows coaches to view their teams
DROP POLICY IF EXISTS "Teams are viewable by assigned coach" ON public.teams;
CREATE POLICY "Teams are viewable by assigned coach"
    ON public.teams FOR SELECT
    USING (
        coach_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.coaches 
            WHERE coaches.id = teams.coach_id 
            AND coaches.is_active = true
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.teams TO anon;
GRANT SELECT ON public.players TO anon;

-- Check if the coach exists and is active
SELECT id, name, is_active
FROM public.coaches
WHERE id = '32efbe39-15ca-417a-b340-4d7eb4324db6';

-- Check if there are any teams in the database
SELECT COUNT(*) as team_count
FROM public.teams;

-- Check if there are any active teams
SELECT COUNT(*) as active_team_count
FROM public.teams
WHERE is_active = true;

-- Check if there are any teams assigned to any coach
SELECT COUNT(*) as teams_with_coach
FROM public.teams
WHERE coach_id IS NOT NULL;

-- Check if there are any active teams assigned to any coach
SELECT COUNT(*) as active_teams_with_coach
FROM public.teams
WHERE coach_id IS NOT NULL
AND is_active = true;

-- Check if the team is actually being assigned to the coach
SELECT t.id, t.name, t.coach_id, t.is_active, c.name as coach_name
FROM public.teams t
JOIN public.coaches c ON c.id = t.coach_id
WHERE t.coach_id = '32efbe39-15ca-417a-b340-4d7eb4324db6'
AND t.is_active = true; 