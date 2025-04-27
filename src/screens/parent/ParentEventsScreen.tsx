import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../../constants/theme';

export const ParentEventsScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="bodyMedium" style={styles.placeholder}>
          Events calendar coming soon! Here you'll be able to view upcoming 
          matches, training sessions, and team events.
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