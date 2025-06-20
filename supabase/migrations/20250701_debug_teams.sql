-- Debug teams count discrepancy
-- This script displays all active teams with their club association

SELECT 
    t.id as team_id,
    t.name as team_name,
    t.club_id,
    c.name as club_name,
    c.is_suspended as club_suspended
FROM 
    teams t
LEFT JOIN
    clubs c ON t.club_id = c.id
WHERE 
    t.is_active = true
ORDER BY
    c.name, t.name;

-- Count active teams by club
SELECT 
    c.id as club_id,
    c.name as club_name, 
    COUNT(t.id) as team_count
FROM 
    clubs c
LEFT JOIN 
    teams t ON c.id = t.club_id AND t.is_active = true
GROUP BY 
    c.id
ORDER BY 
    c.name; 