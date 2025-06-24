-- Fix attendance date issues in attendance_with_correct_dates view
-- This ensures that attendance records are correctly associated with activity dates

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;

-- Create the updated view with proper date handling
CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
SELECT 
    a.*,
    
    -- Join basic activity data
    act.type AS activity_type,
    act.title AS activity_title,
    act.team_id,
    
    -- Add player name from players table
    p.name AS player_name,
    
    -- Use the activity's scheduled date as the primary date reference
    -- If actual_activity_date is set in the record, use that
    -- Otherwise fall back to the activity's start_time
    COALESCE(
        a.actual_activity_date,
        act.start_time
    ) AS actual_activity_date,
    
    -- Add a local_date column that's just the date part for easier filtering
    -- Format as YYYY-MM-DD with T00:00:00+00:00 for consistent timezone handling
    to_char(
        COALESCE(
            a.actual_activity_date,
            act.start_time,
            a.created_at
        )::date, 
        'YYYY-MM-DD'
    ) || 'T00:00:00+00:00' AS local_date,
    
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

-- Create an index on actual_activity_date for better performance
CREATE INDEX IF NOT EXISTS attendance_actual_date_idx ON activity_attendance(actual_activity_date);

-- Grant appropriate permissions
GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;

-- Recreate the dependent view that was dropped by CASCADE
CREATE OR REPLACE VIEW public.user_attendance_reports AS 
SELECT * FROM public.attendance_with_correct_dates;

-- Grant appropriate permissions to the dependent view
GRANT SELECT ON public.user_attendance_reports TO authenticated; 

-- Print a message to confirm completion
SELECT 'Attendance date issues fixed successfully!' AS message; 