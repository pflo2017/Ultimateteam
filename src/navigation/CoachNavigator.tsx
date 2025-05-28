import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { CoachDashboardScreen } from '../screens/coach/CoachDashboardScreen';
import { CoachManageScreen } from '../screens/coach/CoachManageScreen';
import { CoachScheduleScreen } from '../screens/coach/CoachScheduleScreen';
import { CoachPaymentsScreen } from '../screens/coach/CoachPaymentsScreen';
import { CoachChatScreen } from '../screens/coach/CoachChatScreen';
import { CoachNewsScreen } from '../screens/coach/NewsScreen';
import { CoachSettingsScreen } from '../screens/coach/CoachSettingsScreen';
import { CreateActivityScreen } from '../screens/CreateActivityScreen';
import { ActivityDetailsScreen } from '../screens/ActivityDetailsScreen';
import { AttendanceTabsScreen } from '../screens/AttendanceTabsScreen';
import { Image, Pressable, View, StyleSheet, Text, Platform, Alert } from 'react-native';
import { Menu } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoachStackParamList = {
  CoachTabs: undefined;
  Settings: undefined;
  CreateActivity: { type: 'practice' | 'match' | 'event' };
  ActivityDetails: { activityId: string };
};

export type CoachTabParamList = {
  CoachDashboard: undefined;
  Manage: { activeTab?: 'teams' | 'players'; teamId?: string };
  Schedule: undefined;
  Attendance: undefined;
  Payments: { showCollections?: boolean };
  Chat: undefined;
  News: undefined;
};

type RootStackParamList = {
  CoachDashboard: undefined;
  Manage: undefined;
  Payments: undefined;
  Profile: undefined;
  Teams: undefined;
  Players: undefined;
};

const Tab = createBottomTabNavigator<CoachTabParamList>();
const Stack = createNativeStackNavigator<CoachStackParamList>();

type CoachNavigationProp = NativeStackNavigationProp<CoachStackParamList>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  safeArea: {
    backgroundColor: COLORS.white,
  },
  headerWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: COLORS.white,
    // marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  coachName: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.primary,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginTop: 8,
  },
  menu: {
    marginTop: 46,
  },
});

const CoachHeader = () => {
  const [visible, setVisible] = useState(false);
  const [coachName, setCoachName] = useState<string>('');
  const coachNavigation = useNavigation<CoachNavigationProp>();
  const rootNavigation = useNavigation<RootNavigationProp>();

  useEffect(() => {
    loadCoachInfo();
  }, []);

  const loadCoachInfo = async () => {
    try {
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (storedCoachData) {
        const coachData = JSON.parse(storedCoachData);
        setCoachName(coachData.name);
      }
    } catch (error) {
      console.error('Error loading coach info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all role data from AsyncStorage to be safe
      await AsyncStorage.multiRemove(['coach_data', 'admin_data', 'parent_data']);
      // Call global.reloadRole to update navigation
      if (global.reloadRole) {
        global.reloadRole();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.headerWrapper}>
      <View style={styles.headerContainer}>
        <Text style={styles.coachName}>{coachName}</Text>
        <Menu
          visible={visible}
          onDismiss={() => setVisible(false)}
          anchor={
            <Pressable 
              onPress={() => setVisible(true)}
              style={styles.profileButton}
            >
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={COLORS.white}
              />
            </Pressable>
          }
          contentStyle={styles.menuContent}
          style={styles.menu}
        >
          <Menu.Item
            onPress={() => {
              setVisible(false);
              coachNavigation.navigate('Settings');
            }}
            title="Settings"
            leadingIcon="cog"
            titleStyle={{ color: COLORS.text }}
          />
          <Menu.Item
            onPress={() => {
              setVisible(false);
              handleLogout();
            }}
            title="Logout"
            leadingIcon="logout"
            titleStyle={{ color: COLORS.text }}
            style={{ borderTopWidth: 1, borderTopColor: COLORS.grey[200] }}
          />
        </Menu>
      </View>
    </SafeAreaView>
  );
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#212121',
        tabBarStyle: {
          height: 60,
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.grey[200],
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="CoachDashboard"
        component={CoachDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Manage"
        component={CoachManageScreen}
        options={{
          tabBarLabel: 'Manage',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={CoachScheduleScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceTabsScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-check-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={CoachPaymentsScreen}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="credit-card-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Chat tab temporarily hidden
      <Tab.Screen
        name="Chat"
        component={CoachChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message-text-outline" size={size} color={color} />
          ),
        }}
      />
      */}
      <Tab.Screen
        name="News"
        component={CoachNewsScreen}
        options={{
          tabBarLabel: 'News',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bullhorn-outline" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const CoachNavigator = () => {
  return (
    <SafeAreaView style={[styles.container, styles.safeArea]} edges={['right', 'left', 'bottom']}>
      <View style={styles.container}>
        <Stack.Navigator>
          <Stack.Screen
            name="CoachTabs"
            component={TabNavigator}
            options={{
              header: () => <CoachHeader />,
              headerTransparent: false,
              headerStyle: {
                backgroundColor: COLORS.white,
              }
            }}
          />
          <Stack.Screen
            name="Settings"
            component={CoachSettingsScreen}
            options={{
              title: 'Settings',
              headerStyle: {
                backgroundColor: COLORS.background,
              },
              headerTintColor: COLORS.text,
              headerShadowVisible: false,
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
            name="ActivityDetails"
            component={ActivityDetailsScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </View>
    </SafeAreaView>
  );
}; 