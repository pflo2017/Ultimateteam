#!/bin/bash

# Script to apply activity presence policy fix

# Supabase URL from app.config.js
SUPABASE_URL="https://ulltpjezntzgiawchmaj.supabase.co"

echo "Applying activity presence policy fix..."

# You'll need to run this with proper authentication
# Either use the Supabase UI to run the SQL directly or 
# use the supabase CLI if you have it set up

echo "Option 1: Apply using Supabase UI"
echo "--------------------------------"
echo "1. Go to https://app.supabase.com"
echo "2. Select your project"
echo "3. Go to the SQL Editor"
echo "4. Paste the contents of fix_activity_presence_policies.sql"
echo "5. Run the query"

echo ""
echo "Option 2: Apply using Node.js script"
echo "-----------------------------------"
echo "Run: node apply_activity_presence_fix.js"

# Display the SQL that will be applied
echo ""
echo "SQL to be applied:"
echo "----------------"
cat fix_activity_presence_policies.sql 