-- Comprehensive fix for attendance reports filter
-- This ensures proper data isolation across all attendance-related functions

-- 1. Create a function to get a user's club_id (more reliable version)
CREATE OR REPLACE FUNCTION public.get_user_club_id()
RETURNS UUID AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = auth.uid();
  
  -- If not an admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = auth.uid();
  END IF;
  
  RETURN v_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_club_id IS 'Get the club_id for the current authenticated user';

-- 2. Fix the get_user_teams function to use the get_user_club_id function
CREATE OR REPLACE FUNCTION public.get_user_teams()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get the club_id for the current user
  v_club_id := public.get_user_club_id();
  
  -- Return teams for the user's club if we found a club_id
  IF v_club_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_teams IS 'Get teams for the current user based on their club association';

-- 3. Create a function to get attendance reports for a user's club
CREATE OR REPLACE FUNCTION public.get_attendance_reports_for_user(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_team_id UUID DEFAULT NULL,
  p_activity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  activity_id UUID,
  activity_title TEXT,
  activity_type TEXT,
  activity_date TIMESTAMP WITH TIME ZONE,
  team_id UUID,
  team_name TEXT,
  present_count INTEGER,
  total_count INTEGER,
  attendance_percentage NUMERIC
) AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get the club_id for the current user
  v_club_id := public.get_user_club_id();
  
  IF v_club_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH attendance_counts AS (
    SELECT
      a.id AS activity_id,
      a.title AS activity_title,
      a.type AS activity_type,
      a.start_time AS activity_date,
      a.team_id,
      t.name AS team_name,
      COUNT(CASE WHEN aa.status = 'present' THEN 1 END) AS present_count,
      COUNT(aa.id) AS total_count
    FROM activities a
    JOIN teams t ON a.team_id = t.id
    LEFT JOIN activity_attendance aa ON a.id = aa.activity_id
    WHERE a.club_id = v_club_id
    AND a.start_time BETWEEN p_start_date AND p_end_date
    AND (p_team_id IS NULL OR a.team_id = p_team_id)
    AND (p_activity_type IS NULL OR p_activity_type = 'all' OR a.type = p_activity_type)
    GROUP BY a.id, a.title, a.type, a.start_time, a.team_id, t.name
  )
  SELECT
    activity_id,
    activity_title,
    activity_type,
    activity_date,
    team_id,
    team_name,
    present_count,
    total_count,
    CASE 
      WHEN total_count > 0 THEN (present_count::NUMERIC / total_count) * 100
      ELSE 0
    END AS attendance_percentage
  FROM attendance_counts
  ORDER BY activity_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_attendance_reports_for_user IS 'Get attendance reports for the current user based on their club association';

-- 4. Ensure the RLS policy for activities properly respects club_id
DROP POLICY IF EXISTS "Activities are viewable by users in the same club" ON activities;
CREATE POLICY "Activities are viewable by users in the same club" 
ON activities
FOR SELECT
USING (
  club_id = public.get_user_club_id()
);

-- 5. Ensure the RLS policy for activity_attendance properly respects club_id
DROP POLICY IF EXISTS "Activity attendance is viewable by users in the same club" ON activity_attendance;
CREATE POLICY "Activity attendance is viewable by users in the same club" 
ON activity_attendance
FOR SELECT
USING (
  club_id = public.get_user_club_id()
);

-- 6. Create a view to make it easier to get attendance reports
CREATE OR REPLACE VIEW public.user_attendance_reports AS
SELECT
  a.id AS activity_id,
  a.title AS activity_title,
  a.type AS activity_type,
  a.start_time AS activity_date,
  a.team_id,
  t.name AS team_name,
  COUNT(CASE WHEN aa.status = 'present' THEN 1 END) AS present_count,
  COUNT(aa.id) AS total_count,
  CASE 
    WHEN COUNT(aa.id) > 0 THEN (COUNT(CASE WHEN aa.status = 'present' THEN 1 END)::NUMERIC / COUNT(aa.id)) * 100
    ELSE 0
  END AS attendance_percentage
FROM activities a
JOIN teams t ON a.team_id = t.id
LEFT JOIN activity_attendance aa ON a.id::text = aa.activity_id::text
WHERE a.club_id = public.get_user_club_id()
GROUP BY a.id, a.title, a.type, a.start_time, a.team_id, t.name;

COMMENT ON VIEW public.user_attendance_reports IS 'View for attendance reports filtered by the current user''s club';

-- 7. Add RLS to the view
ALTER VIEW public.user_attendance_reports OWNER TO postgres;
GRANT SELECT ON public.user_attendance_reports TO authenticated;
GRANT SELECT ON public.user_attendance_reports TO service_role;
