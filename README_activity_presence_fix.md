# Activity Presence RLS Policy Fix

## Problem

The application is experiencing an error when parents try to update activity presence records:

```
ERROR: new row violates row-level security policy for table "activity_presence"
```

This occurs because the Row Level Security (RLS) policies for the `activity_presence` table are not correctly configured to allow parents to insert or update records, even when they set their own ID as the `parent_id`.

## Root Cause

The existing RLS policies are incorrectly configured. They are either:
- Missing entirely for certain operations
- Not correctly checking the `parent_id` field against the authenticated user
- Conflicting with each other (overly permissive vs. restrictive policies)

## Solution

The `comprehensive_fix_presence_policy.sql` script performs the following actions:

1. Temporarily disables RLS on the table to ensure we can modify it
2. Makes sure the `parent_id` column exists
3. Drops all existing policies to start fresh
4. Re-enables RLS
5. Creates four comprehensive policies:
   - Everyone can read all presence records
   - Parents can insert records only when setting themselves as parent_id
   - Parents can update records only when they are the parent_id
   - Parents can delete records only when they are the parent_id
6. Forces RLS to ensure it's applied

## How to Apply

1. Log in to the Supabase dashboard
2. Go to the SQL Editor
3. Paste the contents of `comprehensive_fix_presence_policy.sql`
4. Run the SQL

This will provide full access to parents to manage their children's activity presence while maintaining proper security.

## Verification

After applying the fix, you should be able to:
1. Select all records from the activity_presence table
2. Insert new records with the parent_id matching your auth.uid()
3. Update existing records where parent_id matches your auth.uid()
4. Delete records where parent_id matches your auth.uid()

## Technical Notes

This fix maintains proper RLS security by:
- Not making the table completely public
- Ensuring parents can only modify their own children's records
- Preserving read access for everyone to see who's attending activities 