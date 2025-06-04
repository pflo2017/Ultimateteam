-- Drop the foreign key constraint before changing the column type
ALTER TABLE activity_attendance DROP CONSTRAINT IF EXISTS activity_attendance_activity_id_fkey1; 