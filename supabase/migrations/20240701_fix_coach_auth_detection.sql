-- Migration to fix coach authentication detection
-- This fixes issues where coaches with user_id set were still being prompted to register

-- 1. Drop and recreate the check_auth_phone_exists function with improved logic
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
  
  -- First check if there's a coach with this phone number that has a user_id
  SELECT EXISTS(
    SELECT 1 FROM coaches
    WHERE (phone_number = normalized_phone OR phone_number = phone_param)
    AND user_id IS NOT NULL
  ) INTO user_exists;
  
  -- If not found in coaches, check auth.users directly
  IF NOT user_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM auth.users
      WHERE phone = normalized_phone
         OR phone = phone_param
    ) INTO user_exists;
  END IF;
  
  RETURN user_exists;
END;
$$;

-- 2. Drop and recreate the get_auth_user_by_phone function with improved logic
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
  
  -- First check if there's a coach with this phone number that has a user_id
  SELECT user_id INTO user_id
  FROM coaches
  WHERE (phone_number = normalized_phone OR phone_number = phone_param)
  AND user_id IS NOT NULL
  LIMIT 1;
  
  -- If not found in coaches, check auth.users directly
  IF user_id IS NULL THEN
    SELECT id INTO user_id
    FROM auth.users
    WHERE phone = normalized_phone
       OR phone = phone_param
    LIMIT 1;
  END IF;
  
  RETURN user_id;
END;
$$;

-- 3. Create a function to sync coaches with auth users
CREATE OR REPLACE FUNCTION public.sync_coaches_with_auth()
RETURNS TABLE(
  coach_id UUID,
  coach_name TEXT,
  coach_phone TEXT,
  auth_user_id UUID,
  action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coach_rec RECORD;
  auth_user_id_var UUID;
  user_exists BOOLEAN;
BEGIN
  -- First pass: Fix coaches with missing user_id
  FOR coach_rec IN 
    SELECT id, name, phone_number, user_id
    FROM coaches
    WHERE phone_number IS NOT NULL
  LOOP
    -- Skip coaches that already have a correct user_id
    IF coach_rec.user_id IS NOT NULL THEN
      -- Verify the user_id exists in auth.users
      SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = coach_rec.user_id) INTO user_exists;
      
      IF user_exists THEN
        -- User ID is valid, no action needed
        coach_id := coach_rec.id;
        coach_name := coach_rec.name;
        coach_phone := coach_rec.phone_number;
        auth_user_id := coach_rec.user_id;
        action := 'VERIFIED';
        RETURN NEXT;
        CONTINUE;
      END IF;
    END IF;
    
    -- Try to find matching auth user by phone
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
      
      coach_id := coach_rec.id;
      coach_name := coach_rec.name;
      coach_phone := coach_rec.phone_number;
      auth_user_id := auth_user_id_var;
      action := 'LINKED';
      RETURN NEXT;
    ELSE
      coach_id := coach_rec.id;
      coach_name := coach_rec.name;
      coach_phone := coach_rec.phone_number;
      auth_user_id := NULL;
      action := 'NO_AUTH_USER';
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error syncing coaches with auth: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_auth_phone_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_phone_exists(TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.get_auth_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_phone(TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.sync_coaches_with_auth() TO service_role;

-- Run the sync function to fix existing coaches
DO $$
BEGIN
  PERFORM sync_coaches_with_auth();
END $$; 