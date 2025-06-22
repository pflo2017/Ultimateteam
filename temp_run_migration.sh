#!/bin/bash

# Temporary script to run the coach auth fix migration
# This script will be deleted after use for security reasons

# Set credentials
export SUPABASE_URL="https://ulltpjezntzgiawchmaj.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI"

# Extract database URL from SUPABASE_URL
DB_URL=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co//')
PG_CONNECTION="postgres://postgres:${SUPABASE_SERVICE_KEY}@db.${DB_URL}.supabase.co:5432/postgres"

echo "Applying coach authentication flow fix..."

# Apply the migration
psql "$PG_CONNECTION" -f supabase/migrations/20240630_fix_coach_auth_flow.sql

if [ $? -eq 0 ]; then
  echo "✅ Successfully applied coach auth fix migration!"
else
  echo "❌ Failed to apply coach auth fix migration."
  exit 1
fi

echo "✅ Coach authentication flow fix completed successfully!"

# Self-delete for security
rm -f temp_run_migration.sh 