-- Simplified approach to fix security definer views
-- This script only drops the problematic views

-- First, drop views in the correct order to handle dependencies
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

-- IMPORTANT: After running this script, follow up by creating scripts to rebuild each view
-- individually after examining their proper structure with:
--   SELECT pg_get_viewdef('original_view_name', true); 