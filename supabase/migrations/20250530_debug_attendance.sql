-- First drop the existing policy
DROP POLICY IF EXISTS "Coaches can record attendance" ON activity_attendance;

-- Check for existing attendance records
SELECT aa.*, a.team_id, t.coach_id
FROM activity_attendance aa
JOIN activities a ON a.id = aa.activity_id
JOIN teams t ON t.id = a.team_id
WHERE aa.activity_id = 'ca5b6bc8-8a3e-4d22-b6b7-1580eeb3e04c'
AND aa.player_id = 'bdecf65c-8ed4-4498-ab92-75d66bbd3d3a';

-- Now let's check if the activity exists and its team
SELECT a.id as activity_id, a.team_id, t.id as team_id, t.coach_id, c.id as coach_id, c.is_active
FROM activities a
JOIN teams t ON a.team_id = t.id
JOIN coaches c ON t.coach_id = c.id
WHERE a.id = 'ca5b6bc8-8a3e-4d22-b6b7-1580eeb3e04c';

-- Then, let's check the current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'activity_attendance';

-- Let's also check if the coach is properly linked
SELECT c.id as coach_id, c.is_active, c.user_id, t.id as team_id
FROM coaches c
JOIN teams t ON t.coach_id = c.id
WHERE c.id = '32efbe39-15ca-417a-b340-4d7eb4324db6';

-- Create a simpler policy for testing
CREATE POLICY "Coaches can record attendance"
ON activity_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_attendance.activity_id
    AND t.coach_id = activity_attendance.recorded_by
  )
);

-- Try to update the existing record instead of inserting
UPDATE activity_attendance
SET status = 'present',
    recorded_at = NOW(),
    coach_name = 'Sorin Lovin'
WHERE activity_id = 'ca5b6bc8-8a3e-4d22-b6b7-1580eeb3e04c'
AND player_id = 'bdecf65c-8ed4-4498-ab92-75d66bbd3d3a'
RETURNING *; 