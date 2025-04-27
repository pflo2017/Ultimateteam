import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../../constants/theme';

export const ParentDashboardScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Welcome</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Stay connected with your child's sports journey
        </Text>
      </View>

      <View style={styles.content}>
        {/* TODO: Add dashboard content like:
          - Child's upcoming matches
          - Recent team announcements
          - Training schedule
          - Quick actions
        */}
        <Text variant="bodyMedium" style={styles.placeholder}>
          Your dashboard is coming soon! Here you'll be able to view your child's activities, 
          team updates, and manage your account.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    backgroundColor: COLORS.primary,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    textAlign: 'center',
    color: COLORS.grey[600],
  },
}); 