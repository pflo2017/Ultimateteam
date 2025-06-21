-- Explicitly set all views to use SECURITY INVOKER
-- Run these commands one by one

-- 1. attendance_with_correct_dates
ALTER VIEW public.attendance_with_correct_dates SECURITY INVOKER;

-- 2. activities_with_local_time
ALTER VIEW public.activities_with_local_time SECURITY INVOKER;

-- 3. teams_with_player_count
ALTER VIEW public.teams_with_player_count SECURITY INVOKER;

-- 4. team_test_only
ALTER VIEW public.team_test_only SECURITY INVOKER;

-- 5. club_active_players
ALTER VIEW public.club_active_players SECURITY INVOKER;

-- 6. user_attendance_reports
ALTER VIEW public.user_attendance_reports SECURITY INVOKER;

-- 7. club_details
ALTER VIEW public.club_details SECURITY INVOKER;

-- Verify the security settings for the views
SELECT schemaname, viewname, viewowner, definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('attendance_with_correct_dates',
                  'activities_with_local_time',
                  'teams_with_player_count',
                  'team_test_only',
                  'club_active_players',
                  'user_attendance_reports',
                  'club_details'); 