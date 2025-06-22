-- Create a view to easily access club location data
CREATE OR REPLACE VIEW club_details AS
SELECT 
  c.id,
  c.name,
  c.city,
  c.country,
  c.description,
  c.email,
  c.phone_number,
  c.logo_url,
  c.is_suspended,
  c.admin_id,
  c.created_at,
  ap.name AS admin_name,
  ap.email AS admin_email
FROM 
  clubs c
LEFT JOIN
  admin_profiles ap ON c.admin_id = ap.user_id;

-- Create a function to get club details by ID
CREATE OR REPLACE FUNCTION get_club_details(club_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  city TEXT,
  country TEXT,
  description TEXT,
  email TEXT,
  phone_number TEXT,
  logo_url TEXT,
  is_suspended BOOLEAN,
  admin_id UUID,
  created_at TIMESTAMPTZ,
  admin_name TEXT,
  admin_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.city,
    c.country,
    c.description,
    c.email,
    c.phone_number,
    c.logo_url,
    c.is_suspended,
    c.admin_id,
    c.created_at,
    ap.name AS admin_name,
    ap.email AS admin_email
  FROM 
    clubs c
  LEFT JOIN
    admin_profiles ap ON c.admin_id = ap.user_id
  WHERE 
    c.id = club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 