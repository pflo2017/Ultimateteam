-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Parents can view their children's attendance" ON activity_attendance;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_attendance TO authenticated;

-- Allow coaches to view attendance for their team's activities (simplified policy)
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
    AND c.admin_id = auth.uid()
    AND c.is_active = true
  )
);

-- Allow coaches to record attendance for their team's activities (simplified policy)
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_attendance.activity_id 
    AND c.admin_id = auth.uid()
    AND c.is_active = true
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to update attendance they recorded (simplified policy)
CREATE POLICY "Coaches can update their attendance records"
ON activity_attendance
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_attendance.activity_id 
    AND c.admin_id = auth.uid()
    AND c.is_active = true
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to delete attendance for their team's activities
CREATE POLICY "Coaches can delete attendance"
ON activity_attendance
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_attendance.activity_id 
    AND c.admin_id = auth.uid()
    AND c.is_active = true
  )
);

-- Allow admins to manage all attendance records
CREATE POLICY "Admins can manage all attendance"
ON activity_attendance
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Allow parents to view attendance for their children
CREATE POLICY "Parents can view their children's attendance"
ON activity_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN players p ON p.id = activity_attendance.player_id
    WHERE pc.parent_id = auth.uid()
    AND pc.full_name = p.name
    AND pc.is_active = true
  )
); 