import React, { useState, useCallback } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

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
      <PaperProvider>
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
