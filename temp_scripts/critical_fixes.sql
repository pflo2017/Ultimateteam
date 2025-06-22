-- Critical fixes for team loading issues

-- Create an improved version of get_user_teams_direct with better debugging
CREATE OR REPLACE FUNCTION public.get_user_teams_direct()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_debug TEXT;
BEGIN
  -- Get the current user ID directly
  v_user_id := auth.uid();
  v_debug := 'User ID: ' || COALESCE(v_user_id::TEXT, 'null');
  
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = v_user_id;
  
  v_debug := v_debug || ', Admin club check: ' || COALESCE(v_club_id::TEXT, 'null');
  
  -- If not found as admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = v_user_id;
    
    v_debug := v_debug || ', Coach club check: ' || COALESCE(v_club_id::TEXT, 'null');
  END IF;
  
  -- Log for debugging
  RAISE LOG 'get_user_teams_direct debug: %', v_debug;
  
  -- Return teams for the user's club if we found a club_id
  IF v_club_id IS NOT NULL THEN
    -- Direct debug query to check what teams exist for this club
    RAISE LOG 'get_user_teams_direct: Querying teams for club_id=%', v_club_id;
    
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  ELSE
    -- Return empty result set
    RAISE LOG 'get_user_teams_direct: No club_id found for user %', v_user_id;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to directly get teams by club ID (for testing)
CREATE OR REPLACE FUNCTION public.get_teams_by_club_direct(p_club_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.is_active, t.club_id
  FROM teams t
  WHERE t.club_id = p_club_id
  AND t.is_active = true
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get attendance reports directly by club_id
CREATE OR REPLACE FUNCTION public.get_attendance_reports_by_club(
  p_club_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_team_id UUID DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  activity_id UUID,
  activity_title TEXT,
  activity_type TEXT,
  activity_start_time TIMESTAMP WITH TIME ZONE,
  team_id UUID,
  team_name TEXT,
  player_id UUID,
  player_name TEXT,
  attendance_status TEXT,
  recorded_by UUID,
  recorded_at TIMESTAMP WITH TIME ZONE
)
AS $$
BEGIN
  -- Validate club_id
  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'Club ID is required';
  END IF;

  RETURN QUERY
  SELECT 
    a.id AS activity_id,
    a.title AS activity_title,
    a.type AS activity_type,
    a.start_time AS activity_start_time,
    a.team_id,
    t.name AS team_name,
    aa.player_id,
    p.name AS player_name,
    aa.status AS attendance_status,
    aa.recorded_by,
    aa.recorded_at
  FROM 
    activities a
    JOIN teams t ON a.team_id = t.id
    JOIN activity_attendance aa ON a.id = aa.activity_id
    JOIN players p ON aa.player_id = p.id
  WHERE 
    a.club_id = p_club_id
    AND a.start_time >= p_start_date
    AND a.start_time <= p_end_date
    AND (p_team_id IS NULL OR a.team_id = p_team_id)
    AND (p_activity_type IS NULL OR a.type = p_activity_type)
  ORDER BY 
    a.start_time DESC,
    t.name,
    p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 