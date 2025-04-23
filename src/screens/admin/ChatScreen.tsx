import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';

export const AdminChatScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Team Chat</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  text: {
    fontSize: 20,
    color: COLORS.text,
  },
}); 