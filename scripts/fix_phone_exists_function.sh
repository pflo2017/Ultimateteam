#!/bin/bash

# Fix the check_phone_exists function in Supabase
# This script applies the migration to fix the function that checks if a phone number exists in auth

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting check_phone_exists function fix...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found. Please create it with your Supabase credentials.${NC}"
  exit 1
fi

# Source the .env file to get credentials
source .env

# Check if credentials are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo -e "${RED}Error: Supabase credentials not found in .env file.${NC}"
  exit 1
fi

# Apply the SQL migration using curl
echo -e "${YELLOW}Applying function fix...${NC}"

# Read the SQL file content
SQL_CONTENT=$(cat supabase/migrations/20250714_fix_phone_exists_function.sql)

# Execute the SQL against Supabase
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": \"${SQL_CONTENT}\"}" \
  --silent > /tmp/response.json

# Check if the curl command succeeded
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to execute SQL command.${NC}"
  exit 1
fi

# Check response for errors
if grep -q "error" /tmp/response.json; then
  echo -e "${RED}Error in SQL execution:${NC}"
  cat /tmp/response.json
  exit 1
else
  echo -e "${GREEN}Function fix successfully applied!${NC}"
  echo -e "${GREEN}The following changes were made:${NC}"
  echo -e "  - Dropped the existing check_phone_exists function"
  echo -e "  - Created a more reliable version of the function"
  echo -e "  - Added proper phone number normalization"
  echo -e "  - Granted execute permissions to authenticated and anonymous users"
fi

echo -e "${YELLOW}Cleaning up...${NC}"
rm -f /tmp/response.json

echo -e "${GREEN}Done!${NC}" 