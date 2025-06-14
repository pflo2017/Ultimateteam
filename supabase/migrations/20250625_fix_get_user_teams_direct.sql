-- Fix the get_user_teams_direct function to properly handle club_id
-- This migration adds more debugging and ensures proper club data isolation

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_user_teams_direct();

-- Create an improved version with better debugging
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