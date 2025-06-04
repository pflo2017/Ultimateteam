-- Drop all policies on activity_attendance table
DROP POLICY IF EXISTS "Coaches can manage attendance for their team's activities" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Players can view their own attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can delete attendance" ON activity_attendance;

-- Update activity_attendance table to use TEXT instead of UUID for activity_id
ALTER TABLE activity_attendance ALTER COLUMN activity_id TYPE TEXT;

-- Add comment explaining the change
COMMENT ON COLUMN activity_attendance.activity_id IS 'Activity ID - can be a UUID or a composite ID for recurring instances (UUID-YYYYMMDD)'; 