-- Create a view to access auth.users data safely
CREATE OR REPLACE VIEW auth_user_details WITH (security_invoker = true) AS
SELECT 
  id,
  email,
  last_sign_in_at,
  created_at,
  updated_at,
  confirmed_at
FROM auth.users;

-- Grant SELECT access to authenticated users
GRANT SELECT ON auth_user_details TO authenticated;

-- Add policy to only allow master admins to view all users
CREATE POLICY "Master admins can view all users" 
  ON auth_user_details FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM master_admins 
    WHERE user_id = auth.uid()
  ));

-- Users can view their own details
CREATE POLICY "Users can view their own details" 
  ON auth_user_details FOR SELECT 
  USING (id = auth.uid());

COMMENT ON VIEW auth_user_details IS 'Safe view of auth.users data for application use'; 