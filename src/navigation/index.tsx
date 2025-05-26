import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminRegisterScreen } from '../screens/AdminRegisterScreen';
import { CoachLoginScreen } from '../screens/CoachLoginScreen';
import { ParentLoginScreen } from '../screens/ParentLoginScreen';
import { ParentTeamCodeScreen } from '../screens/ParentTeamCode';
import { ParentRegistrationScreen } from '../screens/ParentRegistration';
import ParentVerificationScreen from '../screens/ParentVerification';
import { ParentPasswordLoginScreen } from '../screens/ParentPasswordLogin';
import { CreateActivityScreen } from '../screens/CreateActivityScreen';
import { ActivityDetailsScreen } from '../screens/ActivityDetailsScreen';
import { EditActivityScreen } from '../screens/EditActivityScreen';
import { AdminNavigator } from './AdminTabNavigator';
import { CoachNavigator } from './CoachNavigator';
import { ParentNavigator } from './ParentTabNavigator';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const Navigation = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [coachData, setCoachData] = useState<any>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for any inconsistent auth state on startup
        const { data } = await supabase.auth.getSession();
        
        if (!data.session) {
          // If no valid session exists, make sure we clear admin state
          await supabase.auth.signOut();
        }
        
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

  // Listen for coach and parent data changes
  useEffect(() => {
    const checkUserData = async () => {
      try {
        const storedCoachData = await AsyncStorage.getItem('coach_data');
        const storedParentData = await AsyncStorage.getItem('parent_data');
        
        if (storedCoachData) {
          setCoachData(JSON.parse(storedCoachData));
        } else {
          setCoachData(null);
        }

        if (storedParentData) {
          setParentData(JSON.parse(storedParentData));
        } else {
          setParentData(null);
        }
      } catch (error) {
        console.error('Error checking user data:', error);
        setCoachData(null);
        setParentData(null);
      }
    };

    // Check immediately
    checkUserData();

    // Set up interval to check for changes
    const interval = setInterval(checkUserData, 1000);

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
            <>
              <Stack.Screen 
                name="AdminRoot" 
                component={AdminNavigator}
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="ActivityDetails"
                component={ActivityDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="EditActivity"
                component={EditActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="CreateActivity"
                component={CreateActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          ) : coachData ? (
            <>
              <Stack.Screen 
                name="Coach" 
                component={CoachNavigator}
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="ActivityDetails"
                component={ActivityDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="EditActivity"
                component={EditActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="CreateActivity"
                component={CreateActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          ) : parentData ? (
            <>
              <Stack.Screen 
                name="ParentNavigator" 
                component={ParentNavigator}
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="ActivityDetails"
                component={ActivityDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="EditActivity"
                component={EditActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="CreateActivity"
                component={CreateActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
              <Stack.Screen name="AdminRegister" component={AdminRegisterScreen} />
              <Stack.Screen name="CoachLogin" component={CoachLoginScreen} />
              <Stack.Screen name="ParentLogin" component={ParentLoginScreen} />
              <Stack.Screen name="ParentTeamCode" component={ParentTeamCodeScreen} />
              <Stack.Screen name="ParentRegistration" component={ParentRegistrationScreen} />
              <Stack.Screen name="ParentVerification" component={ParentVerificationScreen} />
              <Stack.Screen name="ParentPasswordLogin" component={ParentPasswordLoginScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}; 