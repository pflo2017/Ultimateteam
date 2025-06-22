-- Migration to fix coach authentication linking issues
-- This ensures coaches with matching phone numbers in auth.users are properly linked

-- 1. Add email column if it doesn't exist (for completeness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coaches' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.coaches ADD COLUMN email TEXT;
    RAISE NOTICE 'Added email column to coaches table';
  END IF;
END $$;

-- 2. Create or replace the check_phone_exists function
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

-- 3. Fix phone number formats (replace +0 with +4 for Romania)
UPDATE public.coaches
SET phone_number = '+4' || SUBSTRING(phone_number, 3)
WHERE phone_number LIKE '+0%';

-- 4. Link coaches to auth users based on phone number match
WITH coach_auth_matches AS (
  SELECT 
    c.id AS coach_id,
    u.id AS auth_id,
    c.phone_number,
    u.phone
  FROM public.coaches c
  JOIN auth.users u ON u.phone = c.phone_number
  WHERE c.user_id IS NULL OR c.user_id != u.id
)
UPDATE public.coaches c
SET user_id = cam.auth_id
FROM coach_auth_matches cam
WHERE c.id = cam.coach_id;

-- 5. Update coach emails from auth user metadata
UPDATE public.coaches c
SET email = u.raw_user_meta_data->>'email'
FROM auth.users u
WHERE c.user_id = u.id
AND c.email IS NULL
AND u.raw_user_meta_data->>'email' IS NOT NULL;

-- 6. Create index on coaches.email for better performance
CREATE INDEX IF NOT EXISTS coaches_email_idx ON public.coaches(email);

-- 7. Create index on coaches.user_id for better performance
CREATE INDEX IF NOT EXISTS coaches_user_id_idx ON public.coaches(user_id);

-- 8. Create index on coaches.phone_number for better performance
CREATE INDEX IF NOT EXISTS coaches_phone_number_idx ON public.coaches(phone_number);

-- 9. Log the results of the migration
DO $$
DECLARE
  linked_count INTEGER;
  email_count INTEGER;
  phone_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO linked_count FROM public.coaches WHERE user_id IS NOT NULL;
  SELECT COUNT(*) INTO email_count FROM public.coaches WHERE email IS NOT NULL;
  SELECT COUNT(*) INTO phone_count FROM public.coaches WHERE phone_number LIKE '+4%';
  
  RAISE NOTICE 'Migration complete: % coaches linked to auth users, % coaches with email, % coaches with +4 phone format',
    linked_count, email_count, phone_count;
END $$; 