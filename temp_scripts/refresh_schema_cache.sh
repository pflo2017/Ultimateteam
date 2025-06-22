#!/bin/bash

# Script to refresh the Supabase schema cache

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one with SUPABASE_URL and SUPABASE_SERVICE_KEY."
  exit 1
fi

# Source the .env file to get credentials
source .env

# Check if required variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env file."
  exit 1
fi

# Extract database URL from SUPABASE_URL
DB_URL=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co//')
PG_CONNECTION="postgres://postgres:${SUPABASE_SERVICE_KEY}@db.${DB_URL}.supabase.co:5432/postgres"

echo "Refreshing Supabase schema cache..."

# Create the refresh function if it doesn't exist
echo "CREATE OR REPLACE FUNCTION refresh_schema_cache() RETURNS VOID AS \$\$
BEGIN
  PERFORM pg_reload_conf();
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;" > temp_scripts/refresh_schema_cache.sql

# Apply the refresh schema cache function
psql "$PG_CONNECTION" -f temp_scripts/refresh_schema_cache.sql

if [ $? -eq 0 ]; then
  echo "✅ Successfully applied refresh_schema_cache function!"
else
  echo "❌ Failed to apply refresh_schema_cache function."
  exit 1
fi

# Execute the refresh function
psql "$PG_CONNECTION" -c "SELECT refresh_schema_cache();"

echo "✅ Schema cache refreshed successfully!" 