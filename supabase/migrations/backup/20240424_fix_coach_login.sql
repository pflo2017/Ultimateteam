-- Add policy for anonymous coach verification
CREATE POLICY "Allow anonymous coach verification"
    ON public.coaches FOR SELECT
    TO anon
    USING (true);

-- Add policy for the stored procedure
CREATE POLICY "Allow verify_coach_access execution"
    ON public.coaches FOR SELECT
    TO anon
    USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION public.verify_coach_access TO anon;
GRANT SELECT ON public.coaches TO anon; 