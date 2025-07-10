import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { ScheduleCalendar } from '../../components/Schedule/ScheduleCalendar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachStackParamList } from '../../navigation/CoachNavigator';
import { useTranslation } from 'react-i18next';

type NavigationProp = NativeStackNavigationProp<CoachStackParamList>;

export const CoachScheduleScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();

  const handleCreateActivity = () => {
    // Navigate directly to the CreateActivity screen
    navigation.navigate('CreateActivity', { type: 'practice' });
  };

  return (
    <View style={styles.container}>
      <ScheduleCalendar userRole="coach" onCreateActivity={handleCreateActivity} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
}); 