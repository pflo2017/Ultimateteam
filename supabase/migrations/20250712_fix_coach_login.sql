-- Add email column to coaches table if it doesn't exist
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS coaches_email_idx ON public.coaches(email);

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.coaches.email IS 'Email address of the coach, used for authentication and notifications';

-- Update existing coaches with email from user metadata where possible
UPDATE public.coaches c
SET email = u.raw_user_meta_data->>'email'
FROM auth.users u
WHERE c.user_id = u.id
AND c.email IS NULL
AND u.raw_user_meta_data->>'email' IS NOT NULL;

-- Create a function to check if a phone number exists in auth
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_param TEXT)
RETURNS TABLE(exists BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE phone = phone_param
  );
END;
$$;

-- Fix mismatched coach user_ids
WITH coach_auth_matches AS (
  SELECT 
    c.id AS coach_id,
    u.id AS auth_id
  FROM public.coaches c
  JOIN auth.users u ON u.phone = c.phone_number
  WHERE c.user_id IS NULL OR c.user_id != u.id
)
UPDATE public.coaches c
SET user_id = cam.auth_id
FROM coach_auth_matches cam
WHERE c.id = cam.coach_id; 