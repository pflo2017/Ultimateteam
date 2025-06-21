-- Drop existing function first
DROP FUNCTION IF EXISTS get_coach_players(UUID);

-- Recreate function with correct medical visa status priority
CREATE OR REPLACE FUNCTION get_coach_players(p_coach_id UUID)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    team_id UUID,
    team_name TEXT,
    medical_visa_status TEXT,
    payment_status TEXT,
    parent_id UUID,
    last_payment_date DATE
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
        p.last_payment_date::DATE
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

-- Update any players with null medical_visa_status to 'pending'
UPDATE players
SET medical_visa_status = 'pending'
WHERE medical_visa_status IS NULL OR medical_visa_status = '';

-- Update any parent_children with null medical_visa_status to 'pending'
UPDATE parent_children
SET medical_visa_status = 'pending'
WHERE medical_visa_status IS NULL OR medical_visa_status = '';

-- Create a stored procedure to update medical visa status
CREATE OR REPLACE FUNCTION update_medical_visa_status(
    p_player_id UUID,
    p_status TEXT,
    p_issue_date TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
BEGIN
    -- Update players table
    UPDATE players
    SET 
        medical_visa_status = p_status,
        medical_visa_issue_date = p_issue_date
    WHERE id = p_player_id;
    
    -- Update parent_children table for the same player
    UPDATE parent_children pc
    SET 
        medical_visa_status = p_status,
        medical_visa_issue_date = p_issue_date
    FROM players p
    WHERE 
        p.id = p_player_id AND
        pc.parent_id = p.parent_id AND
        LOWER(pc.full_name) = LOWER(p.name) AND
        pc.is_active = true;
        
    -- Log the update for debugging
    RAISE NOTICE 'Updated medical visa status for player %: status=%, issue_date=%', 
        p_player_id, p_status, p_issue_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_medical_visa_status TO anon; 