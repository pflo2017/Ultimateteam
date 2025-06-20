-- Script to update the foreign key constraint in parent_children table
-- to allow automatic deletion of parent_children records when a player is deleted

-- Drop the existing constraint if it exists
ALTER TABLE IF EXISTS parent_children 
DROP CONSTRAINT IF EXISTS parent_children_player_id_fkey;

-- Add the constraint with ON DELETE CASCADE
ALTER TABLE IF EXISTS parent_children 
ADD CONSTRAINT parent_children_player_id_fkey 
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
WHERE tc.constraint_name = 'parent_children_player_id_fkey'; 