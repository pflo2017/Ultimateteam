-- Drop all policies on activity_attendance table
DROP POLICY IF EXISTS "Coaches can manage attendance for their team's activities" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Players can view their own attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;

-- Update activity_attendance table to use TEXT instead of UUID for activity_id
ALTER TABLE activity_attendance ALTER COLUMN activity_id TYPE TEXT;

-- Add comment explaining the change
COMMENT ON COLUMN activity_attendance.activity_id IS 'Activity ID - can be a UUID or a composite ID for recurring instances (UUID-YYYYMMDD)';

-- Recreate the policies
CREATE POLICY "Coaches can manage attendance for their team's activities" 
ON activity_attendance 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_attendance.activity_id
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_attendance.activity_id
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
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
    WHERE a.id::text = activity_attendance.activity_id
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
);

-- Recreate the "Coaches can update their attendance records" policy
CREATE POLICY "Coaches can update their attendance records" 
ON activity_attendance 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_attendance.activity_id
    AND t.coach_id = (SELECT id FROM coaches WHERE auth_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id::text = activity_attendance.activity_id
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
    WHERE a.id::text = activity_attendance.activity_id
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