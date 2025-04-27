import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../../constants/theme';

export const ParentChatScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Chat</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Communicate with coaches and team staff
        </Text>
      </View>

      <View style={styles.content}>
        <Text variant="bodyMedium" style={styles.placeholder}>
          Chat feature coming soon! You'll be able to communicate directly 
          with coaches and receive important team updates here.
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