-- Delete all activities and attendance records to start completely fresh
-- This is a clean slate approach that will allow us to implement the new system without constraint issues

-- First delete all attendance records since they reference activities
DELETE FROM activity_attendance;

-- Then delete all activities
DELETE FROM activities;

-- Now we can safely proceed with the migration to change the activity_id column type 