# Fix Player Deletion Constraints

## Problem
When trying to delete a player from the `players` table in Supabase, you may encounter these errors:

```
Unable to delete row as it is currently referenced by a foreign key constraint from the table `monthly_payments`.
Set an on delete behavior on the foreign key relation monthly_payments_player_id_fkey in the monthly_payments table to automatically respond when row(s) are being deleted in the players table.
```

Or:

```
Unable to delete row as it is currently referenced by a foreign key constraint from the table `parent_children`.
Set an on delete behavior on the foreign key relation parent_children_player_id_fkey in the parent_children table to automatically respond when row(s) are being deleted in the players table.
```

This happens because these tables have foreign key references to the `players` table, but without CASCADE deletion rules.

## Solution

To fix these issues, you need to modify the foreign key constraints to include `ON DELETE CASCADE`. This will automatically delete any related records when a player is deleted.

### Steps to Fix:

1. Open the Supabase dashboard for your project
2. Go to the SQL Editor section
3. Create a new query
4. Copy and paste the contents of the `fix_all_player_constraints.sql` file into the query editor
5. Run the query

The SQL script will:
1. Drop the existing constraints for both tables
2. Create new constraints with `ON DELETE CASCADE` behavior
3. Check for any other tables that might reference the players table
4. Display the updated constraint information to confirm the changes

## Individual Fixes

If you prefer to fix only one constraint at a time:

- For the `monthly_payments` table, use the `fix_player_deletion_constraint.sql` script
- For the `parent_children` table, use the `fix_parent_children_constraint.sql` script

## Verification

After running the script, you should be able to delete players from the `players` table without encountering any foreign key constraint errors. When you delete a player:

- All their payment records in the `monthly_payments` table will be automatically deleted
- All their associations in the `parent_children` table will be automatically deleted 