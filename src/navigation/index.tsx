import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminRegisterScreen } from '../screens/AdminRegisterScreen';
import { CoachLoginScreen } from '../screens/CoachLoginScreen';
import { CoachResetPasswordScreen } from '../screens/CoachResetPasswordScreen';
import { ParentLoginScreen } from '../screens/ParentLoginScreen';
import { ParentTeamCodeScreen } from '../screens/ParentTeamCode';
import { ParentRegistrationScreen } from '../screens/ParentRegistration';
import ParentVerificationScreen from '../screens/ParentVerification';
import { ParentPasswordLoginScreen } from '../screens/ParentPasswordLogin';
import { ParentResetPasswordScreen } from '../screens/ParentResetPassword';
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
import { AttendanceReportDetailsScreen } from '../screens/AttendanceReportDetailsScreen';
import AddAttendanceScreen from '../screens/AddAttendanceScreen';
import { PlayerDetailsScreen } from '../screens/PlayerDetailsScreen';
import { StatisticsScreen } from '../screens/StatisticsScreen';

// Add global type declaration for reloadRole
declare global {
  // eslint-disable-next-line no-var
  var reloadRole: undefined | (() => void);
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export const Navigation = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [coachData, setCoachData] = useState<any>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [role, setRole] = useState<'parent' | 'admin' | 'coach' | null>(null);

  // Role detection logic as a function
  const reloadRole = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      const storedParentData = await AsyncStorage.getItem('parent_data');
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      const storedAdminData = await AsyncStorage.getItem('admin_data');

      // First check stored role data, as it takes precedence
      if (storedParentData) {
        // If we have parent data, clear other roles
        await AsyncStorage.multiRemove(['admin_data', 'coach_data']);
        setRole('parent');
      } else if (storedCoachData) {
        // If we have coach data, clear other roles
        await AsyncStorage.multiRemove(['admin_data', 'parent_data']);
        setRole('coach');
      } else if (storedAdminData && session) {
        // Only set admin role if we have both admin data and a session
        await AsyncStorage.multiRemove(['coach_data', 'parent_data']);
        setRole('admin');
      } else {
        // No valid role data found
        setRole(null);
      }
    } catch (error) {
      console.error('Error in reloadRole:', error);
      setRole(null);
    }
  };

  // Expose reloadRole globally for login/logout to call
  useEffect(() => {
    global.reloadRole = reloadRole;
    reloadRole(); // Call on mount
    return () => { delete global.reloadRole; };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {role === 'parent' ? (
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
                name="AttendanceReportDetails"
                component={AttendanceReportDetailsScreen}
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
              <Stack.Screen
                name="AddAttendance"
                component={AddAttendanceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PlayerDetails"
                component={PlayerDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="StatisticsScreen"
                component={StatisticsScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          ) : role === 'admin' ? (
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
                name="AttendanceReportDetails"
                component={AttendanceReportDetailsScreen}
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
              <Stack.Screen
                name="AddAttendance"
                component={AddAttendanceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PlayerDetails"
                component={PlayerDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="StatisticsScreen"
                component={StatisticsScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          ) : role === 'coach' ? (
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
                name="AttendanceReportDetails"
                component={AttendanceReportDetailsScreen}
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
              <Stack.Screen
                name="CoachResetPassword"
                component={CoachResetPasswordScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="AddAttendance"
                component={AddAttendanceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PlayerDetails"
                component={PlayerDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="StatisticsScreen"
                component={StatisticsScreen}
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
              <Stack.Screen name="CoachResetPassword" component={CoachResetPasswordScreen} />
              <Stack.Screen name="ParentLogin" component={ParentLoginScreen} />
              <Stack.Screen name="ParentPasswordLogin" component={ParentPasswordLoginScreen} />
              <Stack.Screen name="ParentResetPassword" component={ParentResetPasswordScreen} />
              <Stack.Screen name="ParentRegistration" component={ParentRegistrationScreen} />
              <Stack.Screen name="ParentVerification" component={ParentVerificationScreen} />
              <Stack.Screen name="ParentTeamCode" component={ParentTeamCodeScreen} />
              <Stack.Screen
                name="AddAttendance"
                component={AddAttendanceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PlayerDetails"
                component={PlayerDetailsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="StatisticsScreen"
                component={StatisticsScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}; 