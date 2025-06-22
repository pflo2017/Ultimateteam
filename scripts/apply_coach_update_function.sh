#!/bin/bash

# Apply the coach update function migration
echo "Applying coach update function migration..."

# Get the Supabase project reference
PROJECT_REF=$(grep project_id supabase/config.toml | awk -F '"' '{print $2}')
echo "Project reference: $PROJECT_REF"

# Apply the migration
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" < supabase/migrations/20250717_fix_coach_registration.sql

# Verify the function was created
echo "Verifying function was created..."
supabase db query --db-url "postgresql://postgres:postgres@localhost:54322/postgres" "SELECT proname, prosrc FROM pg_proc WHERE proname IN ('update_coach_user_id', 'update_coach_user_id_by_phone');"

echo "Migration applied successfully!" 