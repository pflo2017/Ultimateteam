-- Migration: Add player cleanup triggers and functions
-- This migration adds database-level cleanup for deleted players

-- Function to clean up activities with deleted players
CREATE OR REPLACE FUNCTION cleanup_activities_with_deleted_players()
RETURNS void AS $$
BEGIN
    -- Update activities table: remove deleted player IDs from lineup_players arrays
    UPDATE activities 
    SET lineup_players = (
        SELECT array_agg(player_id::uuid)
        FROM unnest(lineup_players) AS player_id
        WHERE player_id IN (
            SELECT id FROM players WHERE name IS NOT NULL AND name != ''
        )
    )
    WHERE EXISTS (
        SELECT 1 FROM unnest(lineup_players) AS player_id
        WHERE player_id NOT IN (
            SELECT id FROM players WHERE name IS NOT NULL AND name != ''
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to clean up activities when a player is deleted
CREATE OR REPLACE FUNCTION handle_player_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the cleanup function
    PERFORM cleanup_activities_with_deleted_players();
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on players table
DROP TRIGGER IF EXISTS player_deletion_trigger ON players;
CREATE TRIGGER player_deletion_trigger
    AFTER DELETE ON players
    FOR EACH ROW
    EXECUTE FUNCTION handle_player_deletion();

-- Run initial cleanup
SELECT cleanup_activities_with_deleted_players(); 