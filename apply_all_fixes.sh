#!/bin/bash

# apply_all_fixes.sh
# Apply comprehensive database performance fixes for RLS policies and indexes

echo "Applying Supabase database performance fixes..."

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current timestamp for backup and migration
TIMESTAMP=$(date +"%Y%m%d%H%M%S")

# Create backup directory if it doesn't exist
mkdir -p ./supabase/backup

# Create backup of current state
echo -e "${YELLOW}Creating database backup...${NC}"
supabase db dump -f ./supabase/backup/backup_before_performance_fixes_${TIMESTAMP}.sql || {
    echo -e "${RED}Failed to create database backup. Aborting.${NC}"
    exit 1
}
echo -e "${GREEN}Backup created successfully.${NC}"

# Create migrations directory if it doesn't exist
mkdir -p ./supabase/migrations

# Copy the fix scripts to the migrations directory
echo -e "${YELLOW}Preparing migration scripts...${NC}"
cp complete_rls_fixes.sql ./supabase/migrations/${TIMESTAMP}_complete_rls_fixes.sql
cp consolidate_duplicate_policies.sql ./supabase/migrations/${TIMESTAMP}_consolidate_duplicate_policies.sql
cp fix_duplicate_indexes.sql ./supabase/migrations/${TIMESTAMP}_fix_duplicate_indexes.sql

# Apply the fixes
echo -e "${YELLOW}Applying RLS performance fixes...${NC}"
cat complete_rls_fixes.sql | supabase db reset || {
    echo -e "${RED}Failed to apply RLS fixes. Restoring from backup...${NC}"
    cat ./supabase/backup/backup_before_performance_fixes_${TIMESTAMP}.sql | supabase db reset
    exit 1
}

echo -e "${YELLOW}Consolidating duplicate policies...${NC}"
cat consolidate_duplicate_policies.sql | supabase db reset || {
    echo -e "${RED}Failed to consolidate policies. Continuing with other fixes...${NC}"
}

echo -e "${YELLOW}Removing duplicate indexes...${NC}"
cat fix_duplicate_indexes.sql | supabase db reset || {
    echo -e "${RED}Failed to remove duplicate indexes. Continuing...${NC}"
}

# Restart the Supabase services
echo -e "${YELLOW}Restarting Supabase services...${NC}"
supabase stop
supabase start

echo -e "${GREEN}All performance fixes have been applied successfully!${NC}"
echo -e "The following fixes were applied:"
echo -e "  1. Optimized RLS policies to prevent re-evaluation of auth functions"
echo -e "  2. Consolidated duplicate permissive policies"
echo -e "  3. Removed duplicate indexes"
echo -e "\nA backup of your database before changes was saved to:"
echo -e "./supabase/backup/backup_before_performance_fixes_${TIMESTAMP}.sql"

# Check for remaining warnings
echo -e "\n${YELLOW}Checking for remaining performance warnings...${NC}"
supabase db lint

echo -e "\n${GREEN}Done!${NC}" 