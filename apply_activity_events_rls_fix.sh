#!/bin/bash

# Apply the RLS fix for activity_events to allow parents to view events
echo "Applying RLS fix for activity_events..."

# Connect to Supabase and apply the fix
npx supabase db push --include-all

echo "RLS fix applied successfully!" 