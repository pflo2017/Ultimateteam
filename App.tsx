import React, { useState, useCallback, useEffect } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0CC1EC',
  },
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  // Ignore specific error messages
  useEffect(() => {
    // Ignore auth session missing errors
    LogBox.ignoreLogs([
      'Auth session missing!',
      'AuthSessionMissingError',
      '[AuthSessionMissingError: Auth session missing!]'
    ]);
    
    // Ignore other common non-critical warnings
    LogBox.ignoreLogs([
      'Warning: ...',
      'EventEmitter.removeListener',
      'Animated: `useNativeDriver`'
    ]);
  }, []);

  const handleAnimationFinish = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={true}
      />
      <PaperProvider theme={customTheme}>
        {isLoading ? (
          <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <SplashScreen onAnimationFinish={handleAnimationFinish} />
          </View>
        ) : (
          <Navigation />
        )}
      </PaperProvider>
    </SafeAreaProvider>
  );
}
