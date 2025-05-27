import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttendanceScreen } from './AttendanceScreen';
import { AttendanceReportsScreen } from './AttendanceReportsScreen';

type TabType = 'create' | 'reports';

export const AttendanceTabsScreen = () => {
  const [activeTab, setActiveTab] = useState<TabType>('create');

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'left', 'top']}>
      <View style={styles.container}>
        <View style={styles.tabSelectorWrapper}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabType)}
            buttons={[
              {
                value: 'create',
                label: 'Create',
              },
              {
                value: 'reports',
                label: 'Reports',
              }
            ]}
            style={styles.segmentedButtons}
            theme={{
              colors: {
                primary: '#212121',
                secondaryContainer: '#EEFBFF',
                onSecondaryContainer: '#212121',
                outline: '#E0E0E0',
              },
            }}
          />
        </View>

        {activeTab === 'create' ? (
          <AttendanceScreen />
        ) : (
          <AttendanceReportsScreen />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabSelectorWrapper: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: COLORS.background,
    zIndex: 10,
    alignItems: 'center',
  },
  segmentedButtons: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 0,
    margin: 0,
    width: 320,
    height: 44,
  },
}); 