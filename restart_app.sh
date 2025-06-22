#!/bin/bash

# Stop any running Expo processes
echo "Stopping any running Expo processes..."
pkill -f "expo"

# Apply minimal RLS fixes
echo "Applying minimal RLS fixes to Supabase..."
cat safe_rls_fixes.sql | supabase sql

# Clean the project
echo "Cleaning project..."
rm -rf node_modules/.cache
rm -rf .expo

# Install dependencies (in case any are missing)
echo "Installing dependencies..."
npm install

# Start the development server
echo "Starting Expo development server..."
expo start --clear

echo "Done! The app should now be running with the updated Supabase configuration." 