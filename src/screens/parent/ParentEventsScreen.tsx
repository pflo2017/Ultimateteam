import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../constants/theme';
import { ScheduleCalendar } from '../../components/Schedule/ScheduleCalendar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<ParentStackParamList>;

export const ParentEventsScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Empty handler since parents can't create activities
  const handleCreateActivity = () => {
    // This is never called for parents since the FAB is hidden
  };

  return (
    <View style={styles.container}>
      <ScheduleCalendar userRole="parent" onCreateActivity={handleCreateActivity} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
}); 