import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ParentManageScreen } from '../screens/parent/ParentManageScreen';
import { ParentEventsScreen } from '../screens/parent/ParentEventsScreen';
import { ParentChatScreen } from '../screens/parent/ParentChatScreen';
import { ParentNewsScreen } from '../screens/parent/ParentNewsScreen';
import { ParentSettingsScreen } from '../screens/parent/ParentSettingsScreen';
import { ParentPaymentsScreen } from '../screens/parent/ParentPaymentsScreen';
import { EditChildScreen } from '../screens/parent/EditChildScreen';
import { AddChildScreen } from '../screens/parent/AddChildScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { View, TouchableOpacity, StyleSheet, Text, Platform, Alert, Pressable } from 'react-native';
import { Menu } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, ParentStackParamList, ParentTabParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ActivityDetailsScreen } from '../screens/ActivityDetailsScreen';
import { EditActivityScreen } from '../screens/EditActivityScreen';
import { PostEditorScreen } from '../screens/admin/PostEditorScreen';

// Add global type declaration for reloadRole
declare global {
  // eslint-disable-next-line no-var
  var reloadRole: undefined | (() => void);
}

const Tab = createBottomTabNavigator<ParentTabParamList>();
const Stack = createNativeStackNavigator<ParentStackParamList>();

type ParentNavigationProp = NativeStackNavigationProp<ParentStackParamList>;

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
    borderBottomColor: COLORS.grey[200],
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  parentName: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.primary,
    fontFamily: 'Urbanist',
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

const ParentHeader = () => {
  const [visible, setVisible] = useState(false);
  const [parentName, setParentName] = useState<string>('');
  const navigation = useNavigation<ParentNavigationProp>();

  useEffect(() => {
    loadParentInfo();
  }, []);

  const loadParentInfo = async () => {
    try {
      const storedParentData = await AsyncStorage.getItem('parent_data');
      if (storedParentData) {
        const parentData = JSON.parse(storedParentData);
        setParentName(parentData.name);
      }
    } catch (error) {
      console.error('Error loading parent info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear parent data first - this is what the root navigator checks
      await AsyncStorage.removeItem('parent_data');
      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Update navigation role after logout
      if (typeof global !== 'undefined' && typeof global.reloadRole === 'function') {
        global.reloadRole();
      }
      // No need to reload or navigate; the root navigator will handle it
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.headerWrapper}>
      <View style={styles.headerContainer}>
        <Text style={styles.parentName}>{parentName}</Text>
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
              navigation.navigate('Settings');
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
        name="Dashboard"
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Manage"
        component={ParentManageScreen}
        options={{
          tabBarLabel: 'Manage',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={ParentPaymentsScreen}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="credit-card-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Events"
        component={ParentEventsScreen}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ParentChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message-text-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="News"
        component={ParentNewsScreen}
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

export const ParentNavigator = () => {
  return (
    <SafeAreaView style={[styles.container, styles.safeArea]} edges={['right', 'left', 'bottom']}>
      <View style={styles.container}>
        <Stack.Navigator>
          <Stack.Screen
            name="ParentTabs"
            component={TabNavigator}
            options={{
              header: () => <ParentHeader />,
            }}
          />
          <Stack.Screen
            name="Settings"
            component={ParentSettingsScreen}
            options={{
              headerTitle: 'Settings',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="EditChild"
            component={EditChildScreen}
            options={{
              headerTitle: 'Edit Child',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="AddChild"
            component={AddChildScreen}
            options={{
              headerTitle: 'Add Child',
              headerBackTitle: 'Back',
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
              headerTitle: 'Edit Activity',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="PostEditor"
            component={PostEditorScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </View>
    </SafeAreaView>
  );
}; 