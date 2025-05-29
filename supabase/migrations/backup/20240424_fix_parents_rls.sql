-- First, revoke all existing permissions
REVOKE ALL ON public.parents FROM anon;
REVOKE ALL ON public.parents FROM authenticated;

-- Enable RLS on parents table
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parents can view own data" ON public.parents;
DROP POLICY IF EXISTS "Parents can update own data" ON public.parents;
DROP POLICY IF EXISTS "Anyone can create parent account" ON public.parents;

-- Create policy to allow new parent registration
CREATE POLICY "Anyone can create parent account"
ON public.parents
FOR INSERT
WITH CHECK (
    true  -- Allow any insert during registration
);

-- Create policy to allow parents to view their own data
CREATE POLICY "Parents can view own data"
ON public.parents
FOR SELECT
USING (
    auth.uid() = id
);

-- Create policy to allow parents to update their own data
CREATE POLICY "Parents can update own data"
ON public.parents
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant specific permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT INSERT ON public.parents TO anon;
GRANT SELECT ON public.parents TO anon;
GRANT ALL ON public.parents TO authenticated;

-- Verify RLS is working
NOTIFY pgrst, 'reload config'; 