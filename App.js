import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Navigation } from './src/navigation';
import 'react-native-url-polyfill/auto';
import { disableExpoUpdates } from './src/utils/disableUpdates';
import { LogBox } from 'react-native';

// Disable warning logs
LogBox.ignoreLogs([
  'Possible Unhandled Promise Rejection',
  'Remote debugger',
  'Unable to resolve module',
  'Require cycle',
  'expo-updates',
]);

export default function App() {
  useEffect(() => {
    // Disable Expo updates at runtime
    disableExpoUpdates();
    
    // Any app-level initialization can go here
    console.log('App initialized');
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Navigation />
    </>
  );
}
