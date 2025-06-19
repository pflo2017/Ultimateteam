-- Create a function to get clubs with player counts and team counts
CREATE OR REPLACE FUNCTION public.get_top_clubs()
RETURNS TABLE (
  id uuid,
  name text,
  player_count bigint,
  team_count bigint,
  activity_level text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Get all active clubs first
  WITH active_clubs AS (
    SELECT 
      c.id,
      c.name
    FROM 
      clubs c
    WHERE 
      c.is_suspended = false
  ),
  -- Count active players per club using direct club_id (same as dashboard)
  club_player_counts AS (
    SELECT 
      p.club_id,
      COUNT(p.id) AS player_count
    FROM 
      players p
    WHERE 
      p.is_active = true
    GROUP BY 
      p.club_id
  ),
  -- Count active teams per club using direct club_id (same as dashboard)
  club_team_counts AS (
    SELECT 
      t.club_id,
      COUNT(t.id) AS team_count
    FROM 
      teams t
    WHERE 
      t.is_active = true
    GROUP BY 
      t.club_id
  )
  -- Join everything together
  SELECT 
    ac.id,
    ac.name,
    COALESCE(cpc.player_count, 0) AS player_count,
    COALESCE(ctc.team_count, 0) AS team_count,
    CASE 
      WHEN COALESCE(cpc.player_count, 0) > 100 THEN 'high'
      WHEN COALESCE(cpc.player_count, 0) > 50 THEN 'medium'
      ELSE 'low'
    END AS activity_level
  FROM 
    active_clubs ac
  LEFT JOIN 
    club_player_counts cpc ON ac.id = cpc.club_id
  LEFT JOIN 
    club_team_counts ctc ON ac.id = ctc.club_id
  ORDER BY 
    player_count DESC;
END;
$$;
