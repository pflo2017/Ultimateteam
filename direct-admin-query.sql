-- Check what admin data we have for AS Titan
SELECT 
  c.id AS club_id, 
  c.name AS club_name, 
  c.admin_id,
  c.email AS club_email,
  u.email AS admin_user_email,
  ap.admin_name,
  ap.admin_email,
  ap.user_id
FROM 
  clubs c
JOIN 
  auth.users u ON c.admin_id = u.id
LEFT JOIN 
  admin_profiles ap ON c.admin_id = ap.user_id
WHERE 
  c.name = 'AS Titan'; 