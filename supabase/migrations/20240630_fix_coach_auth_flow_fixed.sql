-- Migration to fix coach authentication flow issues
-- This migration adds reliable functions and triggers to ensure coach user_id is properly set

-- 1. Create a function to update coach user_id by phone number
CREATE OR REPLACE FUNCTION public.link_coach_by_phone(
  phone_param TEXT,
  user_id_param UUID,
  email_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coach_id UUID;
  updated_rows INTEGER;
BEGIN
  -- Find the coach with the matching phone number (try different formats)
  SELECT id INTO coach_id 
  FROM coaches 
  WHERE phone_number = phone_param 
     OR phone_number = REPLACE(phone_param, ' ', '')
     OR REPLACE(phone_number, ' ', '') = phone_param
     OR REPLACE(phone_number, '+0', '+4') = phone_param
     OR phone_number = REPLACE(phone_param, '+0', '+4');
  
  -- If we found a coach, update their user_id
  IF coach_id IS NOT NULL THEN
    UPDATE coaches 
    SET 
      user_id = user_id_param,
      email = COALESCE(email_param, email)
    WHERE id = coach_id;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- Return true if we updated a row, false otherwise
    RETURN updated_rows > 0;
  ELSE
    -- No coach found with this phone number
    RETURN FALSE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error linking coach by phone: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 2. Create a function to update coach user_id by coach ID
CREATE OR REPLACE FUNCTION public.link_coach_by_id(
  coach_id_param UUID,
  user_id_param UUID,
  email_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  -- Update the coach record directly
  UPDATE coaches
  SET 
    user_id = user_id_param,
    email = COALESCE(email_param, email)
  WHERE id = coach_id_param;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  -- Return true if we updated a row, false otherwise
  RETURN updated_rows > 0;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error linking coach by ID: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 3. Create a function to check if a phone number exists in auth
CREATE OR REPLACE FUNCTION public.check_auth_phone_exists(
  phone_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists BOOLEAN;
  normalized_phone TEXT;
BEGIN
  -- Normalize the phone number to ensure consistent format
  IF phone_param IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Remove any spaces
  normalized_phone := REPLACE(phone_param, ' ', '');
  
  -- Fix common format issues (+0 -> +4)
  IF normalized_phone LIKE '+0%' THEN
    normalized_phone := '+4' || SUBSTRING(normalized_phone FROM 3);
  END IF;
  
  -- Check if phone exists in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE phone = normalized_phone
       OR phone = phone_param
  ) INTO user_exists;
  
  -- If not found directly, check if a coach with this phone has a user_id
  IF NOT user_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM coaches
      WHERE (phone_number = normalized_phone OR phone_number = phone_param)
      AND user_id IS NOT NULL
    ) INTO user_exists;
  END IF;
  
  RETURN user_exists;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error checking auth phone: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 4. Create a function to get auth user ID by phone
CREATE OR REPLACE FUNCTION public.get_auth_user_by_phone(
  phone_param TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  normalized_phone TEXT;
BEGIN
  -- Normalize phone number
  normalized_phone := REPLACE(phone_param, ' ', '');
  
  -- Fix common format issues
  IF normalized_phone LIKE '+0%' THEN
    normalized_phone := '+4' || SUBSTRING(normalized_phone FROM 3);
  END IF;
  
  -- Try to find user with this phone
  SELECT id INTO user_id
  FROM auth.users
  WHERE phone = normalized_phone
     OR phone = phone_param
  LIMIT 1;
  
  -- If not found directly, check if a coach with this phone has a user_id
  IF user_id IS NULL THEN
    SELECT user_id INTO user_id
    FROM coaches
    WHERE (phone_number = normalized_phone OR phone_number = phone_param)
    AND user_id IS NOT NULL
    LIMIT 1;
  END IF;
  
  RETURN user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error getting auth user by phone: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- 5. Create a function to fix all coaches with missing user_id
CREATE OR REPLACE FUNCTION public.fix_coach_user_ids()
RETURNS TABLE(
  coach_id UUID,
  coach_name TEXT,
  coach_phone TEXT,
  auth_user_id UUID,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coach_rec RECORD;
  auth_user_id_var UUID;
  success_var BOOLEAN;
BEGIN
  FOR coach_rec IN 
    SELECT id, name, phone_number
    FROM coaches
    WHERE user_id IS NULL
    AND phone_number IS NOT NULL
  LOOP
    -- Try to find matching auth user
    SELECT id INTO auth_user_id_var
    FROM auth.users
    WHERE phone = coach_rec.phone_number
       OR phone = REPLACE(coach_rec.phone_number, ' ', '')
       OR phone = REPLACE(coach_rec.phone_number, '+0', '+4')
    LIMIT 1;
    
    IF auth_user_id_var IS NOT NULL THEN
      -- Update coach with auth user ID
      UPDATE coaches
      SET user_id = auth_user_id_var
      WHERE id = coach_rec.id;
      
      success_var := TRUE;
    ELSE
      success_var := FALSE;
    END IF;
    
    coach_id := coach_rec.id;
    coach_name := coach_rec.name;
    coach_phone := coach_rec.phone_number;
    auth_user_id := auth_user_id_var;
    success := success_var;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fixing coach user IDs: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.link_coach_by_phone(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_coach_by_phone(TEXT, UUID, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.link_coach_by_id(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_coach_by_id(UUID, UUID, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.check_auth_phone_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_phone_exists(TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.get_auth_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_phone(TEXT) TO anon;

-- Fix existing coaches with missing user_id
DO $$
BEGIN
  PERFORM fix_coach_user_ids();
END $$; 