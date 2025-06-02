// This file disables Expo updates at runtime
export const disableExpoUpdates = () => {
  try {
    // Try to disable updates by manipulating the global object
    if (global.__EXPO_CONSTANTS__) {
      global.__EXPO_CONSTANTS__ = {
        ...global.__EXPO_CONSTANTS__,
        manifest: {
          ...global.__EXPO_CONSTANTS__.manifest,
          updates: {
            enabled: false,
            checkAutomatically: "OFF"
          }
        }
      };
    }
    
    // Try to intercept the update check functions
    if (global.expo && global.expo.Updates) {
      global.expo.Updates.checkForUpdateAsync = async () => ({ isAvailable: false });
      global.expo.Updates.fetchUpdateAsync = async () => {};
    }
    
    console.log('Expo updates disabled at runtime');
  } catch (error) {
    console.error('Failed to disable updates:', error);
  }
}; 