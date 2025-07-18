-- Drop existing function first
DROP FUNCTION IF EXISTS get_coach_players(UUID);

-- Recreate function with correct date type
CREATE OR REPLACE FUNCTION get_coach_players(p_coach_id UUID)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    team_id UUID,
    team_name TEXT,
    medical_visa_status TEXT,
    payment_status TEXT,
    parent_id UUID,
    last_payment_date DATE  -- Changed from TIMESTAMP WITH TIME ZONE to DATE
) AS $$
BEGIN
    RETURN QUERY
    -- Get all teams this coach is assigned to
    WITH coach_team_ids AS (
        SELECT t.id
        FROM teams t
        WHERE t.coach_id = p_coach_id
        AND t.is_active = true
    )
    -- Get all players from those teams with additional information
    SELECT 
        p.id as player_id,
        p.name as player_name,
        t.id as team_id,
        t.name as team_name,
        COALESCE(p.medical_visa_status, pc.medical_visa_status, 'pending') as medical_visa_status,
        COALESCE(p.payment_status, 'pending') as payment_status,
        p.parent_id,
        p.last_payment_date::DATE  -- Cast to DATE type
    FROM players p
    JOIN teams t ON p.team_id = t.id
    LEFT JOIN parent_children pc ON 
        pc.parent_id = p.parent_id AND 
        LOWER(pc.full_name) = LOWER(p.name) AND
        pc.is_active = true
    WHERE t.is_active = true
    AND p.is_active = true
    AND t.id IN (SELECT id FROM coach_team_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_coach_players TO anon; 