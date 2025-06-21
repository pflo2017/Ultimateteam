UPDATE monthly_payments SET status = 'not_paid' WHERE status IS NOT NULL AND status != 'paid' AND status != 'not_paid';
UPDATE players SET payment_status = 'not_paid' WHERE payment_status IS NOT NULL AND payment_status != 'paid' AND payment_status != 'not_paid';
UPDATE players SET player_status = NULL WHERE player_status = 'select_status';
