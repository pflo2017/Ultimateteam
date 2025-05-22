-- Script to modify the status_changed_by column in the players table
-- to accept text values instead of UUIDs

-- Start a transaction
BEGIN;

-- First back up the current data
CREATE TABLE IF NOT EXISTS players_column_backup AS 
SELECT id, status_changed_by FROM players;

-- Modify the status_changed_by column to accept text
ALTER TABLE players 
ALTER COLUMN status_changed_by TYPE TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN players.status_changed_by IS 'Tracks who changed the payment status (admin, coach, system, etc.)';

-- Commit the transaction
COMMIT; 