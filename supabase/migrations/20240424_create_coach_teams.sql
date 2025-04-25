-- Create coach_teams junction table
CREATE TABLE IF NOT EXISTS public.coach_teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coach_id, team_id)
);

-- Add RLS policies for coach_teams
ALTER TABLE public.coach_teams ENABLE ROW LEVEL SECURITY;

-- Allow coaches to view their team assignments
CREATE POLICY "Coach teams are viewable by assigned coach"
    ON public.coach_teams FOR SELECT
    TO anon
    USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.coach_teams TO anon;

-- Create function to get coach's teams
CREATE OR REPLACE FUNCTION get_coach_teams(p_coach_id UUID)
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    player_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as team_id,
        t.name as team_name,
        COUNT(p.id) as player_count
    FROM coach_teams ct
    JOIN teams t ON t.id = ct.team_id
    LEFT JOIN players p ON p.team_id = t.id
    WHERE ct.coach_id = p_coach_id
    AND t.is_active = true
    GROUP BY t.id, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_coach_teams TO anon; 