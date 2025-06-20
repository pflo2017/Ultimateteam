-- Fix attendance_with_correct_dates view
-- This fixes the error: column attendance_with_correct_dates.activity_type does not exist
-- and ensures attendance counts are correctly calculated

-- First, let's drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Now recreate the view with the missing columns and improved activity ID handling
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
SELECT 
    a.*,
    -- Join data from activities
    act.type AS activity_type,
    act.title AS activity_title,
    act.team_id,
    act.start_time AS actual_activity_date,
    -- Keep the original local_date column for backward compatibility
    date_trunc('day', a.created_at) AS local_date,
    -- Extract the clean base ID for easier debugging
    CASE
      WHEN position('-' IN a.activity_id) > 0 AND position('-202' IN a.activity_id) > 0
      THEN substring(a.activity_id from 1 for position('-' IN a.activity_id)-1)
      ELSE a.activity_id
    END AS base_activity_id
FROM 
    public.activity_attendance a
LEFT JOIN 
    public.activities act ON 
      CASE
        WHEN position('-' IN a.activity_id) > 0 AND position('-202' IN a.activity_id) > 0
        THEN substring(a.activity_id from 1 for position('-' IN a.activity_id)-1)
        ELSE a.activity_id
      END = act.id::text;

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate the dependent view that was dropped by CASCADE
CREATE OR REPLACE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated; 