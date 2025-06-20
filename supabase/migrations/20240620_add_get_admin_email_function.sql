-- Create a function to get admin email securely
CREATE OR REPLACE FUNCTION get_admin_email(admin_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_email TEXT;
BEGIN
  -- First try to get email from admin_profiles
  SELECT ap.email INTO admin_email
  FROM admin_profiles ap
  WHERE ap.user_id = admin_user_id;
  
  -- If not found in admin_profiles, try auth.users
  IF admin_email IS NULL THEN
    SELECT email INTO admin_email
    FROM auth.users
    WHERE id = admin_user_id;
  END IF;
  
  RETURN admin_email;
END;
$$;

-- Grant access to the function for authenticated users
GRANT EXECUTE ON FUNCTION get_admin_email TO authenticated;

-- Update admin_profiles for AS Titan specifically if needed
UPDATE admin_profiles
SET email = 'prec.florin@gmail.com'
WHERE user_id IN (
  SELECT admin_id FROM clubs WHERE name = 'AS Titan' OR name = 'Acsc Titan'
);

-- Add comment explaining function
COMMENT ON FUNCTION get_admin_email IS 'Securely retrieve admin email from admin_profiles or auth.users table'; 