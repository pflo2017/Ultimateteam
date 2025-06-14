-- Fix Teams RLS policies for proper data isolation
-- This ensures that users only see teams from their own club

-- Drop existing policies
DROP POLICY IF EXISTS "Teams are viewable by users in the same club" ON teams;
DROP POLICY IF EXISTS "Teams are viewable by admin who created them" ON teams;
DROP POLICY IF EXISTS "Teams are insertable by authenticated admins" ON teams;
DROP POLICY IF EXISTS "Teams are updatable by admin who created them" ON teams;
DROP POLICY IF EXISTS "Teams are deletable by admin who created them" ON teams;

-- Create comprehensive select policy
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

-- Create insert policy
CREATE POLICY "Teams are insertable by club admin" 
ON teams
FOR INSERT
WITH CHECK (
  -- Only allow inserting teams for clubs the user is an admin of
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
  )
);

-- Create update policy
CREATE POLICY "Teams are updatable by club admin" 
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

-- Create delete policy
CREATE POLICY "Teams are deletable by club admin" 
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

-- Create a function to debug RLS policies
CREATE OR REPLACE FUNCTION debug_teams_rls(p_user_id UUID)
RETURNS TABLE (
  policy_name TEXT,
  result BOOLEAN
) AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get the user's club_id
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = p_user_id;
  
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = p_user_id;
  END IF;
  
  -- Return policy evaluation results
  RETURN QUERY
  SELECT 
    'Teams are viewable by users in the same club' as policy_name,
    EXISTS (
      SELECT 1 FROM clubs c WHERE c.admin_id = p_user_id
      UNION
      SELECT 1 FROM coaches c WHERE c.user_id = p_user_id
    ) as result;
    
  RETURN QUERY
  SELECT 
    'Teams are insertable by club admin' as policy_name,
    EXISTS (
      SELECT 1 FROM clubs c WHERE c.admin_id = p_user_id
    ) as result;
    
  RETURN QUERY
  SELECT 
    'Teams are updatable by club admin' as policy_name,
    EXISTS (
      SELECT 1 FROM clubs c WHERE c.admin_id = p_user_id
    ) as result;
    
  RETURN QUERY
  SELECT 
    'Teams are deletable by club admin' as policy_name,
    EXISTS (
      SELECT 1 FROM clubs c WHERE c.admin_id = p_user_id
    ) as result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION debug_teams_rls IS 'Debug function to evaluate RLS policies for a given user'; 