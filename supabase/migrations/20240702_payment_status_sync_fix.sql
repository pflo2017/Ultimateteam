-- Payment Status Synchronization Fix
-- This migration implements a comprehensive solution for payment status tracking
-- by creating a centralized source of truth and ensuring consistency across tables

-- Step 1: Create unified payment status type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unified_payment_status') THEN
        CREATE TYPE unified_payment_status AS ENUM (
            'paid',
            'unpaid',
            'pending', 
            'on_trial',
            'trial_ended',
            'select_status'
        );
    END IF;
END $$;

-- Step 2: Create centralized payment status tables
CREATE TABLE IF NOT EXISTS player_payment_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    current_status unified_payment_status NOT NULL,
    status_since TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by TEXT,
    UNIQUE (player_id)
);

-- Create a history table to track all payment status changes
CREATE TABLE IF NOT EXISTS player_payment_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    previous_status unified_payment_status,
    new_status unified_payment_status NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by TEXT
);

-- Step 3: Create service functions for getting and updating payment status

-- Function to get a player's current payment status
CREATE OR REPLACE FUNCTION get_player_payment_status(p_player_id UUID)
RETURNS TABLE (
    status TEXT,
    status_since TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pps.current_status::TEXT,
        pps.status_since
    FROM 
        player_payment_status pps
    WHERE 
        pps.player_id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a player's payment status with syncing to all tables
CREATE OR REPLACE FUNCTION update_player_payment_status(
    p_player_id UUID,
    p_status unified_payment_status,
    p_changed_by TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_current_status unified_payment_status;
BEGIN
    -- Get current status
    SELECT current_status INTO v_current_status
    FROM player_payment_status
    WHERE player_id = p_player_id;
    
    -- Update current status
    IF v_current_status IS NULL THEN
        -- Insert new record
        INSERT INTO player_payment_status (player_id, current_status, changed_by)
        VALUES (p_player_id, p_status, p_changed_by);
    ELSE
        -- Update existing record only if status is changing
        IF v_current_status != p_status THEN
            -- Record history first
            INSERT INTO player_payment_status_history (
                player_id, previous_status, new_status, changed_by
            )
            VALUES (
                p_player_id, v_current_status, p_status, p_changed_by
            );
            
            -- Then update current status
            UPDATE player_payment_status
            SET 
                current_status = p_status,
                status_since = now(),
                changed_by = p_changed_by
            WHERE 
                player_id = p_player_id;
        END IF;
    END IF;
    
    -- Always update the players table to maintain backward compatibility
    UPDATE players
    SET 
        payment_status = p_status::TEXT,
        player_status = p_status,
        last_payment_date = CASE WHEN p_status = 'paid' THEN now() ELSE last_payment_date END,
        status_changed_by = p_changed_by
    WHERE 
        id = p_player_id;
        
    -- Update the monthly_payments table for current month
    -- Convert between unified_payment_status and payment_status_type
    WITH current_month AS (
      SELECT 
        EXTRACT(YEAR FROM CURRENT_DATE)::integer as year,
        EXTRACT(MONTH FROM CURRENT_DATE)::integer as month
    )
    INSERT INTO monthly_payments (player_id, year, month, status, updated_at, updated_by)
    VALUES (
        p_player_id, 
        (SELECT year FROM current_month), 
        (SELECT month FROM current_month),
        CASE 
            WHEN p_status = 'paid' THEN 'paid'::payment_status_type
            ELSE 'not_paid'::payment_status_type
        END,
        now(),
        p_changed_by
    )
    ON CONFLICT (player_id, year, month) 
    DO UPDATE SET 
        status = CASE 
            WHEN p_status = 'paid' THEN 'paid'::payment_status_type
            ELSE 'not_paid'::payment_status_type
        END,
        updated_at = now(),
        updated_by = p_changed_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize all players in the new system
CREATE OR REPLACE FUNCTION initialize_payment_status_system() RETURNS void AS $$
DECLARE
    player_rec RECORD;
BEGIN
    -- For each player, determine the current status from all available sources
    FOR player_rec IN SELECT id, payment_status, player_status FROM players WHERE is_active = true
    LOOP
        -- Determine the most accurate status
        DECLARE
            final_status unified_payment_status;
        BEGIN
            IF player_rec.player_status IS NOT NULL AND player_rec.player_status != 'select_status' THEN
                final_status := player_rec.player_status::unified_payment_status;
            ELSIF player_rec.payment_status IS NOT NULL AND player_rec.payment_status != 'missing' THEN
                -- Convert from text to enum
                IF player_rec.payment_status = 'paid' THEN
                    final_status := 'paid'::unified_payment_status;
                ELSE
                    final_status := 'unpaid'::unified_payment_status;
                END IF;
            ELSE
                final_status := 'unpaid'::unified_payment_status; -- Default value
            END IF;
            
            -- Initialize the player in the new system
            PERFORM update_player_payment_status(player_rec.id, final_status, 'system_migration');
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with next player
            RAISE NOTICE 'Error initializing player %: %', player_rec.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create a trigger to keep payment status synchronized
CREATE OR REPLACE FUNCTION sync_payment_status_changes() RETURNS TRIGGER AS $$
BEGIN
    -- When players.payment_status changes, update the centralized system
    IF NEW.payment_status != OLD.payment_status THEN
        -- Convert from text to enum
        DECLARE
            new_status unified_payment_status;
        BEGIN
            IF NEW.payment_status = 'paid' THEN
                new_status := 'paid'::unified_payment_status;
            ELSIF NEW.payment_status = 'not_paid' THEN
                new_status := 'unpaid'::unified_payment_status;
            ELSIF NEW.payment_status = 'unpaid' THEN
                new_status := 'unpaid'::unified_payment_status;
            ELSE
                -- Try to convert directly if possible
                BEGIN
                    new_status := NEW.payment_status::unified_payment_status;
                EXCEPTION WHEN OTHERS THEN
                    new_status := 'unpaid'::unified_payment_status;
                END;
            END IF;
            
            -- Update through the function (which will update all tables)
            PERFORM update_player_payment_status(
                NEW.id, 
                new_status, 
                COALESCE(NEW.status_changed_by, 'system_trigger')
            );
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS payment_status_sync_trigger ON players;

-- Create the trigger
CREATE TRIGGER payment_status_sync_trigger
AFTER UPDATE OF payment_status ON players
FOR EACH ROW
WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION sync_payment_status_changes();

-- Add RLS policies for the new tables
ALTER TABLE player_payment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_payment_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can access all records
CREATE POLICY admin_access_payment_status ON player_payment_status
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.admin_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM players p
                WHERE p.id = player_payment_status.player_id
                AND p.club_id = c.id
            )
        )
    );

CREATE POLICY admin_access_payment_status_history ON player_payment_status_history
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.admin_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM players p
                WHERE p.id = player_payment_status_history.player_id
                AND p.club_id = c.id
            )
        )
    );

-- Coaches can view payment status for their teams
CREATE POLICY coach_view_payment_status ON player_payment_status
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM players p
            JOIN teams t ON p.team_id = t.id
            WHERE p.id = player_payment_status.player_id
            AND t.coach_id = auth.uid()
        )
    );

CREATE POLICY coach_view_payment_status_history ON player_payment_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM players p
            JOIN teams t ON p.team_id = t.id
            WHERE p.id = player_payment_status_history.player_id
            AND t.coach_id = auth.uid()
        )
    );

-- Parents can view payment status for their children
CREATE POLICY parent_view_payment_status ON player_payment_status
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM players p
            WHERE p.id = player_payment_status.player_id
            AND p.parent_id = auth.uid()
        )
    );

CREATE POLICY parent_view_payment_status_history ON player_payment_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM players p
            WHERE p.id = player_payment_status_history.player_id
            AND p.parent_id = auth.uid()
        )
    );

-- Initialize all players to set up the system
SELECT initialize_payment_status_system(); 