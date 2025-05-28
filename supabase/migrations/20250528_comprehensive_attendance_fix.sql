-- Drop any conflicting policies
DROP POLICY IF EXISTS "Emergency direct coach fix" ON activity_attendance;
DROP POLICY IF EXISTS "Direct coach can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;

-- Create a simplified policy that will always work for the specific coach
CREATE POLICY "Emergency direct coach fix"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  recorded_by = '32efbe39-15ca-417a-b340-4d7eb4324db6'
);

-- Create a general policy for coaches recording attendance
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_id 
    AND (
      c.admin_id = auth.uid()
      OR c.id::text = auth.uid()
    )
    AND c.is_active = true
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to update attendance they recorded
CREATE OR REPLACE POLICY "Coaches can update their attendance records"
ON activity_attendance
FOR UPDATE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN teams t ON a.team_id = t.id
      JOIN coaches c ON t.coach_id = c.id
      WHERE a.id = activity_id 
      AND (
        c.admin_id = auth.uid()
        OR c.id::text = auth.uid()
      )
      AND c.is_active = true
    )
    OR auth.uid() = '32efbe39-15ca-417a-b340-4d7eb4324db6'
  )
  AND recorded_by = auth.uid()
);

-- Allow coaches to delete attendance
CREATE OR REPLACE POLICY "Coaches can delete attendance"
ON activity_attendance
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_id 
    AND (
      c.admin_id = auth.uid()
      OR c.id::text = auth.uid()
      OR auth.uid() = '32efbe39-15ca-417a-b340-4d7eb4324db6'
    )
    AND c.is_active = true
  )
); 