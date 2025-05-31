-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can view attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can update their attendance records" ON activity_attendance;
DROP POLICY IF EXISTS "Coaches can delete attendance" ON activity_attendance;
DROP POLICY IF EXISTS "Direct coach access for attendance" ON activity_attendance;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_attendance TO authenticated;

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
    AND (
      -- Admin access via coach relationship
      t.coach_id IN (
        SELECT id FROM coaches 
        WHERE admin_id = auth.uid()
        AND is_active = true
      )
      OR 
      -- Direct coach access
      EXISTS (
        SELECT 1 FROM coaches c
        WHERE c.id = t.coach_id
        AND c.id::text = auth.uid()
        AND c.is_active = true
      )
    )
  )
);

-- Allow coaches to record attendance for their team's activities through admin
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_id 
    AND (
      -- Admin access via coach relationship
      t.coach_id IN (
        SELECT id FROM coaches 
        WHERE admin_id = auth.uid()
        AND is_active = true
      )
      OR 
      -- Direct coach access
      EXISTS (
        SELECT 1 FROM coaches c
        WHERE c.id = t.coach_id
        AND c.id::text = auth.uid()
        AND c.is_active = true
      )
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
    AND (
      -- Admin access via coach relationship
      t.coach_id IN (
        SELECT id FROM coaches 
        WHERE admin_id = auth.uid()
        AND is_active = true
      )
      OR 
      -- Direct coach access
      EXISTS (
        SELECT 1 FROM coaches c
        WHERE c.id = t.coach_id
        AND c.id::text = auth.uid()
        AND c.is_active = true
      )
    )
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
    WHERE a.id = activity_id 
    AND (
      -- Admin access via coach relationship
      t.coach_id IN (
        SELECT id FROM coaches 
        WHERE admin_id = auth.uid()
        AND is_active = true
      )
      OR 
      -- Direct coach access
      EXISTS (
        SELECT 1 FROM coaches c
        WHERE c.id = t.coach_id
        AND c.id::text = auth.uid()
        AND c.is_active = true
      )
    )
  )
);

-- Admin policy (ensure this exists)
CREATE POLICY IF NOT EXISTS "Admins can manage all attendance"
ON activity_attendance
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = auth.uid()
  )
); 