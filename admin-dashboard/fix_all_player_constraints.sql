-- Script to update all foreign key constraints related to the players table
-- This will allow automatic deletion of related records when a player is deleted

-- 1. Fix monthly_payments constraint
-- Drop the existing constraint if it exists
ALTER TABLE IF EXISTS monthly_payments 
DROP CONSTRAINT IF EXISTS monthly_payments_player_id_fkey;

-- Add the constraint with ON DELETE CASCADE
ALTER TABLE IF EXISTS monthly_payments 
ADD CONSTRAINT monthly_payments_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- 2. Fix parent_children constraint
-- Drop the existing constraint if it exists
ALTER TABLE IF EXISTS parent_children 
DROP CONSTRAINT IF EXISTS parent_children_player_id_fkey;

-- Add the constraint with ON DELETE CASCADE
ALTER TABLE IF EXISTS parent_children 
ADD CONSTRAINT parent_children_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- 3. Check for any other tables that reference players.id
-- This query will show all other foreign key constraints that might need fixing
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
WHERE ccu.table_name = 'players' AND ccu.column_name = 'id'
  AND tc.constraint_name NOT IN ('monthly_payments_player_id_fkey', 'parent_children_player_id_fkey');

-- 4. Confirm the constraints were updated
SELECT 'monthly_payments_player_id_fkey' as constraint_name, rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'monthly_payments_player_id_fkey'

UNION ALL

SELECT 'parent_children_player_id_fkey' as constraint_name, rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'parent_children_player_id_fkey'; 