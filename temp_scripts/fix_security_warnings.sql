-- Fix security warnings in Supabase database

-- 1. Fix RLS for master_admins table (has policy but RLS disabled)
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on backup tables
ALTER TABLE public.players_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_payment_backup ENABLE ROW LEVEL SECURITY;

-- Add basic security policies to backup tables
CREATE POLICY "Only super admins can access players_backup" 
ON public.players_backup
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.master_admins ma 
        WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
    )
);

CREATE POLICY "Only super admins can access players_payment_backup" 
ON public.players_payment_backup
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.master_admins ma 
        WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
    )
);

-- 3. Fix Security Definer views by changing them to Security Invoker
-- Each view needs to be recreated with SECURITY INVOKER

-- Fix club_details view (both auth.users exposure and SECURITY DEFINER issue)
CREATE OR REPLACE VIEW public.club_details AS
SELECT c.*,
       -- Replace direct auth.users references with NULL or specific fields from clubs table
       -- Adjust based on what data is actually needed from the view
       NULL AS user_email  -- Example placeholder, replace with actual non-auth.users field
FROM public.clubs c
WITH SECURITY INVOKER;

-- Fix user_attendance_reports view
CREATE OR REPLACE VIEW public.user_attendance_reports 
AS SELECT * FROM public.attendance_with_correct_dates
WITH SECURITY INVOKER;

-- Fix club_active_players view
CREATE OR REPLACE VIEW public.club_active_players 
AS SELECT * FROM public.players WHERE is_active = true
WITH SECURITY INVOKER;

-- Fix team_test_only view
CREATE OR REPLACE VIEW public.team_test_only 
AS SELECT * FROM public.teams
WITH SECURITY INVOKER;

-- Fix teams_with_player_count view
CREATE OR REPLACE VIEW public.teams_with_player_count AS
SELECT t.*,
       COUNT(p.id) AS player_count
FROM public.teams t
LEFT JOIN public.players p ON p.team_id = t.id
GROUP BY t.id
WITH SECURITY INVOKER;

-- Fix activities_with_local_time view
CREATE OR REPLACE VIEW public.activities_with_local_time AS
SELECT a.*,
       -- Adjust timezone conversion as needed for your application
       (a.start_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone AS local_start_time,
       (a.end_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone AS local_end_time
FROM public.activities a
JOIN public.clubs c ON a.club_id = c.id
WITH SECURITY INVOKER;

-- Fix attendance_with_correct_dates view
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS
SELECT a.*,
       -- Adjust date/time handling as needed based on your application
       date_trunc('day', (act.start_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone) AS local_date
FROM public.attendance a
JOIN public.activities act ON a.activity_id = act.id
JOIN public.clubs c ON act.club_id = c.id
WITH SECURITY INVOKER;

-- IMPORTANT: The view definitions above are examples and should be adjusted
-- based on the actual structure and requirements of your views.
-- You may need to run 'SELECT pg_get_viewdef()' for each view to get the exact definition
-- before recreating them with SECURITY INVOKER. 