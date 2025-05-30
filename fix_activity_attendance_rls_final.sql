-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can delete attendance" ON activity_attendance;

-- Allow coaches to record attendance for their team's activities
-- The key fix is to use auth.uid() for both checking coach permissions AND in recorded_by
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
    AND c.user_id = auth.uid()
    AND c.is_active = true
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to update attendance they recorded
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
    AND c.user_id = auth.uid()
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
    AND c.user_id = auth.uid()
    AND c.is_active = true
  )
  AND recorded_by = auth.uid()
); 