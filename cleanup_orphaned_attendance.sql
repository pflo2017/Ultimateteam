-- Script to clean up any orphaned attendance records in the database
-- Run this in the Supabase SQL Editor

-- First, identify and count orphaned attendance records
WITH orphaned_attendance AS (
  SELECT aa.id, aa.activity_id, aa.player_id, aa.status
  FROM activity_attendance aa
  LEFT JOIN activities a ON aa.activity_id = a.id
  WHERE a.id IS NULL
)
SELECT COUNT(*) as orphaned_attendance_count FROM orphaned_attendance;

-- Delete orphaned attendance records
DELETE FROM activity_attendance
WHERE activity_id IN (
  SELECT aa.activity_id
  FROM activity_attendance aa
  LEFT JOIN activities a ON aa.activity_id = a.id
  WHERE a.id IS NULL
);

-- Now, identify and count orphaned presence records
WITH orphaned_presence AS (
  SELECT ap.id, ap.activity_id, ap.player_id
  FROM activity_presence ap
  LEFT JOIN activities a ON ap.activity_id = a.id
  WHERE a.id IS NULL
)
SELECT COUNT(*) as orphaned_presence_count FROM orphaned_presence;

-- Delete orphaned presence records
DELETE FROM activity_presence
WHERE activity_id IN (
  SELECT ap.activity_id
  FROM activity_presence ap
  LEFT JOIN activities a ON ap.activity_id = a.id
  WHERE a.id IS NULL
);

-- Report success
SELECT 'Cleanup completed successfully. All orphaned attendance and presence records have been removed.' as status; 