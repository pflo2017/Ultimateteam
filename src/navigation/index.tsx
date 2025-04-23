import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminRegisterScreen } from '../screens/AdminRegisterScreen';
import { CoachLoginScreen } from '../screens/CoachLoginScreen';
import { ParentLoginScreen } from '../screens/ParentLoginScreen';
import { AdminNavigator } from './AdminTabNavigator';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type RootStackParamList = {
  Home: undefined;
  AdminLogin: undefined;
  AdminRegister: undefined;
  CoachLogin: undefined;
  ParentLogin: undefined;
  AdminDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const Navigation = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Clear any existing session on app start
    supabase.auth.signOut();
    
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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