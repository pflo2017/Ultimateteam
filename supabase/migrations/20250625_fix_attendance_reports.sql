-- Fix attendance reports by adding a direct club_id function
-- This ensures proper data isolation for attendance reports

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

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_attendance_reports_by_club IS 'Get attendance reports for a specific club with optional filters';

-- Create a function to get attendance statistics by club_id
CREATE OR REPLACE FUNCTION public.get_attendance_stats_by_club(
  p_club_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_team_id UUID DEFAULT NULL
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  team_id UUID,
  team_name TEXT,
  total_activities INTEGER,
  attended INTEGER,
  excused INTEGER,
  absent INTEGER,
  attendance_rate NUMERIC
)
AS $$
BEGIN
  -- Validate club_id
  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'Club ID is required';
  END IF;

  RETURN QUERY
  WITH activity_counts AS (
    SELECT 
      p.id AS player_id,
      p.name AS player_name,
      t.id AS team_id,
      t.name AS team_name,
      COUNT(DISTINCT a.id) AS total_activities,
      COUNT(DISTINCT CASE WHEN aa.status = 'present' THEN a.id END) AS attended,
      COUNT(DISTINCT CASE WHEN aa.status = 'excused' THEN a.id END) AS excused,
      COUNT(DISTINCT CASE WHEN aa.status = 'absent' THEN a.id END) AS absent
    FROM 
      players p
      JOIN teams t ON p.team_id = t.id
      JOIN activities a ON a.team_id = t.id
      LEFT JOIN activity_attendance aa ON a.id = aa.activity_id AND p.id = aa.player_id
    WHERE 
      p.club_id = p_club_id
      AND a.club_id = p_club_id
      AND a.start_time >= p_start_date
      AND a.start_time <= p_end_date
      AND (p_team_id IS NULL OR t.id = p_team_id)
      AND p.is_active = true
    GROUP BY 
      p.id, p.name, t.id, t.name
  )
  SELECT 
    player_id,
    player_name,
    team_id,
    team_name,
    total_activities,
    attended,
    excused,
    absent,
    CASE 
      WHEN total_activities > 0 THEN 
        ROUND((attended::NUMERIC / total_activities::NUMERIC) * 100, 2)
      ELSE 0
    END AS attendance_rate
  FROM 
    activity_counts
  ORDER BY 
    team_name, player_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_attendance_stats_by_club IS 'Get attendance statistics for a specific club with optional filters';

-- Create a function to get a user's club ID (improved version)
CREATE OR REPLACE FUNCTION public.get_user_club_id_v2()
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_debug TEXT;
BEGIN
  -- Get the current user ID
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
  RAISE LOG 'get_user_club_id_v2 debug: %', v_debug;
  
  RETURN v_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_user_club_id_v2 IS 'Get the club_id for the current authenticated user (improved version with debugging)'; 