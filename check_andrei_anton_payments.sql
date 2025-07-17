-- Check Andrei Anton's payment records
-- This will help us understand the data inconsistency issue

-- First, find the player ID for Andrei Anton
SELECT id, name, payment_status, last_payment_date 
FROM players 
WHERE name ILIKE '%Andrei Anton%' 
   OR name ILIKE '%Anton Andrei%';

-- Then check all monthly payment records for this player
SELECT 
    mp.player_id,
    mp.year,
    mp.month,
    mp.status,
    mp.updated_at,
    mp.payment_method
FROM monthly_payments mp
JOIN players p ON mp.player_id = p.id
WHERE p.name ILIKE '%Andrei Anton%' 
   OR p.name ILIKE '%Anton Andrei%'
ORDER BY mp.year DESC, mp.month DESC;

-- Check current month (July 2025) specifically
SELECT 
    mp.player_id,
    mp.year,
    mp.month,
    mp.status,
    mp.updated_at,
    mp.payment_method,
    p.name as player_name
FROM monthly_payments mp
JOIN players p ON mp.player_id = p.id
WHERE (p.name ILIKE '%Andrei Anton%' OR p.name ILIKE '%Anton Andrei%')
  AND mp.year = 2025 
  AND mp.month = 7;

-- Check all players with payment inconsistencies
-- This will show players who have conflicting status information
SELECT 
    p.id,
    p.name,
    p.payment_status as player_table_status,
    p.last_payment_date as player_table_last_payment,
    mp.status as monthly_payment_status,
    mp.updated_at as monthly_payment_updated,
    mp.year,
    mp.month
FROM players p
LEFT JOIN monthly_payments mp ON p.id = mp.player_id 
    AND mp.year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND mp.month = EXTRACT(MONTH FROM CURRENT_DATE)
WHERE p.is_active = true
ORDER BY p.name; 