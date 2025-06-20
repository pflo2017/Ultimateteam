-- Script to update the foreign key constraint in monthly_payments table
-- to allow automatic deletion of payment records when a player is deleted

-- Drop the existing constraint if it exists
ALTER TABLE IF EXISTS monthly_payments 
DROP CONSTRAINT IF EXISTS monthly_payments_player_id_fkey;

-- Add the constraint with ON DELETE CASCADE
ALTER TABLE IF EXISTS monthly_payments 
ADD CONSTRAINT monthly_payments_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Confirm the constraint was updated
SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'monthly_payments_player_id_fkey'; 