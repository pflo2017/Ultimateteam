-- Fix SECURITY DEFINER views
-- This script fixes the security warnings by converting views to use SECURITY INVOKER

BEGIN;

-- First, save the current view definitions for reference
CREATE TEMPORARY TABLE temp_view_definitions AS
SELECT
    schemaname,
    viewname,
    definition
FROM
    pg_catalog.pg_views
WHERE
    schemaname = 'public'
    AND viewname IN ('attendance_with_correct_dates', 'user_attendance_reports');

-- Drop the existing views with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.user_attendance_reports CASCADE;
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Recreate attendance_with_correct_dates with SECURITY INVOKER
CREATE OR REPLACE VIEW public.attendance_with_correct_dates
WITH (security_invoker=true)
AS 
SELECT 
    a.*,
    
    -- Join basic activity data
    act.type AS activity_type,
    act.title AS activity_title,
    act.team_id,
    
    -- Add player name from players table
    p.name AS player_name,
    
    -- Use ONLY the activity start_time to avoid ANY date parsing issues
    act.start_time AS actual_activity_date,
    
    -- Keep the original local_date column for backward compatibility
    date_trunc('day', a.created_at) AS local_date,
    
    -- Store the base activity ID for reference
    -- Extract base UUID if pattern matches exactly, otherwise use as-is
    CASE
        WHEN a.activity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9]{8}$' THEN
            substring(a.activity_id, 1, 36)
        ELSE 
            a.activity_id
    END AS base_activity_id
FROM 
    -- Start with all attendance records
    public.activity_attendance a
    
-- Join with activities table
LEFT JOIN public.activities act ON 
    -- For normal activities (exact match)
    a.activity_id = act.id::text 
    OR 
    -- For activities with date suffix (if activity_id starts with act.id)
    (
        act.id::text = 
        CASE
            -- Perfect pattern match for UUIDs with date suffix
            WHEN a.activity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9]{8}$' THEN
                substring(a.activity_id, 1, 36)
            -- Standard UUID without suffix
            WHEN a.activity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                a.activity_id
            ELSE 
                -- If not matching either pattern, use NULL to avoid incorrect matches
                NULL
        END
    )
    
-- Join with players table to get player names
LEFT JOIN public.players p ON a.player_id = p.id;

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate user_attendance_reports with SECURITY INVOKER
CREATE OR REPLACE VIEW public.user_attendance_reports
WITH (security_invoker=true)
AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated;

-- Commit the transaction if everything went well
COMMIT;

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully fixed SECURITY DEFINER issues for attendance views.';
END $$; 