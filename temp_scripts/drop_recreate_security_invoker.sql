-- Drop and recreate views with explicit SECURITY INVOKER
-- Run each section separately

-- 1. Drop dependent views first
DROP VIEW IF EXISTS public.user_attendance_reports;

-- 2. Drop other views
DROP VIEW IF EXISTS public.club_active_players;
DROP VIEW IF EXISTS public.team_test_only;
DROP VIEW IF EXISTS public.teams_with_player_count;
DROP VIEW IF EXISTS public.activities_with_local_time;
DROP VIEW IF EXISTS public.attendance_with_correct_dates;
DROP VIEW IF EXISTS public.club_details;

-- 3. Create attendance_with_correct_dates
CREATE VIEW public.attendance_with_correct_dates 
WITH (security_invoker=true)
AS 
SELECT 
    a.*,
    date_trunc('day', a.created_at) AS local_date
FROM 
    public.activity_attendance a
JOIN 
    public.activities act ON a.activity_id::uuid = act.id
JOIN 
    public.clubs c ON act.club_id = c.id;

-- 4. Create activities_with_local_time
CREATE VIEW public.activities_with_local_time
WITH (security_invoker=true)
AS 
SELECT 
    a.*,
    (a.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_start_time,
    (a.end_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_end_time
FROM 
    public.activities a
JOIN 
    public.clubs c ON a.club_id = c.id;

-- 5. Create teams_with_player_count
CREATE VIEW public.teams_with_player_count
WITH (security_invoker=true)
AS 
SELECT 
    t.*, 
    COUNT(p.id) AS player_count
FROM 
    public.teams t
LEFT JOIN 
    public.players p ON p.team_id = t.id
GROUP BY 
    t.id;

-- 6. Create team_test_only
CREATE VIEW public.team_test_only
WITH (security_invoker=true)
AS 
SELECT * FROM public.teams;

-- 7. Create club_active_players
CREATE VIEW public.club_active_players
WITH (security_invoker=true)
AS 
SELECT * FROM public.players WHERE is_active = true;

-- 8. Create club_details
CREATE VIEW public.club_details
WITH (security_invoker=true)
AS
SELECT 
    c.id,
    c.name,
    c.city,
    COALESCE(c.country, ''::text) AS country,
    c.description,
    c.email,
    c.phone_number,
    c.logo_url,
    c.is_suspended,
    c.admin_id,
    c.created_at,
    ap.admin_name,
    COALESCE(ap.admin_email, NULL) AS admin_email,
    c.city || 
        CASE
            WHEN c.country IS NOT NULL AND c.country <> ''::text THEN ', '::text || c.country
            ELSE ''::text
        END AS location
FROM clubs c
LEFT JOIN admin_profiles ap ON c.admin_id = ap.user_id;

-- 9. Create user_attendance_reports
CREATE VIEW public.user_attendance_reports
WITH (security_invoker=true)
AS 
SELECT * FROM public.attendance_with_correct_dates; 