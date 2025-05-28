-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON activity_attendance TO authenticated;

-- Allow coaches to view attendance for their team's activities
CREATE POLICY "Coaches can view attendance"
ON activity_attendance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_id 
    AND t.coach_id IN (
      SELECT id FROM coaches 
      WHERE admin_id = auth.uid()
      AND is_active = true
      AND access_code = current_setting('app.coach_access_code', true)
    )
  )
);

-- Allow coaches to record attendance for their team's activities
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_id 
    AND t.coach_id IN (
      SELECT id FROM coaches 
      WHERE admin_id = auth.uid()
      AND is_active = true
      AND access_code = current_setting('app.coach_access_code', true)
    )
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
    WHERE a.id = activity_id 
    AND t.coach_id IN (
      SELECT id FROM coaches 
      WHERE admin_id = auth.uid()
      AND is_active = true
      AND access_code = current_setting('app.coach_access_code', true)
    )
  )
  AND recorded_by = auth.uid()
); 