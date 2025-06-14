-- Fix teams filtering to ensure proper club-based isolation
-- This migration creates a function to get teams by club_id

-- Create a function to get teams for a specific club
CREATE OR REPLACE FUNCTION public.get_teams_by_club_id(p_club_id UUID)
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
COMMENT ON FUNCTION public.get_teams_by_club_id IS 'Get teams for a specific club, enforcing data isolation';

-- Create a function to get teams for the current user
CREATE OR REPLACE FUNCTION public.get_user_teams()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get the club_id for the current user
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = auth.uid();
  
  -- If not an admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = auth.uid();
  END IF;
  
  -- Return teams for the user's club
  IF v_club_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_user_teams IS 'Get teams for the current user based on their club association';

-- Ensure the RLS policy for teams is properly set
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
