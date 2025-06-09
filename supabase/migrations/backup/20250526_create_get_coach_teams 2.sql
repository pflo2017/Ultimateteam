-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_coach_teams(uuid);

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
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id AND p.is_active = true
    WHERE t.coach_id = p_coach_id
    AND t.is_active = true
    GROUP BY t.id, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_coach_teams TO anon; 