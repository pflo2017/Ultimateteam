#!/bin/bash

# Script to apply the update_coach_user_id function to the Supabase database

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

echo "Applying update_coach_user_id function to database..."

# Apply the SQL function
psql "$PG_CONNECTION" -f temp_scripts/update_coach_user_id_function.sql

if [ $? -eq 0 ]; then
  echo "✅ Successfully applied update_coach_user_id function!"
else
  echo "❌ Failed to apply update_coach_user_id function."
  exit 1
fi

# Create a small script to refresh the schema cache
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

echo "✅ Database update completed successfully!" 