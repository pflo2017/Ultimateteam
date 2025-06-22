-- BULLETPROOF fix for attendance_with_correct_dates view
-- Completely avoids date parsing to eliminate all errors

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Create an extremely simple view that uses only secure, reliable operations
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
SELECT 
    a.*,
    
    -- Join basic activity data
    act.type AS activity_type,
    act.title AS activity_title,
    act.team_id,
    
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
    
-- Join with activities table - use LEFT JOIN to maintain all attendance records
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
    );

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate the dependent view that was dropped by CASCADE
CREATE OR REPLACE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated; 