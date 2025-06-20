import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchPlayerAttendanceStats } from '../services/attendanceService';

// Define proper types for better type safety
interface ActivityType {
  id: string;
  title: string;
  type: string;
}

interface AttendanceRecord {
  id: string;
  player_id: string;
  activity_id: string;
  status: 'present' | 'absent';
  note?: string;
  created_at?: string;
  base_activity_id?: string;
  activity_date?: string;
  activity?: ActivityType;
  actual_activity_date?: string;
  activity_title?: string;
  activity_type?: string;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  percentage: number;
  byType: Record<string, { present: number; absent: number }>;
}

const PlayerAttendanceReportScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { playerId, playerName, teamName, selectedMonth, selectedYear, selectedActivityType } = route.params as {
    playerId: string, playerName: string, teamName: string,
    selectedMonth: number, selectedYear: number, selectedActivityType: string
  };

  const [isLoading, setIsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ 
    present: 0, 
    absent: 0, 
    percentage: 0, 
    byType: {} 
  });
  const [error, setError] = useState<string | null>(null);

  // Safe date parsing function
  const parseActivityDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    
    try {
      // Try different date formats
      if (dateStr.length === 8) {
        // Format: YYYYMMDD
        const year = parseInt(dateStr.slice(0, 4));
        const month = parseInt(dateStr.slice(4, 6)) - 1; // 0-based month
        const day = parseInt(dateStr.slice(6, 8));
        return new Date(year, month, day);
      } else if (dateStr.includes('-')) {
        // Format: YYYY-MM-DD
        return new Date(dateStr);
      } else {
        // Try ISO string or other formats
        return new Date(dateStr);
      }
    } catch (e) {
      console.error('Error parsing date:', dateStr, e);
      return null;
    }
  };

  // Format date for display
  const formatDateForDisplay = (dateStr?: string): string => {
    if (!dateStr) return '';
    
    try {
      const date = parseActivityDate(dateStr);
      if (!date) return '';
      
      // Format as DD-MM-YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (e) {
      console.error('Error formatting date:', dateStr, e);
      return '';
    }
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching attendance for playerId:', playerId);
        
        // Calculate date range for the selected month
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
        
        // Format dates for the query
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
        
        // Use the new attendance service function that handles composite IDs correctly
        const attendanceData = await fetchPlayerAttendanceStats(
          playerId,
          undefined, // No team filter needed here
          startDateStr,
          endDateStr,
          selectedActivityType === 'all' ? undefined : selectedActivityType
        );
        
        if (!attendanceData || attendanceData.length === 0) {
          console.log('No attendance records found for player:', playerId);
          setAttendanceRecords([]);
          setFilteredRecords([]);
          setSummary({ present: 0, absent: 0, percentage: 0, byType: {} });
          setIsLoading(false);
          return;
        }
        
        console.log('DEBUG - PlayerAttendanceReportScreen - All attendance records:', JSON.stringify(attendanceData, null, 2));
        
        // Process the records with the actual_activity_date from our view
        const processedRecords = attendanceData.map((record: any) => {
          const actDate = new Date(record.actual_activity_date);
          const dateStr = `${actDate.getFullYear()}${(actDate.getMonth() + 1).toString().padStart(2, '0')}${actDate.getDate().toString().padStart(2, '0')}`;
          
          return {
            ...record,
            activity_date: dateStr,
            activity: {
              id: record.base_activity_id,
              title: record.activity_title,
              type: record.activity_type
            }
          };
        });
        
        // Sort by actual_activity_date descending
        processedRecords.sort((a: AttendanceRecord, b: AttendanceRecord) => {
          const dateA = new Date(a.actual_activity_date || '');
          const dateB = new Date(b.actual_activity_date || '');
          return dateB.getTime() - dateA.getTime();
        });
        
        setAttendanceRecords(processedRecords);
        
        // Filter by selected month, year, and activity type
        const filtered = processedRecords.filter((rec: AttendanceRecord) => {
          if (!rec.actual_activity_date) return false;
          
          const date = new Date(rec.actual_activity_date);
          
          const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
          const matchesType = selectedActivityType === 'all' || rec.activity_type === selectedActivityType;
                           
          return matchesMonth && matchesType;
        });
        
        console.log('DEBUG - PlayerAttendanceReportScreen - Filtered records:', JSON.stringify(filtered, null, 2));
        
        setFilteredRecords(filtered);
        
        // Calculate summary for filtered records
        let present = 0, absent = 0;
        const byType: Record<string, { present: number, absent: number }> = {};
        
        filtered.forEach((rec: AttendanceRecord) => {
          const type = rec.activity_type || 'other';
          
          if (!byType[type]) {
            byType[type] = { present: 0, absent: 0 };
          }
          
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
        console.error('Error in fetchAttendance:', err);
        setError('Failed to load attendance records. Please try again.');
        // Set empty defaults
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
  const getActivityTypeIcon = (type?: string): any => {
    if (!type) return 'calendar';
    
    switch (type.toLowerCase()) {
      case 'training': return 'whistle';
      case 'game': return 'trophy-outline';
      case 'tournament': return 'trophy';
      case 'other': return 'calendar-text';
      default: return 'calendar';
    }
  };
  
  // Helper to get activity type name
  const getActivityTypeName = (type?: string): string => {
    if (!type) return 'Other';
    
    switch (type.toLowerCase()) {
      case 'training': return 'Training';
      case 'game': return 'Game';
      case 'tournament': return 'Tournament';
      case 'other': return 'Other';
      default: return 'Other';
    }
  };
  
  // Helper to determine activity title
  const getActivityTitle = (record: AttendanceRecord): string => {
    // First try to use the activity title if available
    if (record.activity_title) {
      return record.activity_title;
    }
    
    // If no title, use the activity type
    if (record.activity_type) {
      return getActivityTypeName(record.activity_type);
    }
    
    // If we have a recurring activity with date suffix
    const activityId = record.activity_id || '';
    if (activityId.includes('-202')) {
      const baseId = activityId.substring(0, 36);
      if (baseId === '25b127e6-0402-4ae3-b520-9f6a14823c55') {
        return 'Training';
      }
    }
    
    // Last resort - check the icon type to determine a title
    const iconName = getActivityTypeIcon(record.activity_type);
    if (iconName === 'whistle') return 'Training';
    if (iconName === 'trophy-outline' || iconName === 'trophy') return 'Game';
    
    return 'Activity';
  };

  const deleteActivity = async (activityId: string) => {
    try {
      let idToDelete = activityId;
      
      // If it's an extended ID (has a date suffix), extract the base UUID
      if (activityId.includes('-') && activityId.length > 36) {
        idToDelete = activityId.substring(0, 36);
      }
      
      // Delete using the base UUID
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', idToDelete);
      
      // Also delete any attendance records with the full ID
      await supabase
        .from('activity_attendance')
        .delete()
        .eq('activity_id', activityId);
        
      // Delete any other related records
      await supabase
        .from('activity_presence')
        .delete()
        .eq('activity_id', activityId);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
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
            <Text style={styles.headerTitle}>{playerName || 'Player'}</Text>
            <Text style={styles.headerSubtitle}>{teamName || 'Team'}</Text>
          </View>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading player report...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
            <Text style={[styles.loadingText, { color: COLORS.error }]}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setIsLoading(true);
                setError(null);
                // Re-trigger the useEffect
                const timer = setTimeout(() => {
                  // This will re-trigger the useEffect
                  setIsLoading(false);
                }, 500);
                return () => clearTimeout(timer);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
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
                  <View key={rec.id || `record-${idx}`} style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons 
                          name={getActivityTypeIcon(rec.activity_type)} 
                          size={18} 
                          color={COLORS.primary} 
                          style={{ marginRight: 6 }} 
                        />
                        <Text style={styles.activityTitle}>{getActivityTitle(rec)}</Text>
                      </View>
                      <Text style={styles.activityDate}>
                        {rec.actual_activity_date ? new Date(rec.actual_activity_date).toLocaleDateString() : ''}
                      </Text>
                    </View>
                    <View style={styles.statusInfo}>
                      {rec.status === 'present' ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                      ) : (
                        <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                      )}
                      <Text 
                        style={[
                          styles.statusText, 
                          { color: rec.status === 'present' ? COLORS.success : COLORS.error }
                        ]}
                      >
                        {rec.status === 'present' ? 'Present' : 'Absent'}
                      </Text>
                      {rec.status === 'absent' && rec.note && (
                        <Text style={styles.reasonText}>
                          Reason: {rec.note}
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
  retryButton: {
    marginTop: SPACING.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '500',
  },
});

export default PlayerAttendanceReportScreen; 