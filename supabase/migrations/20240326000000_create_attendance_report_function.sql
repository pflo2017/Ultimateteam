-- Create a function to get attendance reports with filtering
CREATE OR REPLACE FUNCTION get_attendance_report(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  activity_id UUID,
  activity_title TEXT,
  activity_type TEXT,
  activity_date TIMESTAMPTZ,
  team_id UUID,
  team_name TEXT,
  player_id UUID,
  player_name TEXT,
  status TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  recorded_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_activities AS (
    SELECT 
      a.id,
      a.title,
      a.type,
      a.start_time,
      a.team_id,
      t.name as team_name
    FROM activities a
    LEFT JOIN teams t ON a.team_id = t.id
    WHERE 
      a.start_time >= p_start_date 
      AND a.start_time <= p_end_date
      AND (p_team_id IS NULL OR a.team_id = p_team_id)
      AND (p_activity_type IS NULL OR a.type = p_activity_type)
  )
  SELECT 
    fa.id as activity_id,
    fa.title as activity_title,
    fa.type as activity_type,
    fa.start_time as activity_date,
    fa.team_id,
    fa.team_name,
    aa.player_id,
    p.name as player_name,
    aa.status,
    aa.recorded_by,
    COALESCE(ap.name, cp.name) as recorded_by_name,
    aa.recorded_at
  FROM filtered_activities fa
  JOIN activity_attendance aa ON fa.id = aa.activity_id
  JOIN players p ON aa.player_id = p.id
  LEFT JOIN admin_profiles ap ON aa.recorded_by = ap.user_id
  LEFT JOIN coach_profiles cp ON aa.recorded_by = cp.user_id
  ORDER BY 
    fa.start_time DESC,
    fa.title,
    p.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_attendance_report TO authenticated;

-- Create a function to get attendance statistics
CREATE OR REPLACE FUNCTION get_attendance_stats(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  activity_id UUID,
  activity_title TEXT,
  activity_type TEXT,
  activity_date TIMESTAMPTZ,
  team_id UUID,
  team_name TEXT,
  present_count BIGINT,
  absent_count BIGINT,
  total_players BIGINT,
  attendance_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_activities AS (
    SELECT 
      a.id,
      a.title,
      a.type,
      a.start_time,
      a.team_id,
      t.name as team_name
    FROM activities a
    LEFT JOIN teams t ON a.team_id = t.id
    WHERE 
      a.start_time >= p_start_date 
      AND a.start_time <= p_end_date
      AND (p_team_id IS NULL OR a.team_id = p_team_id)
      AND (p_activity_type IS NULL OR a.type = p_activity_type)
  ),
  attendance_counts AS (
    SELECT 
      fa.id as activity_id,
      fa.title as activity_title,
      fa.type as activity_type,
      fa.start_time as activity_date,
      fa.team_id,
      fa.team_name,
      COUNT(*) FILTER (WHERE aa.status = 'present') as present_count,
      COUNT(*) FILTER (WHERE aa.status = 'absent') as absent_count,
      COUNT(*) as total_players
    FROM filtered_activities fa
    JOIN activity_attendance aa ON fa.id = aa.activity_id
    GROUP BY 
      fa.id,
      fa.title,
      fa.type,
      fa.start_time,
      fa.team_id,
      fa.team_name
  )
  SELECT 
    ac.*,
    CASE 
      WHEN ac.total_players > 0 
      THEN ROUND((ac.present_count::NUMERIC / ac.total_players::NUMERIC) * 100, 1)
      ELSE 0 
    END as attendance_percentage
  FROM attendance_counts ac
  ORDER BY 
    ac.activity_date DESC,
    ac.activity_title;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_attendance_stats TO authenticated; 