import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ParentManageScreen } from '../screens/parent/ParentManageScreen';
import { ParentEventsScreen } from '../screens/parent/ParentEventsScreen';
import { ParentChatScreen } from '../screens/parent/ParentChatScreen';
import { ParentNewsScreen } from '../screens/parent/ParentNewsScreen';
import { ParentSettingsScreen } from '../screens/parent/ParentSettingsScreen';
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
import { AddChildScreen } from '../screens/parent/AddChildScreen';
import { EditChildScreen } from '../screens/parent/EditChildScreen';

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
    marginTop: Platform.OS === 'ios' ? 47 : 0,
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
      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear local storage
      await AsyncStorage.removeItem('parent_data');
      await AsyncStorage.removeItem('selected_child_id');
      
      // The navigation container will automatically handle the navigation
      // when parent data is cleared
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <View style={styles.headerWrapper}>
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
    </View>
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
          tabBarLabel: 'My Children',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-outline" size={24} color={color} />
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
              title: 'Settings',
              headerStyle: {
                backgroundColor: COLORS.background,
              },
              headerTintColor: COLORS.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="AddChild"
            component={AddChildScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_right'
            }}
          />
          <Stack.Screen
            name="EditChild"
            component={EditChildScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_right'
            }}
          />
        </Stack.Navigator>
      </View>
    </SafeAreaView>
  );
}; 