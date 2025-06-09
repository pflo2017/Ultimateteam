-- Drop all policies on activity_attendance table
DROP POLICY IF EXISTS "Coaches can manage attendance for their team's activities" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Players can view their own attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can delete attendance" ON activity_attendance;

-- Create a function to extract the base UUID from a composite ID
CREATE OR REPLACE FUNCTION extract_base_uuid(activity_id TEXT) 
RETURNS UUID AS $$
BEGIN
  -- Check if the ID has a date suffix (format: uuid-date)
  IF position('-202' IN activity_id) > 0 THEN
    -- Extract the base UUID part (first 36 characters which is a standard UUID)
    RETURN substring(activity_id, 1, 36)::UUID;
  ELSE
    -- Return the ID as is if it's already a standard UUID
    RETURN activity_id::UUID;
  END IF;
EXCEPTION
  WHEN others THEN
    -- Return NULL if the conversion fails
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update activity_attendance table to use TEXT instead of UUID for activity_id
ALTER TABLE activity_attendance ALTER COLUMN activity_id TYPE TEXT;

-- Add comment explaining the change
COMMENT ON COLUMN activity_attendance.activity_id IS 'Activity ID - can be a UUID or a composite ID for recurring instances (UUID-YYYYMMDD)'; 