-- Create function to set coach access code
CREATE OR REPLACE FUNCTION public.set_coach_access_code(p_access_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Set the coach access code in the session with LOCAL setting
    PERFORM set_config('app.coach_access_code', p_access_code, true);
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.set_coach_access_code(text) TO anon; 