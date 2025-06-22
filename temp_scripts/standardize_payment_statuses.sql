-- Payment Status Standardization Script
-- This script standardizes payment status values in the database
-- It converts legacy status values to the new standard ones

-- Start a transaction so we can roll back if anything goes wrong
BEGIN;

-- 1. Back up the players table data before modifying
CREATE TABLE IF NOT EXISTS players_backup AS
SELECT * FROM players;

-- 2. Update legacy payment status values in the players table
-- Change 'active' to 'paid'
UPDATE players
SET payment_status = 'paid',
    player_status = 'paid'
WHERE payment_status = 'active' OR player_status = 'active';

-- Change 'needs_review' to 'pending'
UPDATE players
SET payment_status = 'pending',
    player_status = 'pending'
WHERE payment_status = 'needs_review' OR player_status = 'needs_review';

-- Change 'archived' to 'unpaid'
UPDATE players
SET payment_status = 'unpaid',
    player_status = 'unpaid'
WHERE payment_status = 'archived' OR player_status = 'archived';

-- 3. Update the player_payments table with standardized status values
UPDATE player_payments
SET status = 'paid'
WHERE status = 'active';

UPDATE player_payments
SET status = 'pending'
WHERE status = 'needs_review';

UPDATE player_payments
SET status = 'unpaid'
WHERE status = 'archived';

-- 4. Update the player_status_history table
UPDATE player_status_history
SET previous_status = 'paid'
WHERE previous_status = 'active';

UPDATE player_status_history
SET previous_status = 'pending'
WHERE previous_status = 'needs_review';

UPDATE player_status_history
SET previous_status = 'unpaid'
WHERE previous_status = 'archived';

UPDATE player_status_history
SET new_status = 'paid'
WHERE new_status = 'active';

UPDATE player_status_history
SET new_status = 'pending'
WHERE new_status = 'needs_review';

UPDATE player_status_history
SET new_status = 'unpaid'
WHERE new_status = 'archived';

-- 5. Update the status constraints to only allow standard statuses
-- Drop existing constraint if it exists
ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_payment_status_check;

-- Add a constraint with the standardized status values
ALTER TABLE players
ADD CONSTRAINT players_payment_status_check 
CHECK (payment_status IN ('select_status', 'on_trial', 'trial_ended', 'pending', 'unpaid', 'paid'));

-- 6. For the player_status enum type (if it exists)
-- First, check if the type exists and get its values
DO $$
DECLARE
  type_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'payment_status_enum'
  ) INTO type_exists;
  
  IF type_exists THEN
    -- Drop any constraints using this enum
    ALTER TABLE players
    DROP CONSTRAINT IF EXISTS players_player_status_check;
    
    -- Create a new constraint using standard values
    ALTER TABLE players
    ADD CONSTRAINT players_player_status_check 
    CHECK (player_status IN ('select_status', 'on_trial', 'trial_ended', 'pending', 'unpaid', 'paid'));
  END IF;
END $$;

-- 7. Ensure the player_payments table has the correct constraint
ALTER TABLE player_payments
DROP CONSTRAINT IF EXISTS player_payments_status_check;

ALTER TABLE player_payments
ADD CONSTRAINT player_payments_status_check
CHECK (status IN ('select_status', 'on_trial', 'trial_ended', 'pending', 'unpaid', 'paid'));

-- Commit the transaction if all goes well
COMMIT; 