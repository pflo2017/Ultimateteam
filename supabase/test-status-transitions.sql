-- This script helps test the payment status transition logic
-- Run this in Supabase SQL Editor

-- 1. Set a player to 'on_trial' status with a trial_start_date 30 days ago
UPDATE public.players
SET payment_status = 'on_trial',
    trial_start_date = TIMEZONE('utc', NOW() - INTERVAL '30 days'),
    status_changed_by = 'test_script'
WHERE id = 'replace-with-player-id-to-test';
-- After running the status transition function, this should change to 'trial_ended'

-- 2. Set a player to 'pending' status
UPDATE public.players
SET payment_status = 'pending',
    status_changed_by = 'test_script'
WHERE id = 'replace-with-another-player-id';
-- This should change to 'unpaid' on the 1st of the next month

-- 3. Run the status transition function manually to test
SELECT run_status_transitions();

-- 4. Verify the changes
SELECT id, name, payment_status, trial_start_date, status_last_updated, status_changed_by
FROM public.players
WHERE id IN ('replace-with-player-id-to-test', 'replace-with-another-player-id');

-- 5. Check the status history
SELECT * FROM player_status_history
WHERE player_id IN ('replace-with-player-id-to-test', 'replace-with-another-player-id')
ORDER BY changed_at DESC;

-- To simulate month transition for testing:
-- First, mock the function to think it's the 1st of the month
CREATE OR REPLACE FUNCTION auto_transition_player_statuses_test()
RETURNS void AS $$
BEGIN
    -- 1. Update players with 'on_trial' status for 30+ days to 'trial_ended'
    UPDATE public.players
    SET payment_status = 'trial_ended'
    WHERE 
        payment_status = 'on_trial' 
        AND trial_start_date IS NOT NULL 
        AND (TIMEZONE('utc', NOW()) - trial_start_date) >= INTERVAL '30 days';

    -- 2. Always update 'pending' to 'unpaid' (force month-end behavior)
    UPDATE public.players
    SET payment_status = 'unpaid'
    WHERE payment_status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Run the test function to force month-end transitions
SELECT auto_transition_player_statuses_test();

-- Verify again
SELECT id, name, payment_status, trial_start_date, status_last_updated, status_changed_by
FROM public.players
WHERE id IN ('replace-with-player-id-to-test', 'replace-with-another-player-id'); 