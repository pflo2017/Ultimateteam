import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Dimensions } from 'react-native';

interface SuspendedClubBannerProps {
  clubName?: string;
  supportEmail?: string;
}

const SuspendedClubBanner: React.FC<SuspendedClubBannerProps> = ({ clubName, supportEmail = 'support@example.com' }) => {
  const handleContactSupport = () => {
    Linking.openURL(`mailto:${supportEmail}?subject=Club%20Suspension%20Inquiry${clubName ? '%20-%20' + encodeURIComponent(clubName) : ''}`);
  };

  const handleLogout = async () => {
    // You may want to call your signOut logic here
    // For now, just reload the app (or navigate to login)
    if (typeof window !== 'undefined') {
      window.location.reload();
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