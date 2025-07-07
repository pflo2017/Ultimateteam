#!/bin/bash

echo "🚀 Starting Ultimate Team in PRODUCTION mode..."

# Set the config to use production
export EXPO_CONFIG_FILE=app.config.js

# Start the development server
npx expo start --config app.config.js 