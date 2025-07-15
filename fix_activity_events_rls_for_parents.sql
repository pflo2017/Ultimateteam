-- Fix the RLS policy for activity_events to allow parents to view events
-- The current policy checks pc.parent_id = auth.uid() but it should check
-- that the parent's user_id matches auth.uid()

-- Drop the existing parent policy
DROP POLICY IF EXISTS "Parents can view events for their children's activities" ON activity_events;

-- Create the corrected policy
CREATE POLICY "Parents can view events for their children's activities"
ON activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN parent_children pc ON pc.team_id = t.id
    JOIN parents p ON pc.parent_id = p.id
    WHERE a.id::text = activity_events.activity_id
    AND p.user_id = auth.uid()
  )
); 