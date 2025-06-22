-- Non-destructive fix for admin emails
-- This script only updates admin_profiles table without modifying any views

-- Update admin_profiles where email is missing
UPDATE public.admin_profiles ap
SET admin_email = u.email
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_email IS NULL OR ap.admin_email = '');

-- Update admin_name if missing
UPDATE public.admin_profiles ap
SET admin_name = COALESCE(u.raw_user_meta_data->>'name', 'Unknown Admin')
FROM auth.users u
WHERE ap.user_id = u.id
AND (ap.admin_name IS NULL OR ap.admin_name = '');

-- Only print a message with existing view columns for reference (does not modify anything)
SELECT 
  column_name
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name = 'club_details'
ORDER BY 
  ordinal_position;

-- Log the update
SELECT 'Admin emails and names synchronized with auth.users for any missing values'; 