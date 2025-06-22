-- Create a function to directly retrieve admin details for a club
-- This joins auth.users and admin_profiles to get the most accurate data
CREATE OR REPLACE FUNCTION get_club_admin_details(club_id_param UUID)
RETURNS TABLE (
  club_id UUID,
  admin_id UUID,
  admin_email TEXT,
  admin_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS club_id,
    c.admin_id,
    COALESCE(ap.admin_email, u.email) AS admin_email, -- First try admin_profiles, then auth.users
    COALESCE(ap.admin_name, u.raw_user_meta_data->>'name', 'Unknown') AS admin_name
  FROM 
    public.clubs c
  JOIN 
    auth.users u ON c.admin_id = u.id
  LEFT JOIN 
    public.admin_profiles ap ON c.admin_id = ap.user_id
  WHERE 
    c.id = club_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function for authenticated users
GRANT EXECUTE ON FUNCTION get_club_admin_details TO authenticated;

-- Test the function with AS Titan
SELECT * FROM get_club_admin_details(
  (SELECT id FROM clubs WHERE name = 'AS Titan')
); 