import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Dimensions, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SuspendedClubBannerProps {
  clubName?: string;
  supportEmail?: string;
  onLogout?: () => void;
}

const SuspendedClubBanner: React.FC<SuspendedClubBannerProps> = ({ clubName, supportEmail = 'support@example.com', onLogout }) => {
  const handleContactSupport = () => {
    Linking.openURL(`mailto:${supportEmail}?subject=Club%20Suspension%20Inquiry${clubName ? '%20-%20' + encodeURIComponent(clubName) : ''}`);
  };

  const handleLogout = async () => {
    try {
      console.log('[SUSPENSION BANNER] Starting logout process...');
      
      // Clear all stored data
      await AsyncStorage.multiRemove([
        'admin_data',
        'coach_data', 
        'parent_data',
        'user_role',
        'session_data'
      ]);
      console.log('[SUSPENSION BANNER] Cleared AsyncStorage data');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[SUSPENSION BANNER] Error signing out from Supabase:', error);
        Alert.alert('Error', 'Failed to sign out properly. Please try again.');
        return;
      }
      console.log('[SUSPENSION BANNER] Successfully signed out from Supabase');
      
      // Trigger role reload if available
      if (global.reloadRole && typeof global.reloadRole === 'function') {
        console.log('[SUSPENSION BANNER] Triggering role reload...');
        global.reloadRole();
      }
      
      if (onLogout) {
        onLogout();
      }
      
      // Show success message
      Alert.alert(
        'Logged Out',
        'You have been successfully logged out due to club suspension.',
        [
          {
            text: 'OK',
            onPress: () => {
              // The app should automatically redirect to login screen
              // due to the auth state change
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[SUSPENSION BANNER] Error during logout:', error);
      Alert.alert('Error', 'An error occurred during logout. Please try again.');
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.banner}>
        <Text style={styles.title}>Club Access Suspended</Text>
        <Text style={styles.message}>
          {clubName ? `${clubName} has been temporarily suspended.` : 'Your club has been temporarily suspended.'} {'\n'}
          Please contact support for more information.
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={handleContactSupport}>
            <Text style={styles.buttonText}>Contact Support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '90%',
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#b00020',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    backgroundColor: '#b00020',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    marginHorizontal: 6,
  },
  logoutButton: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SuspendedClubBanner; 