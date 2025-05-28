-- Create a function to get attendance reports
CREATE OR REPLACE FUNCTION get_attendance_report(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
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
    SELECT 
        a.id as activity_id,
        a.title as activity_title,
        a.type as activity_type,
        a.start_time as activity_date,
        t.id as team_id,
        t.name as team_name,
        p.id as player_id,
        p.name as player_name,
        aa.status,
        aa.recorded_by,
        COALESCE(
            (SELECT name FROM coaches WHERE admin_id = aa.recorded_by),
            (SELECT name FROM admin_profiles WHERE user_id = aa.recorded_by)
        ) as recorded_by_name,
        aa.recorded_at
    FROM activity_attendance aa
    JOIN activities a ON a.id = aa.activity_id
    JOIN teams t ON t.id = a.team_id
    JOIN players p ON p.id = aa.player_id
    WHERE 
        -- Date range filter
        (p_start_date IS NULL OR a.start_time >= p_start_date)
        AND (p_end_date IS NULL OR a.start_time <= p_end_date)
        -- Team filter
        AND (p_team_id IS NULL OR t.id = p_team_id)
        -- Activity type filter
        AND (p_activity_type IS NULL OR a.type = p_activity_type)
        -- Security check for coaches
        AND (
            -- Allow if user is an admin
            EXISTS (
                SELECT 1 FROM admin_profiles 
                WHERE user_id = auth.uid()
            )
            OR
            -- Or if user is a coach for this team
            EXISTS (
                SELECT 1 FROM coaches c
                WHERE c.id = t.coach_id
                AND c.admin_id = auth.uid()
                AND c.is_active = true
            )
        )
    ORDER BY 
        a.start_time DESC,
        t.name,
        p.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_attendance_report TO authenticated;

-- Create a view for quick access to attendance statistics
CREATE OR REPLACE VIEW attendance_statistics AS
SELECT 
    a.id as activity_id,
    a.title as activity_title,
    a.type as activity_type,
    a.start_time as activity_date,
    t.id as team_id,
    t.name as team_name,
    COUNT(*) FILTER (WHERE aa.status = 'present') as present_count,
    COUNT(*) FILTER (WHERE aa.status = 'absent') as absent_count,
    COUNT(*) as total_players,
    ROUND(
        (COUNT(*) FILTER (WHERE aa.status = 'present')::float / 
        NULLIF(COUNT(*), 0) * 100)::numeric, 
        2
    ) as attendance_percentage
FROM activities a
JOIN teams t ON t.id = a.team_id
LEFT JOIN activity_attendance aa ON aa.activity_id = a.id
GROUP BY a.id, a.title, a.type, a.start_time, t.id, t.name;

-- Grant select permission on the view
GRANT SELECT ON attendance_statistics TO authenticated;

-- Create RLS policy for the view
ALTER VIEW attendance_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance statistics are viewable by admins and coaches"
ON attendance_statistics
FOR SELECT
TO authenticated
USING (
    -- Allow if user is an admin
    EXISTS (
        SELECT 1 FROM admin_profiles 
        WHERE user_id = auth.uid()
    )
    OR
    -- Or if user is a coach for this team
    EXISTS (
        SELECT 1 FROM coaches c
        JOIN teams t ON t.coach_id = c.id
        WHERE t.id = attendance_statistics.team_id
        AND c.admin_id = auth.uid()
        AND c.is_active = true
    )
); 