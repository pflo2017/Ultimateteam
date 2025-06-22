-- SQL script to clean up redundant columns in the players table

-- First, create a backup of the players table
CREATE TABLE players_backup AS SELECT * FROM players;

-- Analyze which columns to keep and which to remove
COMMENT ON TABLE players_backup IS 'Backup of players table before cleanup';

-- Step 1: Identify columns to keep based on current usage
-- Required columns:
-- id, created_at, updated_at, name, team_id, admin_id, is_active, club_id, parent_id, 
-- birth_date, payment_status (text - primary payment status field), 
-- last_payment_date, medical_visa_status, medical_visa_issue_date, profile_picture_url

-- Step 2: Identify redundant columns that can be removed:
-- player_status (ENUM - redundant with payment_status)
-- medical_visa_date (redundant with medical_visa_issue_date)
-- medical_visa_valid (redundant with medical_visa_status)
-- parent_child_id (we have direct link via player_id in parent_children)
-- cash_collected (redundant with payment_status='paid')
-- collected_date (redundant with last_payment_date)
-- collected_by_coach_id (not needed if tracking in monthly_payments)
-- status_changed_by (not used in app code)

-- Step 3: Create a migration to remove redundant columns
ALTER TABLE players 
DROP COLUMN IF EXISTS player_status,
DROP COLUMN IF EXISTS medical_visa_date,
DROP COLUMN IF EXISTS medical_visa_valid,
DROP COLUMN IF EXISTS parent_child_id,
DROP COLUMN IF EXISTS cash_collected,
DROP COLUMN IF EXISTS collected_date,
DROP COLUMN IF EXISTS collected_by_coach_id,
DROP COLUMN IF EXISTS status_changed_by;

-- Step 4: First check the valid values for the payment_status_enum and payment_status_type
DO $$
DECLARE
    enum_values text[];
    type_values text[];
BEGIN
    -- Get the enum values for payment_status_enum
    SELECT array_agg(e.enumlabel) INTO enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status_enum';
    
    -- Log the values
    RAISE NOTICE 'Valid payment_status_enum values: %', enum_values;
    
    -- Get the enum values for payment_status_type if it exists
    BEGIN
        SELECT array_agg(e.enumlabel) INTO type_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'payment_status_type';
        
        -- Log the values
        RAISE NOTICE 'Valid payment_status_type values: %', type_values;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'payment_status_type is not an enum type or does not exist';
    END;
END $$;

-- Step 5: Ensure payment_status has valid values before removing player_status
UPDATE players
SET payment_status = 
  CASE 
    WHEN player_status = 'paid' THEN 'paid'
    WHEN player_status = 'unpaid' THEN 'not_paid'
    WHEN player_status = 'on_trial' THEN 'on_trial'
    WHEN player_status = 'trial_ended' THEN 'trial_ended'
    WHEN player_status = 'select_status' THEN 'not_paid'
    ELSE payment_status
  END
WHERE player_status IS NOT NULL;

-- Step 6: Create a view that provides all the legacy columns for backward compatibility
CREATE OR REPLACE VIEW players_with_legacy_columns AS
SELECT 
  p.*,
  p.medical_visa_issue_date AS medical_visa_date,
  CASE WHEN p.medical_visa_status = 'valid' THEN true ELSE false END AS medical_visa_valid,
  NULL::uuid AS parent_child_id,
  CASE WHEN p.payment_status = 'paid' THEN true ELSE false END AS cash_collected,
  p.last_payment_date AS collected_date,
  NULL::uuid AS collected_by_coach_id,
  'system'::text AS status_changed_by,
  CASE 
    WHEN p.payment_status = 'paid' THEN 'paid'::payment_status_enum
    WHEN p.payment_status = 'not_paid' THEN 'unpaid'::payment_status_enum
    WHEN p.payment_status = 'on_trial' THEN 'on_trial'::payment_status_enum
    WHEN p.payment_status = 'trial_ended' THEN 'trial_ended'::payment_status_enum
    ELSE 'unpaid'::payment_status_enum
  END AS player_status
FROM 
  players p;

-- Grant permissions on the view
GRANT SELECT ON players_with_legacy_columns TO authenticated;
GRANT SELECT ON players_with_legacy_columns TO anon;

-- Step 7: Create a function to update the view (for any code that tries to update the removed columns)
CREATE OR REPLACE FUNCTION update_players_with_legacy_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle medical_visa_date updates
  IF NEW.medical_visa_date IS NOT NULL THEN
    UPDATE players SET medical_visa_issue_date = NEW.medical_visa_date WHERE id = NEW.id;
  END IF;
  
  -- Handle medical_visa_valid updates
  IF NEW.medical_visa_valid IS NOT NULL THEN
    UPDATE players SET 
      medical_visa_status = CASE WHEN NEW.medical_visa_valid THEN 'valid' ELSE 'expired' END
    WHERE id = NEW.id;
  END IF;
  
  -- Handle cash_collected updates
  IF NEW.cash_collected IS NOT NULL THEN
    UPDATE players SET 
      payment_status = CASE WHEN NEW.cash_collected THEN 'paid' ELSE 'not_paid' END
    WHERE id = NEW.id;
  END IF;
  
  -- Handle collected_date updates
  IF NEW.collected_date IS NOT NULL THEN
    UPDATE players SET last_payment_date = NEW.collected_date WHERE id = NEW.id;
  END IF;
  
  -- Handle player_status updates
  IF NEW.player_status IS NOT NULL THEN
    UPDATE players SET 
      payment_status = CASE 
        WHEN NEW.player_status = 'paid' THEN 'paid'
        WHEN NEW.player_status = 'unpaid' THEN 'not_paid'
        WHEN NEW.player_status = 'on_trial' THEN 'on_trial'
        WHEN NEW.player_status = 'trial_ended' THEN 'trial_ended'
        ELSE 'not_paid'
      END
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the view
CREATE TRIGGER update_players_with_legacy_columns_trigger
INSTEAD OF UPDATE ON players_with_legacy_columns
FOR EACH ROW
EXECUTE FUNCTION update_players_with_legacy_columns();

-- Step 8: Update the monthly_payments table to ensure it's synchronized with payment_status
-- This ensures that the monthly_payments table (source of truth for payments) is up to date
WITH current_month AS (
  SELECT 
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as year,
    EXTRACT(MONTH FROM CURRENT_DATE)::integer as month
)
INSERT INTO monthly_payments (player_id, year, month, status, updated_at)
SELECT 
  id, 
  (SELECT year FROM current_month), 
  (SELECT month FROM current_month),
  CASE 
    WHEN payment_status = 'paid' THEN 'paid'::payment_status_type
    ELSE 'not_paid'::payment_status_type
  END,
  COALESCE(last_payment_date, now())
FROM players
WHERE is_active = true
ON CONFLICT (player_id, year, month) 
DO UPDATE SET 
  status = CASE 
    WHEN EXCLUDED.status = 'paid'::payment_status_type THEN 'paid'::payment_status_type
    ELSE monthly_payments.status
  END,
  updated_at = GREATEST(monthly_payments.updated_at, EXCLUDED.updated_at);

-- Add a comment explaining the cleanup
COMMENT ON TABLE players IS 'Player records with cleaned up columns. Some legacy columns have been removed and are available through the players_with_legacy_columns view.'; 