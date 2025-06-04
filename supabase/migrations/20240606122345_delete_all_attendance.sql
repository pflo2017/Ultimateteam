-- Delete all attendance records to start fresh with the new activity ID format
-- This is a clean slate approach that will allow us to implement the new system without constraint issues

-- Delete all records from the activity_attendance table
DELETE FROM activity_attendance;

-- Now we can safely proceed with the migration to change the activity_id column type 