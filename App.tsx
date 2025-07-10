import React, { useState, useCallback, useEffect } from 'react';
import { Navigation } from './src/navigation';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { SplashScreen } from './src/components/SplashScreen';
import { View, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { JWTErrorHandler } from './src/utils/jwtErrorHandler';
import SuspendedClubBanner from './src/components/SuspendedClubBanner';
import { getUserClubId } from './src/services/activitiesService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import './src/i18n';
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
  const [isSuspended, setIsSuspended] = useState(false);
  const [checkedSuspension, setCheckedSuspension] = useState(false);
  const [clubName, setClubName] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);

  const SUSPENSION_CHECK_KEY = 'last_suspension_check';

  // Move checkSuspension here so it can access state setters
  const checkSuspension = async () => {
    try {
      console.log('[SUSPENSION CHECK] Starting suspension check...');
      // Log AsyncStorage contents for admin_data and coach_data
      const adminDataStr = await AsyncStorage.getItem('admin_data');
      const coachDataStr = await AsyncStorage.getItem('coach_data');
      console.log('[SUSPENSION CHECK] admin_data:', adminDataStr);
      console.log('[SUSPENSION CHECK] coach_data:', coachDataStr);
      const clubId = await getUserClubId();
      console.log('[SUSPENSION CHECK] Club ID from getUserClubId:', clubId);
      if (!clubId) {
        console.log('[SUSPENSION CHECK] No club ID found, skipping suspension check');
        setCheckedSuspension(true);
        return;
      }
      const { data, error } = await supabase
        .from('clubs')
        .select('is_suspended, name')
        .eq('id', clubId)
        .single();
      console.log('[SUSPENSION CHECK] Supabase response:', { data, error });
      if (error) {
        console.log('[SUSPENSION CHECK] Error fetching club data:', error);
        setCheckedSuspension(true);
        return;
      }
      const suspensionStatus = data?.is_suspended === true;
      console.log('[SUSPENSION CHECK] Club name:', data?.name);
      console.log('[SUSPENSION CHECK] Is suspended:', suspensionStatus);
      console.log('[SUSPENSION CHECK] Raw is_suspended value:', data?.is_suspended);
      setIsSuspended(suspensionStatus);
      setClubName(data?.name);
    } catch (e) {
      console.log('[SUSPENSION CHECK] Exception during suspension check:', e);
      setCheckedSuspension(true);
    } finally {
      setCheckedSuspension(true);
    }
  };

  const checkSuspensionIfNeeded = async () => {
    const today = new Date().toISOString().slice(0, 10); // e.g., '2024-07-09'
    const lastCheck = await AsyncStorage.getItem(SUSPENSION_CHECK_KEY);

    if (lastCheck === today) {
      // Already checked today, skip
      return;
    }

    // Run your suspension check logic here...
    await checkSuspension();

    // Update the last check date
    await AsyncStorage.setItem(SUSPENSION_CHECK_KEY, today);
  };

  // Listen for Supabase session changes
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Check for club suspension only if session exists
  useEffect(() => {
    if (!session) {
      setIsSuspended(false);
      setCheckedSuspension(false);
      setClubName(undefined);
      return;
    }
    checkSuspensionIfNeeded();
  }, [session]);

  // Ignore specific error messages
  useEffect(() => {
    LogBox.ignoreLogs([
      'Auth session missing!',
      'AuthSessionMissingError',
      '[AuthSessionMissingError: Auth session missing!]'
    ]);
    LogBox.ignoreLogs([
      'Warning: ...',
      'EventEmitter.removeListener',
      'Animated: `useNativeDriver`'
    ]);
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Supabase session at app start:', session);
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
  }, []);

  const handleAnimationFinish = useCallback(() => {
    if (sessionChecked) {
      setIsLoading(false);
    }
  }, [sessionChecked]);

  // Function to reset suspension state (for logout)
  const resetSuspensionState = () => {
    setIsSuspended(false);
    setCheckedSuspension(false);
    setClubName(undefined);
  };

  console.log('[SUSPENSION CHECK] Render state:', { 
    isSuspended, 
    checkedSuspension, 
    clubName,
    shouldShowBanner: isSuspended && checkedSuspension,
    isLoading,
    sessionChecked,
    session
  });

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
          <>
            {isSuspended && checkedSuspension && session && (
              <SuspendedClubBanner supportEmail="support@example.com" clubName={clubName} onLogout={resetSuspensionState} />
            )}
            <Navigation />
          </>
        )}
      </PaperProvider>
    </SafeAreaProvider>
  );
}
