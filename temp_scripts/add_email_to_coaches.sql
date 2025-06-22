-- Add email column to coaches table if it doesn't exist
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create an index on the email column for faster lookups
CREATE INDEX IF NOT EXISTS coaches_email_idx ON public.coaches(email);

-- Explain the purpose of the change with a comment
COMMENT ON COLUMN public.coaches.email IS 'Email address of the coach. Used for communication and profile settings.';

-- Populate the email field for existing coaches based on their auth users data if possible
DO $$
BEGIN
    -- For each coach with user_id that doesn't have an email
    UPDATE public.coaches c
    SET email = u.email
    FROM auth.users u
    WHERE c.user_id = u.id 
    AND c.email IS NULL;
    
    RAISE NOTICE 'Email fields populated for coaches with auth accounts.';
END $$;

-- Check the updated structure
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'coaches' AND column_name = 'email'; 