-- Migration to add registration status to coaches table
-- This helps track whether a coach has completed their registration

-- 1. Add status column to coaches table
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'pending_registration';

-- 2. Update existing coaches based on user_id
UPDATE public.coaches
SET registration_status = 'active'
WHERE user_id IS NOT NULL;

-- 3. Create an index for faster lookups
CREATE INDEX IF NOT EXISTS coaches_registration_status_idx ON public.coaches(registration_status);

-- 4. Add function to check coach registration status
CREATE OR REPLACE FUNCTION public.check_coach_registration_status(phone_param TEXT)
RETURNS TABLE(
  coach_id UUID,
  status TEXT,
  has_auth_account BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_exists BOOLEAN;
BEGIN
  -- First check if the coach exists
  RETURN QUERY
  WITH coach_data AS (
    SELECT 
      c.id,
      c.registration_status,
      EXISTS (
        SELECT 1 FROM auth.users u WHERE u.phone = c.phone_number
      ) AS has_auth
    FROM coaches c
    WHERE c.phone_number = phone_param
  )
  SELECT 
    coach_data.id,
    coach_data.registration_status,
    coach_data.has_auth
  FROM coach_data;
END;
$$;

-- 5. Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_coach_registration_status(TEXT) TO anon; 