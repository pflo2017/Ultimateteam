#!/bin/bash
# Script to completely clear all caches and start fresh

# Kill any running Expo processes
echo "Killing any running Expo processes..."
killall -9 node 2>/dev/null

# Clear caches
echo "Clearing npm cache..."
npm cache clean --force

echo "Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache

echo "Clearing watchman cache..."
watchman watch-del-all 2>/dev/null

echo "Removing Metro bundler cache..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

echo "All caches cleared. Starting Expo with clean slate..."
npx expo start --clear --no-dev --ios 