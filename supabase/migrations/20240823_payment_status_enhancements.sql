-- 1. Add timestamp tracking fields for payment status changes
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS status_last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_changed_by TEXT;

-- 2. Create a function to update the status_last_updated field automatically
CREATE OR REPLACE FUNCTION update_status_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if payment_status changed
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        NEW.status_last_updated := TIMEZONE('utc', NOW());
        
        -- If status is changing to on_trial, set trial_start_date
        IF NEW.payment_status = 'on_trial' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'on_trial') THEN
            NEW.trial_start_date := TIMEZONE('utc', NOW());
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a trigger to call the function on player updates
DROP TRIGGER IF EXISTS set_status_last_updated ON public.players;
CREATE TRIGGER set_status_last_updated
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION update_status_last_updated();

-- 4. Create a function to automatically transition statuses
CREATE OR REPLACE FUNCTION auto_transition_player_statuses()
RETURNS void AS $$
DECLARE
    current_date TIMESTAMP WITH TIME ZONE := TIMEZONE('utc', NOW());
BEGIN
    -- 1. Update players with 'on_trial' status for 30+ days to 'trial_ended'
    UPDATE public.players
    SET payment_status = 'trial_ended'
    WHERE 
        payment_status = 'on_trial' 
        AND trial_start_date IS NOT NULL 
        AND (current_date - trial_start_date) >= INTERVAL '30 days';

    -- 2. Update players with 'pending' status to 'unpaid' at the start of a new month
    -- (This will only run if it's the 1st day of the month when the function is called)
    IF EXTRACT(DAY FROM current_date) = 1 THEN
        UPDATE public.players
        SET payment_status = 'unpaid'
        WHERE payment_status = 'pending';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a function to manually run the status transitions (for testing)
CREATE OR REPLACE FUNCTION run_status_transitions()
RETURNS void AS $$
BEGIN
    PERFORM auto_transition_player_statuses();
END;
$$ LANGUAGE plpgsql;

-- 6. Create payment status history table for better auditing
CREATE TABLE IF NOT EXISTS public.player_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    changed_by TEXT -- 'admin' or 'coach' or user ID
);

-- 7. Create a trigger to log payment status changes to history
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        INSERT INTO player_status_history (
            player_id, 
            previous_status, 
            new_status, 
            changed_by
        )
        VALUES (
            NEW.id,
            OLD.payment_status,
            NEW.payment_status,
            NEW.status_changed_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_status_history_trigger ON public.players;
CREATE TRIGGER player_status_history_trigger
AFTER UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION log_status_change();

-- 8. Set permissions on the new table
ALTER TABLE public.player_status_history ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.player_status_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Create cron job to run the status transitions daily
-- This requires pg_cron extension to be enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- If pg_cron is not available, this will silently do nothing
        -- You'll need to set up an external cron job instead
        RAISE NOTICE 'pg_cron extension not available, skipping cron job creation';
    ELSE
        -- Schedule the job to run daily at midnight
        PERFORM cron.schedule(
            'daily-status-transitions',  -- job name
            '0 0 * * *',                 -- cron schedule (midnight every day)
            $$SELECT auto_transition_player_statuses()$$
        );
    END IF;
END $$; 