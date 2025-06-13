#!/bin/bash

# Reinstall Dependencies Script
# This script reinstalls all dependencies for the UltimateTeam app

echo "🔄 Reinstalling dependencies for UltimateTeam..."

# Remove node_modules
echo "🗑️  Removing node_modules..."
rm -rf node_modules

# Remove lock files
echo "🗑️  Removing lock files..."
rm -f package-lock.json
rm -f yarn.lock

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Install dependencies
echo "📥 Installing dependencies..."
npm install

echo "✅ Dependencies reinstalled successfully!"
echo "You can now run the app with: npx expo start --clear" 