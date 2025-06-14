-- Fix the get_user_teams function to ensure it properly filters teams by club_id
-- This version adds extra debugging and a more direct approach

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_user_teams();

-- Create a simpler version that uses auth.uid() directly
CREATE OR REPLACE FUNCTION public.get_user_teams()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_debug_info TEXT;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  v_debug_info := 'User ID: ' || v_user_id::TEXT;
  
  -- First try to get club_id from admin relationship
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = v_user_id;
  
  v_debug_info := v_debug_info || ', Admin club check: ' || COALESCE(v_club_id::TEXT, 'null');
  
  -- If not an admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = v_user_id;
    
    v_debug_info := v_debug_info || ', Coach club check: ' || COALESCE(v_club_id::TEXT, 'null');
  END IF;
  
  -- Log the debug info to the PostgreSQL logs
  RAISE NOTICE 'get_user_teams debug: %', v_debug_info;
  
  -- Return teams for the user's club if we found a club_id
  IF v_club_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.name, t.is_active, t.club_id
    FROM teams t
    WHERE t.club_id = v_club_id
    AND t.is_active = true
    ORDER BY t.name;
  ELSE
    -- If no club_id found, return an empty result set
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to explain function purpose
COMMENT ON FUNCTION public.get_user_teams IS 'Get teams for the current user based on their club association (fixed version)';

-- Create a function that takes a user_id parameter for testing
CREATE OR REPLACE FUNCTION public.get_teams_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  club_id UUID
) AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- First try to get club_id from admin relationship
  SELECT c.id INTO v_club_id
  FROM clubs c
  WHERE c.admin_id = p_user_id;
  
  -- If not an admin, check if user is a coach
  IF v_club_id IS NULL THEN
    SELECT c.club_id INTO v_club_id
    FROM coaches c
    WHERE c.user_id = p_user_id;
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
COMMENT ON FUNCTION public.get_teams_for_user IS 'Get teams for a specific user based on their club association (for testing)';

-- Create a function that directly returns teams for a specific club
CREATE OR REPLACE FUNCTION public.get_teams_for_club(p_club_id UUID)
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
COMMENT ON FUNCTION public.get_teams_for_club IS 'Get teams for a specific club (for direct testing)';
