# Instructions for Rebuilding Views

After dropping all security definer views, follow this process to rebuild them safely:

## 1. Check for the Correct Table Names

Run `check_attendance_table.sql` first to identify the correct table name for attendance data.

## 2. Get the Original View Definitions

For each view you need to rebuild, use this command to get its definition:

```sql
-- If the view still exists (before dropping)
SELECT pg_get_viewdef('view_name', true);
```

Save these definitions for reference.

## 3. Recreate Views in Order

Create each view in the proper dependency order. Start with base views that others depend on:

1. `attendance_with_correct_dates` (if needed, create this one first)
2. `activities_with_local_time`
3. `teams_with_player_count`
4. `team_test_only`
5. `club_active_players`
6. `user_attendance_reports`

## 4. Template for Each View

When recreating each view:

```sql
CREATE VIEW public.view_name AS
-- Copy the view definition you saved, but:
-- 1. Remove any SECURITY DEFINER settings
-- 2. Fix any references to auth.users
-- 3. Use correct table names as found in step 1

-- For example:
SELECT fields, ...
FROM correct_table_name
WHERE conditions;
```

## 5. Test Incrementally

After creating each view:
1. Check if the view works with `SELECT * FROM view_name LIMIT 10;`
2. Make sure your application functionality still works
3. Move to the next view only after confirming success 