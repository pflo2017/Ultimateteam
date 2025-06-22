-- Function to get club admin details including email addresses
CREATE OR REPLACE FUNCTION get_club_admin_details()
RETURNS TABLE (
  club_id UUID,
  club_name TEXT,
  admin_emails TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as club_id,
    c.name as club_name,
    COALESCE(array_agg(DISTINCT ap.admin_email) FILTER (WHERE ap.admin_email IS NOT NULL), ARRAY[]::TEXT[]) as admin_emails
  FROM 
    clubs c
  LEFT JOIN 
    admin_profiles ap ON c.id = ap.club_id
  GROUP BY 
    c.id, c.name;
END;
$$;

-- Grant access to the authenticated users
GRANT EXECUTE ON FUNCTION get_club_admin_details() TO authenticated;

-- Comment explaining the function
COMMENT ON FUNCTION get_club_admin_details() IS 'Returns club IDs with associated admin email addresses'; 