-- Fix security warnings in Supabase database using compatible syntax
-- Apply each transaction separately and test before committing

-- TRANSACTION 1: Enable RLS on master_admins table
BEGIN;
-- Fix RLS for master_admins table (has policy but RLS disabled)
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 2: Enable RLS on backup tables
BEGIN;
-- Enable RLS on backup tables
ALTER TABLE public.players_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_payment_backup ENABLE ROW LEVEL SECURITY;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 3: Add security policies to backup tables
BEGIN;
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
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

BEGIN;
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
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 4: Fix club_details view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.club_details', true);

BEGIN;
-- Fix club_details view (both auth.users exposure and SECURITY DEFINER issue)
-- First recreate view without auth.users references
CREATE OR REPLACE VIEW public.club_details AS
SELECT c.*,
       -- Replace direct auth.users references with NULL or fields from clubs table
       -- Adjust based on what data is actually needed from the view
       NULL AS user_email  -- Example placeholder, replace with actual field
FROM public.clubs c;

-- Then change security using ALTER VIEW
ALTER VIEW public.club_details SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 5: Fix user_attendance_reports view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.user_attendance_reports', true);

BEGIN;
CREATE OR REPLACE VIEW public.user_attendance_reports 
AS SELECT * FROM public.attendance_with_correct_dates;

ALTER VIEW public.user_attendance_reports SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 6: Fix club_active_players view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.club_active_players', true);

BEGIN;
CREATE OR REPLACE VIEW public.club_active_players 
AS SELECT * FROM public.players WHERE is_active = true;

ALTER VIEW public.club_active_players SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 7: Fix team_test_only view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.team_test_only', true);

BEGIN;
CREATE OR REPLACE VIEW public.team_test_only 
AS SELECT * FROM public.teams;

ALTER VIEW public.team_test_only SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 8: Fix teams_with_player_count view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.teams_with_player_count', true);

BEGIN;
CREATE OR REPLACE VIEW public.teams_with_player_count AS
SELECT t.*,
       COUNT(p.id) AS player_count
FROM public.teams t
LEFT JOIN public.players p ON p.team_id = t.id
GROUP BY t.id;

ALTER VIEW public.teams_with_player_count SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 9: Fix activities_with_local_time view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.activities_with_local_time', true);

BEGIN;
CREATE OR REPLACE VIEW public.activities_with_local_time AS
SELECT a.*,
       -- Adjust timezone conversion as needed for your application
       (a.start_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone AS local_start_time,
       (a.end_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone AS local_end_time
FROM public.activities a
JOIN public.clubs c ON a.club_id = c.id;

ALTER VIEW public.activities_with_local_time SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- TRANSACTION 10: Fix attendance_with_correct_dates view
-- First, check its current definition:
-- SELECT pg_get_viewdef('public.attendance_with_correct_dates', true);

BEGIN;
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS
SELECT a.*,
       -- Adjust date/time handling as needed based on your application
       date_trunc('day', (act.start_time AT TIME ZONE 'UTC') AT TIME ZONE c.timezone) AS local_date
FROM public.attendance a
JOIN public.activities act ON a.activity_id = act.id
JOIN public.clubs c ON act.club_id = c.id;

ALTER VIEW public.attendance_with_correct_dates SECURITY INVOKER;
-- Test the application, then:
-- COMMIT; -- or ROLLBACK; if issues occur
END;

-- IMPORTANT: The view definitions above are examples and should be adjusted
-- based on the actual structure of your views.
-- Before applying each transaction:
-- 1. Use the commented SELECT pg_get_viewdef() to get the exact definition
-- 2. Copy the view body but remove any reference to auth.users
-- 3. Change security using ALTER VIEW instead of WITH syntax 