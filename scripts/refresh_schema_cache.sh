#!/bin/bash

# Refresh Supabase schema cache
# This script forces Supabase to refresh its schema cache after database changes

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Refreshing Supabase schema cache...${NC}"

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

# Execute the schema refresh command using curl
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/reload_schema_cache" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --silent > /tmp/response.json

# Check if the curl command succeeded
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to execute schema refresh command.${NC}"
  exit 1
fi

# Check response for errors
if grep -q "error" /tmp/response.json; then
  echo -e "${RED}Error refreshing schema cache:${NC}"
  cat /tmp/response.json
  exit 1
else
  echo -e "${GREEN}Schema cache refreshed successfully!${NC}"
fi

echo -e "${YELLOW}Cleaning up...${NC}"
rm -f /tmp/response.json

echo -e "${GREEN}Done!${NC}" 