-- This script ensures the master admin has the correct permissions

-- First, check if the master_admins table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'master_admins'
);

-- If the table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.master_admins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Check if the user exists in auth.users
SELECT id, email 
FROM auth.users
WHERE email = 'master.florinp@gmail.com';

-- Get the user ID for the master admin
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user ID
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'master.florinp@gmail.com';

    -- If user exists but not in master_admins, add them
    IF v_user_id IS NOT NULL THEN
        -- Check if user is already in master_admins
        IF NOT EXISTS (SELECT 1 FROM public.master_admins WHERE user_id = v_user_id) THEN
            -- Add user to master_admins
            INSERT INTO public.master_admins (user_id)
            VALUES (v_user_id);
        END IF;
    END IF;
END $$;

-- Disable RLS on master_admins to avoid circular references
ALTER TABLE IF EXISTS public.master_admins DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on master_admins
DROP POLICY IF EXISTS "Master admins can view their own record" ON public.master_admins;
DROP POLICY IF EXISTS "Master admins can view all master admins" ON public.master_admins;

-- List all master admins
SELECT ma.id, ma.user_id, u.email
FROM public.master_admins ma
JOIN auth.users u ON ma.user_id = u.id; 