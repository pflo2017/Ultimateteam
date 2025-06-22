-- Comprehensive SQL script to fix attendance data issues
-- Run this in Supabase SQL Editor to fix all attendance-related issues

-- First, check table definitions to understand the column types
SELECT 
  table_name, 
  column_name, 
  data_type, 
  udt_name
FROM 
  information_schema.columns 
WHERE 
  table_schema = 'public' AND 
  table_name IN ('activities', 'activity_attendance', 'activity_presence') AND
  column_name IN ('id', 'activity_id');

-- Find and count orphaned attendance records (records where the activity no longer exists)
WITH orphaned_attendance AS (
  SELECT aa.id, aa.activity_id, aa.player_id, aa.status
  FROM activity_attendance aa
  LEFT JOIN activities a ON aa.activity_id::uuid = a.id
  WHERE a.id IS NULL
)
SELECT COUNT(*) as orphaned_attendance_count FROM orphaned_attendance;

-- Find and count orphaned presence records (records where the activity no longer exists)
WITH orphaned_presence AS (
  SELECT ap.id, ap.activity_id, ap.player_id, ap.status
  FROM activity_presence ap
  LEFT JOIN activities a ON ap.activity_id::uuid = a.id
  WHERE a.id IS NULL
)
SELECT COUNT(*) as orphaned_presence_count FROM orphaned_presence;

-- Show affected players with orphaned attendance records
SELECT 
  p.name AS player_name, 
  COUNT(*) AS orphaned_records_count
FROM 
  activity_attendance aa
  JOIN players p ON aa.player_id::uuid = p.id
  LEFT JOIN activities a ON aa.activity_id::uuid = a.id
WHERE 
  a.id IS NULL
GROUP BY 
  p.name
ORDER BY 
  orphaned_records_count DESC;

-- Delete all orphaned attendance records (records where the activity no longer exists)
DELETE FROM activity_attendance
WHERE activity_id::uuid NOT IN (
  SELECT id FROM activities
);

-- Delete all orphaned presence records (records where the activity no longer exists)
DELETE FROM activity_presence
WHERE activity_id::uuid NOT IN (
  SELECT id FROM activities
);

-- Find any remaining attendance records marked as 'present' for specific players with issues
-- Uncomment and run this to check specific players
/*
SELECT 
  p.name AS player_name,
  aa.status,
  a.type AS activity_type,
  a.title AS activity_title,
  a.start_time
FROM 
  activity_attendance aa
  JOIN players p ON aa.player_id::uuid = p.id
  JOIN activities a ON aa.activity_id::uuid = a.id
WHERE 
  p.name LIKE '%Simon Popescu%' AND
  aa.status = 'present'
ORDER BY 
  a.start_time DESC;
*/

-- Verify the fix by checking attendance counts by activity type
-- This will help identify if certain activity types are still causing issues
SELECT 
  a.type AS activity_type,
  COUNT(aa.id) AS attendance_count,
  COUNT(CASE WHEN aa.status = 'present' THEN 1 END) AS present_count,
  COUNT(CASE WHEN aa.status = 'absent' THEN 1 END) AS absent_count
FROM 
  activity_attendance aa
  JOIN activities a ON aa.activity_id::uuid = a.id
GROUP BY 
  a.type;

-- If there are any specific game records causing issues, you can remove them with:
/*
DELETE FROM activity_attendance
WHERE activity_id::uuid IN (
  SELECT id FROM activities WHERE type = 'game'
) AND player_id::uuid IN (
  SELECT id FROM players WHERE name LIKE '%problematic player name%'
);
*/

-- Report completion
SELECT 'Clean-up operation completed successfully' AS status; 