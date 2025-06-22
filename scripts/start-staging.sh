#!/bin/bash

echo "🚀 Starting Ultimate Team in STAGING mode..."

# Set the config to use staging
export EXPO_CONFIG_FILE=app.config.staging.js

# Start the development server
npx expo start --config app.config.staging.js 