-- Create an improved function to get a coach's collections with player data included
CREATE OR REPLACE FUNCTION get_coach_collections_with_data(p_coach_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  player_id UUID,
  coach_id UUID,
  collected_date TIMESTAMP,
  is_processed BOOLEAN,
  processed_date TIMESTAMP,
  notes TEXT,
  player_name TEXT,
  team_name TEXT
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    pc.id,
    pc.player_id,
    pc.coach_id,
    pc.collected_date,
    pc.is_processed,
    pc.processed_date,
    pc.notes,
    p.name AS player_name,
    t.name AS team_name
  FROM 
    payment_collections pc
  JOIN 
    players p ON pc.player_id = p.id
  LEFT JOIN
    teams t ON p.team_id = t.id
  WHERE 
    pc.coach_id = p_coach_id
  ORDER BY 
    pc.collected_date DESC;
END;
$$;

-- Create an improved function to get all collections with player and coach data included
CREATE OR REPLACE FUNCTION get_all_payment_collections_with_data()
RETURNS TABLE (
  id UUID,
  player_id UUID,
  coach_id UUID,
  collected_date TIMESTAMP,
  is_processed BOOLEAN,
  processed_date TIMESTAMP,
  notes TEXT,
  player_name TEXT,
  team_name TEXT,
  coach_name TEXT
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    pc.id,
    pc.player_id,
    pc.coach_id,
    pc.collected_date,
    pc.is_processed,
    pc.processed_date,
    pc.notes,
    p.name AS player_name,
    t.name AS team_name,
    c.name AS coach_name
  FROM 
    payment_collections pc
  JOIN 
    players p ON pc.player_id = p.id
  LEFT JOIN
    teams t ON p.team_id = t.id
  JOIN
    coaches c ON pc.coach_id = c.id
  ORDER BY 
    pc.collected_date DESC;
END;
$$; 