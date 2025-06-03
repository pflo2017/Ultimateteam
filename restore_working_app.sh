#!/bin/bash

# Restore Working App Script
# This script restores the working application state after fixing Expo issues

echo "🔄 Restoring UltimateTeam application to working state..."

# Check if backup exists
if [ ! -f "backups/ultimateteam_working_after_fixing_expo.tar.gz" ]; then
  echo "❌ Error: Backup file not found!"
  echo "Make sure you're running this script from the project root directory."
  exit 1
fi

# Create a temporary directory
TEMP_DIR="temp_restore"
mkdir -p $TEMP_DIR

# Extract backup to temporary directory
echo "📦 Extracting backup..."
tar -xzf backups/ultimateteam_working_after_fixing_expo.tar.gz -C $TEMP_DIR

# Move to parent directory
cd ..

# Rename current directory to backup
TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "📁 Creating backup of current state as UltimateTeam_backup_$TIMESTAMP"
mv UltimateTeam "UltimateTeam_backup_$TIMESTAMP"

# Move restored files to original location
echo "📋 Restoring files..."
mv $TEMP_DIR UltimateTeam

# Change to restored directory
cd UltimateTeam

# Remove temporary directory if it exists
rm -rf $TEMP_DIR 2>/dev/null

# Install dependencies
echo "📥 Installing dependencies..."
npm install

echo "✅ Restoration complete!"
echo "You can now run the app with: npx expo start --clear" 