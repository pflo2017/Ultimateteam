-- Update admin_profiles to ensure all admins have proper data
-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure we have a row for each club admin
INSERT INTO admin_profiles (user_id, name, email)
SELECT 
  c.admin_id, 
  COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = c.admin_id), 'Unknown') as name,
  (SELECT email FROM auth.users WHERE id = c.admin_id) as email
FROM 
  clubs c
WHERE 
  NOT EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = c.admin_id)
ON CONFLICT (user_id) DO NOTHING;

-- Update admin_profiles with missing information
UPDATE admin_profiles ap
SET 
  name = COALESCE(ap.name, (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = ap.user_id), 'Unknown'),
  email = COALESCE(ap.email, (SELECT email FROM auth.users WHERE id = ap.user_id))
WHERE 
  ap.name IS NULL OR ap.email IS NULL;

-- Create or replace function to get admin profiles
CREATE OR REPLACE FUNCTION get_admin_profile(admin_id UUID)
RETURNS TABLE (
  name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.name,
    ap.email
  FROM 
    admin_profiles ap
  WHERE 
    ap.user_id = admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 