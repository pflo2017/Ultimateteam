import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';

const PlayerAttendanceReportScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { playerId, playerName, teamName, selectedMonth, selectedYear, selectedActivityType } = route.params as {
    playerId: string, playerName: string, teamName: string,
    selectedMonth: number, selectedYear: number, selectedActivityType: string
  };

  const [isLoading, setIsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, percentage: 0, byType: {} as Record<string, { present: number, absent: number }> });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching attendance for playerId:', playerId);
        // 1. Fetch all attendance records for the player
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('activity_attendance')
          .select('*')
          .eq('player_id', playerId);
        if (attendanceError) {
          console.error('Supabase error:', attendanceError);
          throw attendanceError;
        }
        // 2. Parse base activity UUIDs and dates
        const parsedRecords = (attendanceData || []).map((rec: any) => {
          const baseId = rec.activity_id.slice(0, 36);
          const dateStr = rec.activity_id.slice(37);
          return { ...rec, base_activity_id: baseId, activity_date: dateStr };
        });
        // 3. Fetch all activities for these base UUIDs
        const uniqueBaseIds = [...new Set(parsedRecords.map(r => r.base_activity_id))];
        let activitiesMap: Record<string, any> = {};
        if (uniqueBaseIds.length > 0) {
          const { data: activitiesData, error: activitiesError } = await supabase
            .from('activities')
            .select('id, title, type')
            .in('id', uniqueBaseIds);
          if (activitiesError) {
            console.error('Supabase error (activities):', activitiesError);
            throw activitiesError;
          }
          activitiesMap = (activitiesData || []).reduce((acc: Record<string, any>, act: any) => {
            acc[act.id] = act;
            return acc;
          }, {} as Record<string, any>);
        }
        // 4. Join attendance records with activity details
        const joinedRecords = parsedRecords.map((rec: any) => ({
          ...rec,
          activity: activitiesMap[rec.base_activity_id as string] || {},
        }));
        // 5. Sort by activity_date descending
        joinedRecords.sort((a, b) => {
          const aTime = a.activity_date ? new Date(a.activity_date).getTime() : 0;
          const bTime = b.activity_date ? new Date(b.activity_date).getTime() : 0;
          return bTime - aTime;
        });
        setAttendanceRecords(joinedRecords);
        // 6. Filter by selected month, year, and activity type
        const filtered = joinedRecords.filter((rec: any) => {
          if (!rec.activity_date) return false;
          const date = new Date(rec.activity_date.slice(0,4)+'-'+rec.activity_date.slice(4,6)+'-'+rec.activity_date.slice(6,8));
          const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
          const matchesType = selectedActivityType === 'all' || rec.activity?.type === selectedActivityType;
          return matchesMonth && matchesType;
        });
        setFilteredRecords(filtered);
        // 7. Calculate summary for filtered records
        let present = 0, absent = 0;
        const byType: Record<string, { present: number, absent: number }> = {};
        filtered.forEach((rec: any) => {
          const type = rec.activity?.type || 'other';
          if (!byType[type]) byType[type] = { present: 0, absent: 0 };
          if (rec.status === 'present') {
            present++;
            byType[type].present++;
          } else if (rec.status === 'absent') {
            absent++;
            byType[type].absent++;
          }
        });
        const percentage = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
        setSummary({ present, absent, percentage, byType });
      } catch (err: any) {
        setError('Failed to load attendance records.');
        setAttendanceRecords([]);
        setFilteredRecords([]);
        setSummary({ present: 0, absent: 0, percentage: 0, byType: {} });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttendance();
  }, [playerId, selectedMonth, selectedYear, selectedActivityType]);

  // Helper for activity type icon
  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'training': return 'whistle';
      case 'game': return 'trophy-outline';
      case 'tournament': return 'tournament';
      case 'other': return 'calendar-text';
      default: return 'calendar';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{playerName}</Text>
            <Text style={styles.headerSubtitle}>{teamName}</Text>
          </View>
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading player report...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{error}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Summary */}
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Attendance Summary</Text>
              <Text style={styles.summaryText}>Present: <Text style={styles.bold}>{summary.present}</Text></Text>
              <Text style={styles.summaryText}>Absent: <Text style={styles.bold}>{summary.absent}</Text></Text>
              <Text style={styles.summaryText}>Attendance Rate: <Text style={styles.bold}>{summary.percentage}%</Text></Text>
            </View>
            {/* Breakdown by type */}
            <View style={styles.breakdownContainer}>
              <Text style={styles.breakdownTitle}>By Activity Type</Text>
              {Object.entries(summary.byType).length === 0 ? (
                <Text style={styles.noDataText}>No activity types found.</Text>
              ) : (
                Object.entries(summary.byType).map(([type, val]) => (
                  <Text key={type} style={styles.breakdownText}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}: <Text style={styles.bold}>{val.present} present</Text>, <Text style={styles.bold}>{val.absent} absent</Text>
                  </Text>
                ))
              )}
            </View>
            {/* Detailed list */}
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>All Activities</Text>
              {filteredRecords.length === 0 ? (
                <Text style={styles.noDataText}>No attendance records found for this player in the selected period.</Text>
              ) : (
                filteredRecords.map((rec, idx) => (
                  <View key={rec.id || idx} style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name={getActivityTypeIcon(rec.activity?.type)} size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.activityTitle}>{rec.activity?.title}</Text>
                      </View>
                      <Text style={styles.activityDate}>{rec.activity_date ? `${rec.activity_date.slice(6,8)}-${rec.activity_date.slice(4,6)}-${rec.activity_date.slice(0,4)}` : ''}</Text>
                    </View>
                    <View style={styles.statusInfo}>
                      {rec.status === 'present' ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                      ) : (
                        <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                      )}
                      <Text style={[styles.statusText, { color: rec.status === 'present' ? COLORS.success : COLORS.error }]}>{rec.status === 'present' ? 'Present' : 'Absent'}</Text>
                      {rec.status === 'absent' && (
                        <Text style={styles.reasonText}>
                          Reason: {rec.note ? rec.note : (rec.activity?.type === 'game' ? 'No reason provided' : 'N/A')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.grey[200] },
  backButton: { marginRight: SPACING.md, padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.grey[600] },
  content: { padding: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, fontSize: 16, color: COLORS.grey[600] },
  summaryContainer: { marginBottom: SPACING.lg },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: SPACING.sm },
  summaryText: { fontSize: 16, marginBottom: 2 },
  bold: { fontWeight: 'bold' },
  breakdownContainer: { marginBottom: SPACING.lg },
  breakdownTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: SPACING.sm },
  breakdownText: { fontSize: 15, marginBottom: 2 },
  noDataText: { fontSize: 15, color: COLORS.grey[500], fontStyle: 'italic', marginBottom: 8 },
  listContainer: { marginBottom: SPACING.lg },
  listTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: SPACING.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.grey[100] },
  activityInfo: { flex: 2 },
  activityDate: { fontSize: 14, color: COLORS.grey[600] },
  activityType: { fontSize: 14, color: COLORS.primary },
  activityTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  statusInfo: { flex: 1, alignItems: 'flex-end' },
  statusText: { fontSize: 14, fontWeight: '500' },
  reasonText: { fontSize: 13, color: COLORS.error, marginTop: 2 },
});

export default PlayerAttendanceReportScreen; 