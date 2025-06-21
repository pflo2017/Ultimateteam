-- Drop existing view policy if it exists
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;

-- Create a new policy that allows coaches to view attendance for their team's activities
CREATE POLICY "Coaches can view attendance"
ON activity_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_attendance.activity_id
    AND c.user_id = auth.uid()
    AND c.is_active = true
  )
);

-- Create a policy for admins to view all attendance records
DROP POLICY IF EXISTS "Admins can view all attendance" ON activity_attendance;

CREATE POLICY "Admins can view all attendance"
ON activity_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = auth.uid()
  )
); 