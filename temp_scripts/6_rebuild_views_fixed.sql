-- Rebuild views after fixing security issues
-- Run each view creation separately and test before proceeding to the next

-- 1. First rebuild attendance_with_correct_dates
-- Modify the table names and fields based on your schema
CREATE VIEW public.attendance_with_correct_dates AS 
SELECT 
    a.*,
    date_trunc('day', a.created_at) AS local_date
FROM 
    public.activity_attendance a
JOIN 
    public.activities act ON a.activity_id::uuid = act.id  -- Added type cast to uuid
JOIN 
    public.clubs c ON act.club_id = c.id;

-- 2. Rebuild activities_with_local_time
CREATE VIEW public.activities_with_local_time AS 
SELECT 
    a.*,
    -- Use a fixed timezone or get it from your application settings
    (a.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_start_time,
    (a.end_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_end_time
FROM 
    public.activities a
JOIN 
    public.clubs c ON a.club_id = c.id;

-- 3. Rebuild teams_with_player_count
CREATE VIEW public.teams_with_player_count AS 
SELECT 
    t.*, 
    COUNT(p.id) AS player_count
FROM 
    public.teams t
LEFT JOIN 
    public.players p ON p.team_id = t.id
GROUP BY 
    t.id;

-- 4. Rebuild team_test_only
-- This appears to be a test/development view that simply selects all teams
-- You may consider not recreating this view if it's not needed in production
CREATE VIEW public.team_test_only AS 
SELECT * FROM public.teams;

-- 5. Rebuild club_active_players
CREATE VIEW public.club_active_players AS 
SELECT * FROM public.players WHERE is_active = true;

-- 6. Rebuild user_attendance_reports
CREATE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates; 