import React, { useState, useCallback } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View } from 'react-native';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleAnimationFinish = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <PaperProvider>
      {isLoading ? (
        <View style={{ flex: 1 }}>
          <SplashScreen onAnimationFinish={handleAnimationFinish} />
        </View>
      ) : (
        <Navigation />
      )}
    </PaperProvider>
  );
}
