-- Fix attendance_with_correct_dates view
-- The view is missing the actual_activity_date column which is being referenced in code

-- First, let's drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Now recreate the view with the missing column
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
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
    date_trunc('day', a.created_at) AS local_date
FROM 
    public.activity_attendance a;

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate the dependent view that was dropped by CASCADE
CREATE OR REPLACE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated; 