-- Function to get auth users data including last sign-in time
CREATE OR REPLACE FUNCTION get_auth_users_data()
RETURNS TABLE (
  id UUID,
  email TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow master admins to access this data
  IF NOT EXISTS (
    SELECT 1 FROM master_admins ma 
    WHERE ma.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Only master admins can access this data';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.last_sign_in_at,
    au.created_at
  FROM 
    auth.users au;
END;
$$;

-- Grant access to the authenticated users
GRANT EXECUTE ON FUNCTION get_auth_users_data() TO authenticated;

-- Comment explaining the function
COMMENT ON FUNCTION get_auth_users_data() IS 'Returns auth users data including last sign-in time (master admin only)'; 