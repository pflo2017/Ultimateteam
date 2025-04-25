import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';

export const CoachPostsScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Posts
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
  },
  title: {
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
}); 