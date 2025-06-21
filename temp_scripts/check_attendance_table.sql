-- Check for attendance-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE' 
  AND table_name LIKE '%attend%';

-- Also check views that might contain attendance information
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE '%attend%';

-- See the view definition for attendance_with_correct_dates to find the correct table reference
SELECT pg_get_viewdef('public.attendance_with_correct_dates', true); 