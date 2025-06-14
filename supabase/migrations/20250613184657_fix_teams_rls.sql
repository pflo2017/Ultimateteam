-- Fix Teams RLS policy for proper data isolation
-- This ensures that users only see teams from their own club

-- Update RLS policies for teams
DROP POLICY IF EXISTS "Teams are viewable by users in the same club" ON teams;
CREATE POLICY "Teams are viewable by users in the same club" 
ON teams
FOR SELECT
USING (
  -- Direct club_id check for better performance and reliability
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c WHERE c.user_id = auth.uid()
  )
);

-- Also update the insert, update, and delete policies for teams
DROP POLICY IF EXISTS "Teams are insertable by admin" ON teams;
CREATE POLICY "Teams are insertable by admin" 
ON teams
FOR INSERT
WITH CHECK (
  -- Only allow inserting teams for clubs the user is an admin of
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teams are updatable by admin" ON teams;
CREATE POLICY "Teams are updatable by admin" 
ON teams
FOR UPDATE
USING (
  -- Only allow updating teams for clubs the user is an admin of
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
  )
)
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teams are deletable by admin" ON teams;
CREATE POLICY "Teams are deletable by admin" 
ON teams
FOR DELETE
USING (
  -- Only allow deleting teams for clubs the user is an admin of
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
  )
);

-- Add a comment to explain the changes
COMMENT ON TABLE teams IS 'Teams table with proper club-level data isolation through RLS policies';
