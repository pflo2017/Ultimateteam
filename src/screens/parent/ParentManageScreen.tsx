import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../../constants/theme';

export const ParentManageScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="bodyMedium" style={styles.placeholder}>
          Manage screen coming soon! Here you'll be able to view and manage 
          your child's activities and team participation.
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