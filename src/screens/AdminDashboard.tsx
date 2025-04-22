import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const AdminDashboard = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons 
          name="shield-account" 
          size={48} 
          color={COLORS.primary}
        />
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back!</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.xl * 2,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
  },
}); 