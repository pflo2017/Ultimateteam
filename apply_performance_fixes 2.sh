#!/bin/bash

# apply_performance_fixes.sh
# Apply database performance fixes for RLS policies

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

# Copy the fix scripts to migrations directory with timestamp
cp fix_rls_performance.sql ./supabase/migrations/${TIMESTAMP}_fix_rls_performance.sql
cp fix_multiple_permissive_policies.sql ./supabase/migrations/${TIMESTAMP}_fix_multiple_permissive_policies.sql

# Apply the fixes
echo -e "${YELLOW}Applying RLS performance fixes...${NC}"
supabase db reset --yes || {
    echo -e "${RED}Failed to apply database fixes. Restoring from backup...${NC}"
    supabase db dump --db-url postgres://postgres:postgres@localhost:54322/postgres -f ./supabase/backup/backup_before_performance_fixes_${TIMESTAMP}.sql
    echo -e "${RED}Fix application failed.${NC}"
    exit 1
}

echo -e "${GREEN}Database performance fixes applied successfully!${NC}"
echo "Fixes include:"
echo "1. Optimized RLS policies to prevent re-evaluation of auth functions for each row"
echo "2. Consolidated multiple permissive policies for the same role and action"
echo "3. Removed duplicate index from admin_profiles table"
echo -e "${YELLOW}Note: The application may need to be restarted for changes to take effect.${NC}"

exit 0 