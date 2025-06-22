-- Add email column to coaches table if it doesn't exist
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS coaches_email_idx ON public.coaches(email);

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.coaches.email IS 'Email address of the coach, used for authentication and notifications';

-- Update existing coaches with email from user metadata where possible
DO $$
BEGIN
  UPDATE public.coaches c
  SET email = u.user_metadata->>'email'
  FROM auth.users u
  WHERE c.user_id = u.id
  AND c.email IS NULL
  AND u.user_metadata->>'email' IS NOT NULL;
END $$; 