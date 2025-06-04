-- Recreate the "Coaches can update their attendance records" policy
CREATE POLICY "Coaches can update their attendance records" 
ON activity_attendance 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_attendance.activity_id::uuid
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_attendance.activity_id::uuid
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
);

-- Recreate the "Admins can manage all attendance" policy if it exists
CREATE POLICY "Admins can manage all attendance" 
ON activity_attendance 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid()
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
    WHERE a.id = activity_attendance.activity_id::uuid
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
);

-- Recreate the "Players can view their own attendance" policy if it exists
CREATE POLICY "Players can view their own attendance" 
ON activity_attendance 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM players p
    WHERE p.id = activity_attendance.player_id
    AND p.auth_id = auth.uid()
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
    WHERE a.id = activity_attendance.activity_id::uuid
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
); 