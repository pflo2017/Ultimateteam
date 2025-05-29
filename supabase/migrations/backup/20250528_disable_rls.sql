-- Temporarily disable RLS on activity_attendance table
ALTER TABLE activity_attendance DISABLE ROW LEVEL SECURITY;

-- Ensure all permissions are granted
GRANT ALL ON activity_attendance TO authenticated;
GRANT ALL ON activity_attendance TO anon; 