import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminRegisterScreen } from '../screens/AdminRegisterScreen';
import { CoachLoginScreen } from '../screens/CoachLoginScreen';
import { ParentLoginScreen } from '../screens/ParentLoginScreen';
import { AdminNavigator } from './AdminTabNavigator';
import { CoachNavigator } from './CoachNavigator';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Home: undefined;
  AdminLogin: undefined;
  AdminRegister: undefined;
  CoachLogin: undefined;
  ParentLogin: undefined;
  AdminDashboard: undefined;
  Coach: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const Navigation = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [coachData, setCoachData] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Clear all data on app start for a clean slate
        await AsyncStorage.clear(); // Clear all stored data
        await supabase.auth.signOut();
        setSession(null);
        setCoachData(null);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true);
      }
    };

    initializeApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for coach data changes
  useEffect(() => {
    const checkCoachData = async () => {
      try {
        const storedCoachData = await AsyncStorage.getItem('coach_data');
        if (storedCoachData) {
          setCoachData(JSON.parse(storedCoachData));
        } else {
          setCoachData(null);
        }
      } catch (error) {
        console.error('Error checking coach data:', error);
        setCoachData(null);
      }
    };

    // Check immediately
    checkCoachData();

    // Set up interval to check for changes
    const interval = setInterval(checkCoachData, 1000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, []);

  if (!isInitialized) {
    // You could show a splash screen here
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <Stack.Screen 
              name="AdminDashboard" 
              component={AdminNavigator}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
          ) : coachData ? (
            <Stack.Screen 
              name="Coach" 
              component={CoachNavigator}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
              <Stack.Screen name="AdminRegister" component={AdminRegisterScreen} />
              <Stack.Screen name="CoachLogin" component={CoachLoginScreen} />
              <Stack.Screen name="ParentLogin" component={ParentLoginScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}; 