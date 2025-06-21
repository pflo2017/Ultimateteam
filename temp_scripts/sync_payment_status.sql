-- SQL script to synchronize payment statuses between monthly_payments and players tables
-- This ensures consistency across the application by making monthly_payments the source of truth

-- First, create a backup of the players table in case we need to roll back
CREATE TABLE IF NOT EXISTS players_payment_backup AS 
SELECT id, payment_status, last_payment_date FROM players;

-- Step 1: Update all players.payment_status to match their current month's status in monthly_payments
WITH current_month AS (
  SELECT 
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as year,
    EXTRACT(MONTH FROM CURRENT_DATE)::integer as month
),
current_payments AS (
  SELECT 
    mp.player_id,
    mp.status,
    mp.updated_at
  FROM 
    monthly_payments mp
  JOIN
    current_month cm ON mp.year = cm.year AND mp.month = cm.month
)
UPDATE players p
SET 
  payment_status = cp.status,
  last_payment_date = CASE WHEN cp.status = 'paid' THEN cp.updated_at ELSE p.last_payment_date END
FROM 
  current_payments cp
WHERE 
  p.id = cp.player_id;

-- Step 2: Create a function to handle payment status updates
CREATE OR REPLACE FUNCTION sync_player_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment status is updated in monthly_payments, update the corresponding player record
  UPDATE players
  SET 
    payment_status = NEW.status,
    last_payment_date = CASE WHEN NEW.status = 'paid' THEN NEW.updated_at ELSE players.last_payment_date END
  WHERE 
    id = NEW.player_id;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a trigger to call the function whenever a payment status is updated
DROP TRIGGER IF EXISTS sync_payment_status_trigger ON monthly_payments;
CREATE TRIGGER sync_payment_status_trigger
AFTER INSERT OR UPDATE OF status ON monthly_payments
FOR EACH ROW
EXECUTE FUNCTION sync_player_payment_status();

-- Step 4: Create a function to handle player payment status updates (reverse direction)
CREATE OR REPLACE FUNCTION sync_monthly_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
BEGIN
  -- Get current month and year
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  current_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
  
  -- When a player's payment status is updated directly, update the corresponding monthly_payments record
  INSERT INTO monthly_payments (player_id, year, month, status, updated_at)
  VALUES (
    NEW.id, 
    current_year, 
    current_month, 
    NEW.payment_status,
    COALESCE(NEW.last_payment_date, now())
  )
  ON CONFLICT (player_id, year, month) 
  DO UPDATE SET 
    status = NEW.payment_status,
    updated_at = GREATEST(monthly_payments.updated_at, COALESCE(NEW.last_payment_date, now()));
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a trigger to call the function whenever a player's payment status is updated
DROP TRIGGER IF EXISTS sync_monthly_payment_trigger ON players;
CREATE TRIGGER sync_monthly_payment_trigger
AFTER UPDATE OF payment_status ON players
FOR EACH ROW
EXECUTE FUNCTION sync_monthly_payment_status();

-- Step 6: Add documentation comments
COMMENT ON FUNCTION sync_player_payment_status IS 'Syncs payment status from monthly_payments to players table';
COMMENT ON FUNCTION sync_monthly_payment_status IS 'Syncs payment status from players to monthly_payments table';
COMMENT ON TRIGGER sync_payment_status_trigger ON monthly_payments IS 'Keeps players.payment_status in sync with monthly_payments';
COMMENT ON TRIGGER sync_monthly_payment_trigger ON players IS 'Keeps monthly_payments in sync with players.payment_status';

-- Step 7: Log the completion of the synchronization
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM players_payment_backup 
  WHERE payment_status IS DISTINCT FROM (
    SELECT payment_status FROM players WHERE id = players_payment_backup.id
  );
  
  RAISE NOTICE 'Payment status synchronization complete. % player records were updated.', updated_count;
END $$; 