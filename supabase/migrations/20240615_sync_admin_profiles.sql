-- Create admin_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a unique index on user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS admin_profiles_user_id_idx ON admin_profiles(user_id);

-- Sync admin_profiles with auth.users data
-- This will create profiles for any admin that doesn't have one
-- and update existing profiles with the latest data from auth.users
INSERT INTO admin_profiles (user_id, name, email)
SELECT 
  c.admin_id, 
  COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = c.admin_id), 'Unknown'),
  (SELECT email FROM auth.users WHERE id = c.admin_id)
FROM 
  clubs c
WHERE 
  NOT EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = c.admin_id)
ON CONFLICT (user_id) DO NOTHING;

-- Update admin_profiles with missing information
UPDATE admin_profiles ap
SET 
  name = COALESCE(ap.name, (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = ap.user_id), 'Unknown'),
  email = COALESCE(ap.email, (SELECT email FROM auth.users WHERE id = ap.user_id)),
  updated_at = now()
WHERE 
  ap.name IS NULL OR ap.email IS NULL; 