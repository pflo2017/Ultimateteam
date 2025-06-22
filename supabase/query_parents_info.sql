-- Query to examine parents table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_name = 'parents'
ORDER BY 
  ordinal_position;

-- Simple query to see the actual data in the parents table
SELECT * FROM parents LIMIT 5;

-- Query to examine parent_children table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_name = 'parent_children'
ORDER BY 
  ordinal_position;

-- Sample query to get parent data with their children
-- Adjusted to use the actual column names from the parents table
SELECT 
  p.id AS parent_id,
  p.user_id,
  -- Use the actual column name for parent's name (adjust as needed)
  p.name AS parent_name,
  p.email,
  p.phone,
  p.created_at AS parent_created_at,
  pl.id AS player_id,
  pl.full_name AS player_name,
  pl.team_id,
  t.name AS team_name,
  c.id AS club_id,
  c.name AS club_name
FROM 
  parents p
JOIN 
  parent_children pc ON p.id = pc.parent_id
JOIN 
  players pl ON pc.player_id = pl.id
LEFT JOIN
  teams t ON pl.team_id = t.id
LEFT JOIN
  clubs c ON t.club_id = c.id
LIMIT 10; 