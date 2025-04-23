import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { AdminHomeScreen } from '../screens/admin/HomeScreen';
import { AdminManageScreen } from '../screens/admin/ManageScreen';
import { AdminPaymentsScreen } from '../screens/admin/PaymentsScreen';
import { AdminChatScreen } from '../screens/admin/ChatScreen';
import { AdminAnnouncementsScreen } from '../screens/admin/AnnouncementsScreen';
import { ClubSettingsScreen } from '../screens/admin/ClubSettingsScreen';
import { AddTeamScreen } from '../screens/admin/AddTeamScreen';
import { AddCoachScreen } from '../screens/admin/AddCoachScreen';
import { TeamDetailsScreen } from '../screens/admin/TeamDetailsScreen';
import { Image, Pressable, View, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { Menu } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { SUPABASE_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

type AdminNavigationProp = NativeStackNavigationProp<AdminStackParamList>;

const AdminHeader = () => {
  const [visible, setVisible] = useState(false);
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const [isUploading, setIsLoading] = useState(false);
  const navigation = useNavigation<AdminNavigationProp>();

  useEffect(() => {
    loadClubLogo();
  }, []);

  const loadClubLogo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('club_logo')
        .eq('user_id', user.id)
        .single();

      if (profile?.club_logo) {
        // Fix the URL by using just the filename
        setClubLogo(profile.club_logo);
      }
    } catch (error) {
      console.error('Error loading club logo:', error);
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
        loadClubLogo();
      }
    } catch (error) {
      console.error('Error changing photo:', error);
      Alert.alert('Error', 'Failed to update club logo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Pressable 
          onPress={() => setVisible(true)}
          style={styles.profileButton}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
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
              size={24}
              color={COLORS.primary}
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
  );
};

const TabNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: '#212121',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: COLORS.grey[200],
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          header: ({ navigation, route, options }) => {
            return (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{options.title}</Text>
                <View style={styles.headerRight}>
                  <AdminHeader />
                </View>
              </View>
            );
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={AdminHomeScreen}
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Manage"
          component={AdminManageScreen}
          options={{
            title: 'Manage',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-group-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Payments"
          component={AdminPaymentsScreen}
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
          name="Announcements"
          component={AdminAnnouncementsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="bullhorn-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60, // Increased top padding
    paddingBottom: 20,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    position: 'absolute',
    right: 16,
    top: 12, // Position it higher
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.grey[200],
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

export const AdminNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AdminTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
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
        name="TeamDetails"
        component={TeamDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}; 