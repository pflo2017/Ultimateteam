-- Migration to fix the check_phone_exists function
-- The current function is not detecting auth users correctly

-- Drop the existing function
DROP FUNCTION IF EXISTS public.check_phone_exists;

-- Create a more reliable version of the function
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_param TEXT)
RETURNS TABLE(exists BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_count INTEGER;
BEGIN
  -- Normalize the phone number to ensure consistent format
  IF phone_param IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;
  
  -- Remove any spaces
  phone_param := regexp_replace(phone_param, '\s', '', 'g');
  
  -- Ensure it has a + prefix
  IF NOT phone_param LIKE '+%' THEN
    phone_param := '+' || phone_param;
  END IF;
  
  -- Count matching phone numbers in auth.users
  SELECT COUNT(*) INTO phone_count 
  FROM auth.users 
  WHERE phone = phone_param;
  
  -- Return true if we found any matches
  RETURN QUERY SELECT phone_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO anon;

-- Test the function with a known phone number
DO $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT exists INTO result FROM public.check_phone_exists('+40700009009');
  RAISE NOTICE 'check_phone_exists(+40700009009) = %', result;
END $$; 