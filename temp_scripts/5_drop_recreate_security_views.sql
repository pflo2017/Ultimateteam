-- This script drops and recreates security definer views as regular views
-- First, check if the referenced tables exist
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance');
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendances');
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_attendance');

-- Assuming the actual table is called 'attendances' rather than 'attendance'
-- Adjust table names in the scripts below based on your check results

-- Drop views in the correct order to handle dependencies
-- Start with views that depend on other views

-- 1. user_attendance_reports (depends on attendance_with_correct_dates)
DROP VIEW IF EXISTS public.user_attendance_reports;

-- 2. club_active_players 
DROP VIEW IF EXISTS public.club_active_players;

-- 3. team_test_only
DROP VIEW IF EXISTS public.team_test_only;

-- 4. teams_with_player_count
DROP VIEW IF EXISTS public.teams_with_player_count;

-- 5. activities_with_local_time
DROP VIEW IF EXISTS public.activities_with_local_time;

-- 6. attendance_with_correct_dates (drop after dependent views)
DROP VIEW IF EXISTS public.attendance_with_correct_dates;

-- Now recreate all views in reverse order (dependency first)
-- You'll need to adjust the table names based on your database schema

-- 1. attendance_with_correct_dates
-- Replace 'attendance' with the actual table name in your database
CREATE VIEW public.attendance_with_correct_dates AS 
SELECT a.*,
       -- Fixed timezone reference
       date_trunc('day', (act.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London') AS local_date
FROM public.attendances a  -- Changed from 'attendance' to 'attendances'
JOIN public.activities act ON a.activity_id = act.id
JOIN public.clubs c ON act.club_id = c.id;

-- 2. activities_with_local_time
CREATE VIEW public.activities_with_local_time AS 
SELECT a.*,
       -- Fixed timezone reference
       (a.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_start_time,
       (a.end_time AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London' AS local_end_time
FROM public.activities a
JOIN public.clubs c ON a.club_id = c.id;

-- 3. teams_with_player_count
CREATE VIEW public.teams_with_player_count AS 
SELECT t.*, COUNT(p.id) AS player_count
FROM public.teams t
LEFT JOIN public.players p ON p.team_id = t.id
GROUP BY t.id;

-- 4. team_test_only
CREATE VIEW public.team_test_only AS 
SELECT * FROM public.teams;

-- 5. club_active_players
CREATE VIEW public.club_active_players AS 
SELECT * FROM public.players WHERE is_active = true;

-- 6. user_attendance_reports (depends on attendance_with_correct_dates)
CREATE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- IMPORTANT: Make sure to replace table names with the actual ones from your database.
-- For the timezone issue, check if there's another column in the clubs table for timezone,
-- or add a timezone column if needed, or use a hard-coded timezone that works for your users. 