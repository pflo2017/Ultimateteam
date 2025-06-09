-- Recreate the policies
CREATE POLICY "Coaches can manage attendance for their team's activities" 
ON activity_attendance 
FOR ALL 
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

-- Recreate the "Coaches can record attendance" policy if it exists
CREATE POLICY "Coaches can record attendance" 
ON activity_attendance 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = extract_base_uuid(activity_attendance.activity_id::text)
    AND c.user_id = auth.uid()
  )
); 