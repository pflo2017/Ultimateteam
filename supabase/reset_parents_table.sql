-- Start fresh
DROP POLICY IF EXISTS "Parents can view own data" ON public.parents;
DROP POLICY IF EXISTS "Parents can update own data" ON public.parents;
DROP POLICY IF EXISTS "Anyone can create parent account" ON public.parents;
DROP POLICY IF EXISTS "Admins can view all parents" ON public.parents;
DROP POLICY IF EXISTS "Admins can update parents" ON public.parents;
DROP POLICY IF EXISTS "Allow parent registration" ON public.parents;
DROP POLICY IF EXISTS "Allow parents to view own data" ON public.parents;

-- Disable and re-enable RLS
ALTER TABLE public.parents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Reset permissions
REVOKE ALL ON public.parents FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant base permissions
GRANT INSERT, SELECT ON public.parents TO anon;
GRANT ALL ON public.parents TO authenticated;

-- Create the essential policies
CREATE POLICY "Anyone can create parent account"
ON public.parents
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Parents can view own data"
ON public.parents
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Parents can update own data"
ON public.parents
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can verify parents"
ON public.parents
FOR SELECT
TO anon
USING (true);

-- Verify the changes
NOTIFY pgrst, 'reload config'; 