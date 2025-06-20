-- Final fix for attendance_with_correct_dates view
-- This handles composite activity IDs more accurately to ensure all attendance records are counted

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Now recreate the view with comprehensive composite ID handling
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
SELECT 
    a.*,
    
    -- Add activity details from base activity
    COALESCE(act.type, r_act.type) AS activity_type,
    COALESCE(act.title, r_act.title) AS activity_title,
    COALESCE(act.team_id, r_act.team_id) AS team_id,
    
    -- For date handling, use recurring date if available, otherwise base activity date
    COALESCE(
        -- For recurring activities (with date suffix), handle specially
        CASE WHEN position('-' IN a.activity_id) > 0 AND a.activity_id ~ '-[0-9]{8}$' THEN
            -- Try to parse the date suffix in YYYYMMDD format
            (
                to_timestamp(
                    substring(a.activity_id from position('-' IN a.activity_id) + 1), 
                    'YYYYMMDD'
                )
            )::timestamp with time zone
        ELSE NULL END,
        -- If not a valid recurring ID or parsing fails, fall back to activity date
        COALESCE(act.start_time, r_act.start_time)
    ) AS actual_activity_date,
    
    -- Keep the original local_date column for backward compatibility
    date_trunc('day', a.created_at) AS local_date,
    
    -- Extract the clean base ID for easier debugging and tracking
    CASE
        WHEN position('-' IN a.activity_id) > 0 AND a.activity_id ~ '-[0-9]{8}$' THEN
            substring(a.activity_id from 1 for position('-' IN a.activity_id) - 1)
        ELSE 
            a.activity_id
    END AS base_activity_id
FROM 
    public.activity_attendance a

-- First try to match the activity_id directly (for regular activities)
LEFT JOIN 
    public.activities act ON a.activity_id = act.id::text

-- Then try to match using the base activity ID (for recurring activities)
LEFT JOIN 
    public.activities r_act ON 
        CASE
            WHEN position('-' IN a.activity_id) > 0 AND a.activity_id ~ '-[0-9]{8}$' THEN
                substring(a.activity_id from 1 for position('-' IN a.activity_id) - 1) = r_act.id::text
            ELSE 
                false -- Skip this join for non-recurring activities
        END;

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate the dependent view that was dropped by CASCADE
CREATE OR REPLACE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated; 