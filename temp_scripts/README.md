# Supabase Security Fixes

This directory contains scripts to fix security warnings identified by the Supabase Database Linter.

## Issues Found

1. **Exposed Auth Users**
   - View `club_details` in the public schema may expose `auth.users` data to anon or authenticated roles.

2. **Policy Exists But RLS Disabled**
   - Table `public.master_admins` has RLS policies but RLS is not enabled on the table.

3. **Security Definer Views**
   - Several views are defined with the SECURITY DEFINER property, which can pose security risks:
     - `public.user_attendance_reports`
     - `public.club_active_players`
     - `public.team_test_only`
     - `public.teams_with_player_count`
     - `public.club_details`
     - `public.activities_with_local_time`
     - `public.attendance_with_correct_dates`

4. **RLS Disabled in Public Schema**
   - Tables without RLS enabled:
     - `public.master_admins`
     - `public.players_backup`
     - `public.players_payment_backup`

## Application Steps

1. **Review the Script**
   - Before applying, review `fix_security_warnings.sql` and adjust view definitions to match your actual database schema.
   - This is especially important for views, as the example SQL provided may not match your exact schema.

2. **Back Up Your Database**
   ```bash
   supabase db dump -f database_backup.sql
   ```

3. **Apply the Fixes**
   ```bash
   # Using Supabase CLI
   supabase db reset --db-url "your-project-url"
   
   # Or using psql directly
   psql -h "your-host" -U "your-user" -d "your-database" -f fix_security_warnings.sql
   ```

4. **Verify Fixes**
   - Run the Supabase Database Linter again to confirm the issues are resolved.
   - Ensure your application still works correctly with these changes.

## Important Notes

- The view definitions in the script are examples. You should check the actual structure of your views before applying the changes.
- For the `club_details` view, ensure you're not losing functionality by removing the auth.users reference.
- Security policies have been added to backup tables that provide access only to super admins. Adjust these policies based on your access requirements. 