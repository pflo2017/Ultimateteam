#!/bin/bash

# Change to the directory containing the migration
cd "$(dirname "$0")"

# Check if SUPABASE_URL and SUPABASE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set."
  echo "Please set them using:"
  echo "export SUPABASE_URL=your_project_url"
  echo "export SUPABASE_KEY=your_service_role_key"
  exit 1
fi

# Apply the RLS policy fix
echo "Applying attendance RLS policy fix..."
curl -X POST \
  "$SUPABASE_URL/rest/sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d @- << EOF
$(cat supabase/migrations/20250526_fix_attendance_rls_v3.sql)
EOF

# Check if the request was successful
if [ $? -eq 0 ]; then
  echo "Successfully applied RLS policy changes!"
else
  echo "Failed to apply RLS policy changes."
  exit 1
fi

echo "Done!" 