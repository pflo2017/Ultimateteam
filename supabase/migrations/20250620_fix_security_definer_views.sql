-- Fix SECURITY DEFINER warnings for attendance-related views
-- These views are currently configured to use SECURITY DEFINER, causing RLS policies to be bypassed

-- Drop the views in the correct dependency order
DROP VIEW IF EXISTS public.user_attendance_reports CASCADE;
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Recreate attendance_with_correct_dates with security_invoker=true
CREATE OR REPLACE VIEW public.attendance_with_correct_dates
WITH (security_invoker = true)
AS 
SELECT 
    a.*,
    -- Extract the actual date from composite activity IDs or use the activity start date
    CASE
        -- When activity_id contains a date component (format UUID-YYYYMMDD)
        WHEN position('-202' IN a.activity_id) > 0 THEN 
            -- Extract date from the activity_id suffix
            to_date(substring(a.activity_id from position('-' IN a.activity_id) + 1), 'YYYYMMDD')::timestamp with time zone
        ELSE
            -- For regular activities, join with activities table to get the start_time
            (SELECT start_time FROM activities WHERE id::text = a.activity_id)
    END AS actual_activity_date,
    -- Keep the original local_date column for backward compatibility
    date_trunc('day', a.created_at) AS local_date,
    -- Add activity_type if it hasn't been defined previously
    (SELECT type FROM activities WHERE id::text = a.activity_id) AS activity_type,
    -- Add player_name if needed (for better reporting)
    (SELECT name FROM players WHERE id = a.player_id) AS player_name
FROM 
    public.activity_attendance a;

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate user_attendance_reports with security_invoker
CREATE OR REPLACE VIEW public.user_attendance_reports
WITH (security_invoker = true)
AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated;

-- Force reload of RLS policies
NOTIFY pgrst, 'reload config'; 