-- Check coaches table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'coaches';

-- Check a specific coach
SELECT * FROM coaches 
WHERE id = '32efbe39-15ca-417a-b340-4d7eb4324db6' 
OR access_code = '32efbe39-15ca-417a-b340-4d7eb4324db6'
OR admin_id::text = '32efbe39-15ca-417a-b340-4d7eb4324db6';

-- Check activities and teams
SELECT a.id as activity_id, a.title, a.team_id, t.coach_id, t.name as team_name
FROM activities a
JOIN teams t ON a.team_id = t.id
WHERE a.id = 'ca5b6bc8-8a3e-4d22-b6b7-1580eeb3e04c';

-- Check the relationship between teams and coaches
SELECT t.id as team_id, t.name as team_name, t.coach_id, c.id as coach_id, c.name as coach_name, c.admin_id
FROM teams t
JOIN coaches c ON t.coach_id = c.id
WHERE t.coach_id = '32efbe39-15ca-417a-b340-4d7eb4324db6' 
OR c.id = '32efbe39-15ca-417a-b340-4d7eb4324db6';

-- Verify auth.uid() matches
SELECT current_setting('request.jwt.claims', true)::json->>'sub' as auth_uid; 