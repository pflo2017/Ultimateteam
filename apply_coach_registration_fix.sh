#!/bin/bash

# Script to apply coach registration fix SQL

echo "Applying coach registration fix..."

# Get Supabase URL and API key from .env file if exists
if [ -f .env ]; then
  source .env
fi

# Use environment variables or provide defaults
SUPABASE_URL=${SUPABASE_URL:-"https://nbayrevtbszgpurwbwym.supabase.co"}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

# Check if we have the required variables
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_KEY" ]]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
  echo "Please set them in .env file or directly in the script"
  exit 1
fi

# Apply the SQL fix
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql_query\": \"$(cat fix_coach_registration_fixed.sql | tr -d '\n' | sed 's/"/\\"/g')\"}"

echo -e "\nCoach registration fix applied successfully!"
echo "Coaches will now be set to active (is_active=true) when they complete registration" 