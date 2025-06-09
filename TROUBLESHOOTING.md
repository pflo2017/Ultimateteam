# UltimateTeam Troubleshooting Guide

This document provides solutions for common issues encountered when running the UltimateTeam Expo React Native application.

## App Entry Point Configuration

### Critical Entry Point Files

The application uses a custom entry point configuration that is essential for proper startup:

1. **AppEntry.js** (root directory) - This is the main entry point for the application
2. **app.json** - Contains the `entryPoint` configuration pointing to AppEntry.js
3. **app.config.js** - Also contains the `entryPoint` configuration

If you experience startup issues, ensure these files are properly configured:

```javascript
// AppEntry.js - Main entry point
// This file must exist in the root directory
console.log('Starting AppEntry.js initialization');

import React from 'react';
import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

// Disable warning logs
LogBox.ignoreAllLogs();

// Global error handler for uncaught errors
if (global.ErrorUtils) {
  const originalErrorHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log all errors
    console.log(`Global error caught (${isFatal ? 'FATAL' : 'non-fatal'}):`, error.message);
    
    // Suppress crypto-related errors
    if (error && error.message && (
      error.message.includes("Cannot read property 'S' of undefined") ||
      error.message.includes("Cannot read property 'default' of undefined")
    )) {
      console.log('Suppressed crypto error:', error.message);
      return;
    }
    
    // Pass other errors to the original handler
    originalErrorHandler(error, isFatal);
  });
}

// Register the main app component
registerRootComponent(App);
```

```json
// app.json - Must include the entryPoint property
{
  "expo": {
    "entryPoint": "./AppEntry.js",
    // other configuration...
  }
}
```

```javascript
// app.config.js - Must include the entryPoint property
export default {
  expo: {
    entryPoint: "./AppEntry.js",
    // other configuration...
  }
};
```

## Common Issues and Solutions

### 1. Missing Supabase Configuration Error

**Error Message:**
```
[runtime not ready]: Error: Missing Supabase configuration. Please check your app.config.js
```

**Solution:**
Ensure `app.config.js` has valid Supabase credentials:

```javascript
export default {
  expo: {
    // other configuration...
    extra: {
      supabaseUrl: process.env.SUPABASE_URL || "https://your-supabase-url.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "your-anon-key",
    },
  }
};
```

### 2. Node.js Polyfill Issues with Supabase

**Error Message:**
```
Error: Unable to resolve module 'crypto' or 'stream'
```

**Solution:**
Update `metro.config.js` to include Node.js polyfills:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add Node.js module polyfills for Supabase
config.resolver.extraNodeModules = {
  stream: require.resolve('readable-stream'),
  crypto: require.resolve('expo-crypto'),
  url: require.resolve('whatwg-url'),
  buffer: require.resolve('buffer'),
  util: require.resolve('util/'),
  events: require.resolve('events/'),
  process: require.resolve('process/browser'),
};

module.exports = config;
```

### 3. TypeScript JSX Errors

**Error Message:**
```
Cannot use JSX unless the '--jsx' flag is provided
```

**Solution:**
Update `tsconfig.json` to include proper JSX configuration:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "jsx": "react-native",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### 4. Crypto-related Errors in Hermes Engine

**Error Message:**
```
Cannot read property 'S' of undefined
Cannot read property 'default' of undefined
```

**Solution:**
These errors are related to the Supabase Realtime client trying to use Node.js crypto modules. The global error handler in AppEntry.js suppresses these errors, but you can also disable Realtime features in your Supabase client:

```javascript
// src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage,
  },
  realtime: {
    enabled: false
  }
});
```

## Reinstalling Dependencies

If you encounter persistent issues with node_modules, try these steps:

1. Delete the node_modules directory:
```bash
rm -rf node_modules
```

2. Delete package-lock.json or yarn.lock:
```bash
rm package-lock.json
# or
rm yarn.lock
```

3. Clear npm or yarn cache:
```bash
npm cache clean --force
# or
yarn cache clean
```

4. Reinstall dependencies:
```bash
npm install
# or
yarn install
```

5. Clear Expo cache:
```bash
npx expo start --clear
```

## Metro Bundler Issues

If you encounter Metro bundler errors:

1. Reset Metro cache:
```bash
npx expo start --clear
```

2. If that doesn't work, try:
```bash
npx react-native start --reset-cache
```

3. Check for port conflicts:
```bash
lsof -i :8081
# Kill the process if needed
kill -9 <PID>
```

## Expo Updates Issues

If you're experiencing issues with Expo updates:

1. Disable updates in app.json and app.config.js:
```json
"updates": {
  "enabled": false,
  "checkAutomatically": "OFF"
}
```

2. Create a utility to disable updates at runtime:
```javascript
// src/utils/disableUpdates.js
import * as Updates from 'expo-updates';

export function disableExpoUpdates() {
  try {
    if (Updates && typeof Updates.checkForUpdateAsync === 'function') {
      Updates.checkForUpdateAsync = async () => ({ isAvailable: false });
      Updates.fetchUpdateAsync = async () => ({ isNew: false });
      
      if (Updates.UPDATES_CONFIGURATION) {
        Updates.UPDATES_CONFIGURATION.enabled = false;
        Updates.UPDATES_CONFIGURATION.checkAutomatically = 'NEVER';
      }
    }
  } catch (error) {
    console.error('Error disabling Expo Updates:', error);
  }
}
```

Then call this function in your AppEntry.js:
```javascript
import { disableExpoUpdates } from './src/utils/disableUpdates';
disableExpoUpdates();
``` 