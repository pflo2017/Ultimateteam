import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { AdminHomeScreen } from '../screens/admin/HomeScreen';
import { AdminManageScreen } from '../screens/admin/ManageScreen';
import { AdminScheduleScreen } from '../screens/admin/ScheduleScreen';
import { PaymentsScreen } from '../screens/admin/PaymentsScreen';
import { AdminChatScreen } from '../screens/admin/ChatScreen';
import { AdminNewsScreen } from '../screens/admin/NewsScreen';
import { ClubSettingsScreen } from '../screens/admin/ClubSettingsScreen';
import { AddTeamScreen } from '../screens/admin/AddTeamScreen';
import { AddCoachScreen } from '../screens/admin/AddCoachScreen';
import { EditCoachScreen } from '../screens/admin/EditCoachScreen';
import { EditTeamScreen } from '../screens/admin/EditTeamScreen';
import { CreateActivityScreen } from '../screens/CreateActivityScreen';
import { ActivityDetailsScreen } from '../screens/ActivityDetailsScreen';
import { Image, Pressable, View, ActivityIndicator, Alert, StyleSheet, Text, Platform, StatusBar } from 'react-native';
import { Menu } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { SUPABASE_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../types/navigation';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

type AdminNavigationProp = NativeStackNavigationProp<AdminStackParamList>;

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
    // marginTop: Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 0,
  },
  clubName: {
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
  profileImage: {
    width: '100%',
    height: '100%',
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

const AdminHeader = () => {
  const [visible, setVisible] = useState(false);
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>('');
  const [isUploading, setIsLoading] = useState(false);
  const navigation = useNavigation<AdminNavigationProp>();

  useEffect(() => {
    loadClubInfo();

    // Add focus listener to reload club info when returning to screen
    const unsubscribe = navigation.addListener('focus', () => {
      loadClubInfo();
    });

    return unsubscribe;
  }, []);

  const loadClubInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('club_logo, club_name')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setClubLogo(profile.club_logo);
        setClubName(profile.club_name);
      }
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleChangePhoto = async () => {
    try {
      setVisible(false);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketName = 'club-logos';
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

        if (!bucketExists) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 1024 * 1024 * 2, // 2MB
            allowedMimeTypes: ['image/jpeg', 'image/png']
          });
        }

        // Upload the new image
        const base64FileData = result.assets[0].base64;
        if (!base64FileData) throw new Error('No image data');

        const fileName = `${user.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Update the profile with new logo
        const { error: updateError } = await supabase
          .from('admin_profiles')
          .update({ club_logo: fileName })
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Reload the logo
        loadClubInfo();
      }
    } catch (error) {
      console.error('Error changing photo:', error);
      Alert.alert('Error', 'Failed to update club logo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.headerWrapper}>
      <View style={styles.headerContainer}>
        <Text style={styles.clubName}>{clubName}</Text>
        <Menu
          visible={visible}
          onDismiss={() => setVisible(false)}
          anchor={
            <Pressable 
              onPress={() => setVisible(true)}
              style={styles.profileButton}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : clubLogo ? (
                <Image
                  source={{ 
                    uri: `${SUPABASE_URL}/storage/v1/object/public/club-logos/${clubLogo}`,
                  }}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <MaterialCommunityIcons
                  name="shield-account"
                  size={20}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          }
          contentStyle={styles.menuContent}
          style={styles.menu}
        >
          <Menu.Item
            onPress={() => {
              setVisible(false);
              navigation.navigate('ClubSettings');
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
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={AdminHomeScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Manage"
        component={AdminManageScreen}
        options={{
          tabBarLabel: 'Manage',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={AdminScheduleScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="credit-card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="News"
        component={AdminNewsScreen}
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

export const AdminNavigator = () => {
  return (
    <SafeAreaView style={[styles.container, styles.safeArea]} edges={['right', 'left', 'bottom']}>
      <View style={styles.container}>
        <Stack.Navigator>
          <Stack.Screen
            name="AdminTabs"
            component={TabNavigator}
            options={{
              header: () => <AdminHeader />,
              headerTransparent: false,
              headerStyle: {
                backgroundColor: COLORS.white,
              }
            }}
          />
          <Stack.Screen
            name="ClubSettings"
            component={ClubSettingsScreen}
            options={{
              title: 'Club Settings',
              headerStyle: {
                backgroundColor: COLORS.background,
              },
              headerTintColor: COLORS.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="AddTeam"
            component={AddTeamScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AddCoach"
            component={AddCoachScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="EditCoach"
            component={EditCoachScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="EditTeam"
            component={EditTeamScreen}
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