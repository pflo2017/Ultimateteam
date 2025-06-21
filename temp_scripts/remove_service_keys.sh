#!/bin/bash

# This script replaces Supabase service keys with a placeholder in all JS files in temp_scripts

# List of files to process
FILES=$(grep -l "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" temp_scripts/*.js)

# Count the files
COUNT=$(echo "$FILES" | wc -l)
echo "Found $COUNT files with exposed Supabase service keys"

# Replace the service key in each file
for file in $FILES; do
  echo "Processing $file..."
  
  # Use sed to replace the service key with a placeholder
  # This pattern looks for a JWT token format (starts with eyJ and has two periods)
  sed -i '' 's/\(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\)/process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"/g' "$file"
  
  # Also replace any hardcoded service role keys
  sed -i '' 's/\(serviceKey: \)"[^"]*"/\1process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"/g' "$file"
  sed -i '' 's/\(supabaseKey: \)"[^"]*"/\1process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"/g' "$file"
  sed -i '' 's/\(key: \)"[^"]*"/\1process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"/g' "$file"
done

echo "Finished processing $COUNT files"
echo "Service keys have been replaced with environment variable references" 