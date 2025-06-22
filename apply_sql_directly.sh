#!/bin/bash

# Script to apply coach registration fix SQL directly using psql

echo "Applying coach registration fix..."

# Get Supabase URL and credentials from .env file if exists
if [ -f .env ]; then
  source .env
fi

# Use environment variables or provide defaults
DB_HOST=${SUPABASE_DB_HOST:-"db.nbayrevtbszgpurwbwym.supabase.co"}
DB_PORT=${SUPABASE_DB_PORT:-"5432"}
DB_NAME=${SUPABASE_DB_NAME:-"postgres"}
DB_USER=${SUPABASE_DB_USER:-"postgres"}
DB_PASSWORD=${SUPABASE_DB_PASSWORD:-"your-password-here"}

# Check if we have the required variables
if [[ -z "$DB_HOST" || -z "$DB_PASSWORD" ]]; then
  echo "Error: Database connection details must be set"
  echo "Please set them in .env file or directly in the script"
  exit 1
fi

# Apply the SQL fix directly using psql
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f fix_coach_registration_fixed.sql

echo -e "\nCoach registration fix applied successfully!"
echo "Coaches will now be set to active (is_active=true) when they complete registration" 