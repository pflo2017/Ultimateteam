-- Clean up activities that have deleted players in their lineup_players array
-- This script will remove player IDs from lineup_players that no longer exist in the players table

-- First, let's see which activities have deleted players in their lineup
SELECT 
  a.id as activity_id,
  a.title,
  a.lineup_players,
  p.id as player_id,
  p.name as player_name
FROM activities a
CROSS JOIN LATERAL unnest(a.lineup_players) AS player_id
LEFT JOIN players p ON p.id = player_id::uuid
WHERE a.lineup_players IS NOT NULL 
  AND p.id IS NULL;

-- Now update activities to remove deleted players from lineup_players
UPDATE activities 
SET lineup_players = (
  SELECT array_agg(player_id::text)
  FROM unnest(lineup_players) AS player_id
  WHERE EXISTS (
    SELECT 1 FROM players p WHERE p.id = player_id::uuid
  )
)
WHERE lineup_players IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM unnest(lineup_players) AS player_id
    WHERE NOT EXISTS (
      SELECT 1 FROM players p WHERE p.id = player_id::uuid
    )
  ); 