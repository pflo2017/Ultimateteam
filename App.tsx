import React, { useState, useCallback, useEffect } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { JWTErrorHandler } from './src/utils/jwtErrorHandler';

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
        
        // If we have a session, check if it's expired and refresh if needed
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = session.expires_at;
          
          if (expiresAt && now >= expiresAt) {
            console.log('Session expired, attempting refresh...');
            const refreshed = await JWTErrorHandler.handleJWTError({ 
              message: 'JWT expired',
              code: 'PGRST301'
            });
            
            if (refreshed) {
              console.log('Session refreshed successfully');
            } else {
              console.log('Session refresh failed, user will need to log in again');
            }
          }
        }
      } catch (e) {
        console.log('Error restoring Supabase session:', e);
      } finally {
        setSessionChecked(true);
      }
    };
    restoreSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Supabase auth state changed. New session:', session);
      
      // Handle specific auth events
      switch (event) {
        case 'TOKEN_REFRESHED':
          console.log('JWT token was refreshed successfully');
          break;
        case 'SIGNED_OUT':
          console.log('User signed out');
          break;
        case 'SIGNED_IN':
          console.log('User signed in');
          break;
        default:
          console.log('Auth event:', event);
      }
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
