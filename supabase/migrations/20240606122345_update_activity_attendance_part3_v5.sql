-- Recreate the "Coaches can update their attendance records" policy
CREATE POLICY "Coaches can update their attendance records" 
ON activity_attendance 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = extract_base_uuid(activity_attendance.activity_id::text)
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = extract_base_uuid(activity_attendance.activity_id::text)
    AND c.user_id = auth.uid()
  )
);

-- Recreate the "Coaches can view attendance" policy if it exists
CREATE POLICY "Coaches can view attendance" 
ON activity_attendance 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = extract_base_uuid(activity_attendance.activity_id::text)
    AND c.user_id = auth.uid()
  )
);

-- Recreate the "Coaches can delete attendance" policy
CREATE POLICY "Coaches can delete attendance" 
ON activity_attendance 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = extract_base_uuid(activity_attendance.activity_id::text)
    AND c.user_id = auth.uid()
  )
); 