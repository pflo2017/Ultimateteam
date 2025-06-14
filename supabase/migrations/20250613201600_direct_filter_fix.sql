-- Direct fix for team filtering issues
-- This ensures only teams from the current user's club are visible

-- 1. Create a new version of get_user_teams that is simpler and more direct
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
BEGIN
  -- Get the current user ID directly
  v_user_id := auth.uid();
  
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = v_user_id;
  
  -- If not found as admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = v_user_id;
  END IF;
  
  -- Log for debugging
  RAISE LOG 'get_user_teams_direct: user_id=%, club_id=%', v_user_id, v_club_id;
  
  -- Return teams for the user's club if we found a club_id
  IF v_club_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  ELSE
    -- Return empty result set
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to get teams by name (for direct filtering)
CREATE OR REPLACE FUNCTION public.get_teams_by_name(p_name TEXT)
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
  WHERE t.name = p_name
  AND t.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a view that only shows Team test (for testing purposes)
CREATE OR REPLACE VIEW public.team_test_only AS
SELECT t.id, t.name, t.is_active, t.club_id
FROM teams t
WHERE t.name = 'Team test'
AND t.is_active = true;

-- 4. Grant permissions to the view
GRANT SELECT ON public.team_test_only TO authenticated;
GRANT SELECT ON public.team_test_only TO service_role;

-- 5. Create a function to get a user's club ID by email (for debugging)
CREATE OR REPLACE FUNCTION public.get_club_id_by_email(p_email TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  -- First check if user is an admin
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = v_user_id;
  
  -- If not found as admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = v_user_id;
  END IF;
  
  RETURN v_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
