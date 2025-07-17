-- Fix Payment Status Inconsistency
-- This script ensures all players have payment records for all months up to the current month
-- This will resolve the inconsistency between player cards, payment history, and admin dashboard

-- Step 1: Create a function to ensure all players have payment records for all months up to current month
CREATE OR REPLACE FUNCTION ensure_complete_payment_records()
RETURNS void AS $$
DECLARE
    current_year INTEGER;
    current_month INTEGER;
    player_record RECORD;
    month_record RECORD;
    existing_record RECORD;
BEGIN
    -- Get current year and month
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    current_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
    
    RAISE NOTICE 'Ensuring payment records for year: %, month: %', current_year, current_month;
    
    -- Loop through all active players
    FOR player_record IN 
        SELECT id, name, payment_status, last_payment_date 
        FROM players 
        WHERE is_active = true
    LOOP
        RAISE NOTICE 'Processing player: % (ID: %)', player_record.name, player_record.id;
        
        -- For each month from 1 to current month
        FOR month_record IN 
            SELECT generate_series(1, current_month) as month
        LOOP
            -- Check if a record exists for this player and month
            SELECT * INTO existing_record 
            FROM monthly_payments 
            WHERE player_id = player_record.id 
              AND year = current_year 
              AND month = month_record.month;
            
            -- If no record exists, create one based on player's current status
            IF NOT FOUND THEN
                RAISE NOTICE 'Creating missing record for player % (ID: %) for %-%', 
                    player_record.name, player_record.id, current_year, month_record.month;
                
                INSERT INTO monthly_payments (
                    player_id, 
                    year, 
                    month, 
                    status, 
                    updated_at
                ) VALUES (
                    player_record.id,
                    current_year,
                    month_record.month,
                    CASE 
                        WHEN player_record.payment_status = 'paid' THEN 'paid'
                        ELSE 'unpaid'
                    END,
                    COALESCE(player_record.last_payment_date, CURRENT_TIMESTAMP)
                );
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Payment records synchronization completed';
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to get consistent payment status for a player
CREATE OR REPLACE FUNCTION get_player_current_payment_status(p_player_id UUID)
RETURNS TABLE (
    current_status TEXT,
    last_paid_date TIMESTAMPTZ,
    last_paid_month INTEGER,
    last_paid_year INTEGER
) AS $$
DECLARE
    current_year INTEGER;
    current_month INTEGER;
    last_paid_record RECORD;
BEGIN
    -- Get current year and month
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    current_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
    
    -- Get current month status
    SELECT status INTO current_status
    FROM monthly_payments
    WHERE player_id = p_player_id 
      AND year = current_year 
      AND month = current_month;
    
    -- If no current month record, default to unpaid
    IF NOT FOUND THEN
        current_status := 'unpaid';
    END IF;
    
    -- Get last paid record
    SELECT year, month, updated_at INTO last_paid_record
    FROM monthly_payments
    WHERE player_id = p_player_id 
      AND status = 'paid'
    ORDER BY year DESC, month DESC
    LIMIT 1;
    
    -- Return results
    RETURN QUERY SELECT 
        current_status,
        last_paid_record.updated_at,
        last_paid_record.month,
        last_paid_record.year;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to get complete payment history for a player
CREATE OR REPLACE FUNCTION get_player_complete_payment_history(p_player_id UUID, p_year INTEGER DEFAULT NULL)
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    status TEXT,
    updated_at TIMESTAMPTZ,
    payment_method TEXT
) AS $$
DECLARE
    target_year INTEGER;
    current_month INTEGER;
    month_record RECORD;
    existing_record RECORD;
BEGIN
    -- Use provided year or current year
    target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
    current_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
    
    -- Only process up to current month if it's the current year
    IF target_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer THEN
        current_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
    ELSE
        current_month := 12; -- For past years, include all months
    END IF;
    
    -- For each month, ensure we have a record
    FOR month_record IN 
        SELECT generate_series(1, current_month) as month
    LOOP
        -- Check if record exists
        SELECT * INTO existing_record 
        FROM monthly_payments 
        WHERE player_id = p_player_id 
          AND year = target_year 
          AND month = month_record.month;
        
        -- Return the record (either existing or virtual)
        IF FOUND THEN
            RETURN QUERY SELECT 
                existing_record.year,
                existing_record.month,
                existing_record.status,
                existing_record.updated_at,
                existing_record.payment_method;
        ELSE
            -- Return virtual record for missing month
            RETURN QUERY SELECT 
                target_year,
                month_record.month,
                'unpaid'::TEXT,
                NULL::TIMESTAMPTZ,
                NULL::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Run the synchronization
SELECT ensure_complete_payment_records();

-- Step 5: Verify the fix by checking Andrei Anton's records
SELECT 
    p.name,
    mp.year,
    mp.month,
    mp.status,
    mp.updated_at,
    mp.payment_method
FROM players p
JOIN monthly_payments mp ON p.id = mp.player_id
WHERE p.name ILIKE '%Andrei Anton%' 
   OR p.name ILIKE '%Anton Andrei%'
ORDER BY mp.year DESC, mp.month DESC;

-- Step 6: Check for any remaining inconsistencies
SELECT 
    p.id,
    p.name,
    p.payment_status as player_table_status,
    mp.status as monthly_payment_status,
    mp.year,
    mp.month
FROM players p
LEFT JOIN monthly_payments mp ON p.id = mp.player_id 
    AND mp.year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND mp.month = EXTRACT(MONTH FROM CURRENT_DATE)
WHERE p.is_active = true
  AND (mp.status IS NULL OR p.payment_status != mp.status)
ORDER BY p.name; 