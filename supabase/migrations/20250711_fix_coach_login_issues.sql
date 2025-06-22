-- Fix coach login issues by ensuring user_id is properly set and persistent

-- 1. Create function to check if a coach already has an auth user
CREATE OR REPLACE FUNCTION check_coach_auth_user(coach_phone TEXT)
RETURNS TABLE (
  coach_id UUID,
  auth_user_id UUID,
  needs_linking BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS coach_id,
    u.id AS auth_user_id,
    (c.user_id IS NULL AND u.id IS NOT NULL) AS needs_linking
  FROM coaches c
  LEFT JOIN auth.users u ON u.phone = c.phone_number
  WHERE c.phone_number = coach_phone;
END;
$$;

-- 2. Create function to link coach to existing auth user
CREATE OR REPLACE FUNCTION link_coach_to_auth_user(coach_id UUID, auth_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  success BOOLEAN;
BEGIN
  UPDATE coaches
  SET user_id = auth_user_id
  WHERE id = coach_id
  AND (user_id IS NULL OR user_id != auth_user_id);
  
  GET DIAGNOSTICS success = ROW_COUNT;
  RETURN success > 0;
END;
$$;

-- 3. Reset user_id for coaches where it might be incorrectly set
-- This helps fix cases where the coach record has a user_id that doesn't match their phone number
DO $$
DECLARE
  mismatch_count INTEGER := 0;
BEGIN
  WITH mismatched_coaches AS (
    SELECT c.id, c.phone_number, c.user_id, u.phone
    FROM coaches c
    JOIN auth.users u ON c.user_id = u.id
    WHERE c.phone_number != u.phone
  )
  UPDATE coaches c
  SET user_id = NULL
  FROM mismatched_coaches m
  WHERE c.id = m.id;
  
  GET DIAGNOSTICS mismatch_count = ROW_COUNT;
  RAISE NOTICE 'Reset user_id for % coaches with mismatched phone numbers', mismatch_count;
END $$; 