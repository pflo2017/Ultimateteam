-- Drop existing policies
DROP POLICY IF EXISTS "Clubs are viewable by their admin" ON public.clubs;
DROP POLICY IF EXISTS "Clubs are insertable by admin" ON public.clubs;
DROP POLICY IF EXISTS "Clubs are insertable by authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "Clubs are updatable by their admin" ON public.clubs;
DROP POLICY IF EXISTS "Clubs are deletable by their admin" ON public.clubs;

-- Create new simplified policies
CREATE POLICY "Clubs are viewable by their admin"
    ON public.clubs FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Clubs are insertable by any authenticated user"
    ON public.clubs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Clubs are updatable by their admin"
    ON public.clubs FOR UPDATE
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Clubs are deletable by their admin"
    ON public.clubs FOR DELETE
    USING (auth.uid() = admin_id);

-- Grant necessary privileges
GRANT ALL ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role; 