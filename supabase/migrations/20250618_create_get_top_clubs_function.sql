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
  WITH club_player_counts AS (
    SELECT 
      c.id AS club_id,
      c.name AS club_name,
      COUNT(p.id) AS player_count
    FROM 
      clubs c
    LEFT JOIN 
      teams t ON t.club_id = c.id
    LEFT JOIN 
      players p ON p.team_id = t.id
    WHERE 
      c.is_suspended = false
    GROUP BY 
      c.id, c.name
  ),
  club_team_counts AS (
    SELECT 
      c.id AS club_id,
      COUNT(t.id) AS team_count
    FROM 
      clubs c
    LEFT JOIN 
      teams t ON t.club_id = c.id
    WHERE 
      c.is_suspended = false
    GROUP BY 
      c.id
  )
  SELECT 
    cpc.club_id AS id,
    cpc.club_name AS name,
    cpc.player_count,
    COALESCE(ctc.team_count, 0) AS team_count,
    CASE 
      WHEN cpc.player_count > 100 THEN 'high'
      WHEN cpc.player_count > 50 THEN 'medium'
      ELSE 'low'
    END AS activity_level
  FROM 
    club_player_counts cpc
  LEFT JOIN 
    club_team_counts ctc ON cpc.club_id = ctc.club_id
  ORDER BY 
    cpc.player_count DESC
  LIMIT 5;
END;
$$;
