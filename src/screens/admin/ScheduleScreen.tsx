import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { ScheduleCalendar } from '../../components/Schedule/ScheduleCalendar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList>;

export const AdminScheduleScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleCreateActivity = () => {
    // Navigate directly to the CreateActivity screen
    navigation.navigate('CreateActivity', { type: 'practice' });
  };

  return (
    <View style={styles.container}>
      <ScheduleCalendar userRole="admin" onCreateActivity={handleCreateActivity} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
}); 