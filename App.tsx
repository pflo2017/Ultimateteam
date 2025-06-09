import React, { useState, useCallback, useEffect } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0CC1EC',
  },
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

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

    // Restore Supabase session and listen for changes
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Supabase session at app start:', session);
      } catch (e) {
        console.log('Error restoring Supabase session:', e);
      } finally {
        setSessionChecked(true);
      }
    };
    restoreSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Supabase auth state changed. New session:', session);
    });
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleAnimationFinish = useCallback(() => {
    if (sessionChecked) {
      setIsLoading(false);
    }
  }, [sessionChecked]);

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={true}
      />
      <PaperProvider theme={customTheme}>
        {isLoading || !sessionChecked ? (
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
