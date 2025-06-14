-- Fix team data isolation issues
-- This migration ensures that the team selector in the filter modal only shows teams from the user's club

-- Create an improved version of get_user_teams_direct with better debugging
CREATE OR REPLACE FUNCTION public.get_user_teams_direct()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_debug TEXT;
BEGIN
  -- Get the current user ID directly
  v_user_id := auth.uid();
  v_debug := 'User ID: ' || COALESCE(v_user_id::TEXT, 'null');
  
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = v_user_id;
  
  v_debug := v_debug || ', Admin club check: ' || COALESCE(v_club_id::TEXT, 'null');
  
  -- If not found as admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = v_user_id;
    
    v_debug := v_debug || ', Coach club check: ' || COALESCE(v_club_id::TEXT, 'null');
  END IF;
  
  -- Log for debugging
  RAISE LOG 'get_user_teams_direct debug: %', v_debug;
  
  -- Return teams for the user's club if we found a club_id
  IF v_club_id IS NOT NULL THEN
    -- Direct debug query to check what teams exist for this club
    RAISE LOG 'get_user_teams_direct: Querying teams for club_id=%', v_club_id;
    
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  ELSE
    -- Return empty result set
    RAISE LOG 'get_user_teams_direct: No club_id found for user %', v_user_id;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_user_teams_direct IS 'Get teams for the current user based on their club association (fixed version with debugging)';

-- Create a function to directly get teams by club ID (for testing)
CREATE OR REPLACE FUNCTION public.get_teams_by_club_direct(p_club_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.is_active, t.club_id
  FROM teams t
  WHERE t.club_id = p_club_id
  AND t.is_active = true
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_teams_by_club_direct IS 'Get teams for a specific club (for direct testing)';

-- Fix Teams RLS policies for proper data isolation
-- Use DO block to safely drop existing policies if they exist
DO $$
BEGIN
    -- Drop policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Teams are insertable by club admin' AND tablename = 'teams') THEN
        DROP POLICY "Teams are insertable by club admin" ON teams;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Teams are updatable by club admin' AND tablename = 'teams') THEN
        DROP POLICY "Teams are updatable by club admin" ON teams;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Teams are deletable by club admin' AND tablename = 'teams') THEN
        DROP POLICY "Teams are deletable by club admin" ON teams;
    END IF;
END
$$;

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