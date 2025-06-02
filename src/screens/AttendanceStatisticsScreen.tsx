import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const AttendanceStatisticsScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      // Here you would fetch actual attendance statistics from your API
      // For now we'll use dummy data
      setStats({
        totalAttendance: 85,
        averageAttendance: 92.5,
        attendanceByTeam: [
          { team: 'Team A', attendance: 95 },
          { team: 'Team B', attendance: 88 },
          { team: 'Team C', attendance: 75 },
        ]
      });
    } catch (error) {
      console.error('Error loading attendance statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={COLORS.text}
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle}>Attendance Statistics</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading statistics...</Text>
          </View>
        ) : (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>Total Attendance</Text>
              <Text style={styles.statValue}>{stats?.totalAttendance || 0}%</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>Average Attendance</Text>
              <Text style={styles.statValue}>{stats?.averageAttendance || 0}%</Text>
            </View>
            
            <Text style={styles.sectionTitle}>Attendance by Team</Text>
            {stats?.attendanceByTeam?.map((item: any, index: number) => (
              <View key={index} style={styles.teamStatRow}>
                <Text style={styles.teamName}>{item.team}</Text>
                <Text style={styles.teamStat}>{item.attendance}%</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    gap: SPACING.md,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statTitle: {
    fontSize: 16,
    color: COLORS.grey[600],
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  teamStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  teamName: {
    fontSize: 16,
    color: COLORS.text,
  },
  teamStat: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  }
});

export default AttendanceStatisticsScreen; 