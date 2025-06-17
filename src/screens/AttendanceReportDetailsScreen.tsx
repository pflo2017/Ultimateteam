import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Text, Divider, Button } from 'react-native-paper';
import { COLORS, SPACING } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Activity, getActivityById } from '../services/activitiesService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

// Utility function to extract the base UUID from a recurring activity ID
// NOTE: We're keeping this function for reference, but we'll now use the FULL activity ID
// to ensure each recurring instance has its own independent attendance data
const extractBaseActivityId = (id: string): string => {
  // Check if the ID has a date suffix (format: uuid-date)
  if (id.includes('-2025') || id.includes('-2024')) {
    // Extract the base UUID part (first 36 characters which is a standard UUID)
    return id.substring(0, 36);
  }
  return id;
};

// Helper function to capitalize first letter
const capitalize = (str: string | null | undefined) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Add helper functions for icon and color
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'training':
      return 'whistle';
    case 'game':
      return 'trophy-outline';
    case 'tournament':
      return 'tournament';
    case 'other':
      return 'calendar-text';
    default:
      return 'calendar';
  }
};
const getActivityColor = (type: string) => {
  switch (type) {
    case 'training':
      return '#4AADCC';
    case 'game':
      return '#E67E22';
    case 'tournament':
      return '#8E44AD';
    case 'other':
      return '#2ECC71';
    default:
      return COLORS.primary;
  }
};

type AttendanceRecord = {
  player_id: string;
  status: string;
  recorded_by?: string;
  recorded_at?: string;
  activity_title?: string;
  activity_type?: string;
  coach_name?: string;
  recorded_by_email?: string;
  players?: { name: string };
};

type ActivityInfo = {
  id: string;
  title: string;
  type: string;
  start_time: string;
  team_id?: string;
};

type TeamInfo = {
  id: string;
  name: string;
};

type AttendanceReportDetailsRouteParams = {
  activityId: string;
  selectedDate?: string;
};

export const AttendanceReportDetailsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<{ params: AttendanceReportDetailsRouteParams }, 'params'>>();
  const activityId = (route.params && (route.params as any).activityId) || '';
  const [userRole, setUserRole] = useState<'admin' | 'coach' | 'parent' | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [playerMap, setPlayerMap] = useState<{ [id: string]: string }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUserRole = async () => {
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(role as 'admin' | 'coach' | 'parent' | null);
    };
    loadUserRole();
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch attendance records using the new view
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_with_correct_dates')
          .select('*')
          .eq('activity_id', activityId);
        
        if (attendanceError) throw attendanceError;
        
        // Fetch activity details - use the full activity ID
        console.log(`Getting activity details for ID: ${activityId}`);
        const { data: activityData, error: activityError } = await getActivityById(activityId);
        
        if (activityError) throw activityError;
        
        // Fetch team details if we have a team_id
        let teamData = null;
        if (activityData?.team_id) {
          const { data, error: teamError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('id', activityData.team_id)
            .single();
          
          if (!teamError) teamData = data;
        }
        
        // Create a map of player IDs to names
        const playerIds = attendanceData.map(record => record.player_id);
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds);
        
        if (playersError) throw playersError;
        
        const playerNameMap: { [key: string]: string } = {};
        if (playersData) {
          playersData.forEach(player => {
            playerNameMap[player.id] = player.name;
          });
        }
        
        setAttendance(attendanceData);
        setActivity(activityData);
        setTeam(teamData);
        setPlayerMap(playerNameMap);
      } catch (err) {
        console.error('Failed to load attendance details:', err);
        setError('Failed to load attendance details.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (activityId) fetchAll();
  }, [activityId]);

  const presentCount = attendance.filter((r) => r.status === 'present').length;
  const absentCount = attendance.filter((r) => r.status === 'absent').length;
  const total = attendance.length;
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (route.params?.selectedDate) {
            if (userRole === 'admin') {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { 
                      name: 'AdminRoot',
                      params: {
                        screen: 'Attendance',
                        params: { 
                          restoreDate: route.params.selectedDate,
                          activityId: route.params.activityId
                        }
                      }
                    }
                  ],
                })
              );
            } else if (userRole === 'coach') {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { 
                      name: 'Coach',
                      params: {
                        screen: 'Attendance',
                        params: { 
                          restoreDate: route.params.selectedDate,
                          activityId: route.params.activityId
                        }
                      }
                    }
                  ],
                })
              );
            } else if (userRole === 'parent') {
              navigation.navigate('ParentNavigator', { screen: 'Events' });
            } else {
              navigation.goBack();
            }
          } else {
            navigation.goBack();
          }
        }} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Details</Text>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>{activity?.title || attendance[0]?.activity_title || 'Activity'}</Text>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calendar" size={20} color={COLORS.grey[700]} />
            <Text style={styles.detailText}>{activity?.start_time ? format(new Date(activity.start_time), 'EEE, MMM d, yyyy • HH:mm') : ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-group" size={20} color={COLORS.grey[700]} />
            <Text style={styles.detailText}>{team?.name || ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name={getActivityIcon(activity?.type || attendance[0]?.activity_type || 'other')}
              size={20}
              color={getActivityColor(activity?.type || attendance[0]?.activity_type || 'other')}
            />
            <Text style={styles.detailText}>{capitalize(activity?.type || attendance[0]?.activity_type)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{presentCount}</Text><Text style={styles.summaryLabel}>Present</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{absentCount}</Text><Text style={styles.summaryLabel}>Absent</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{attendanceRate}%</Text><Text style={styles.summaryLabel}>Rate</Text></View>
          </View>
          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Player Attendance</Text>
          {attendance.map((record, idx) => (
            <View key={`player-${idx}`} style={styles.playerRow}>
              <Text style={styles.playerName}>
                {playerMap[record.player_id] || record.player_id || 'Unknown'}
              </Text>
              <Text style={[styles.playerStatus, { fontWeight: '400' }, record.status === 'present' ? styles.present : styles.absent]}>
                {capitalize(record.status)}
              </Text>
            </View>
          ))}
          {/* Show recorded by and at if available */}
          {attendance[0]?.coach_name && (
            <View style={{ marginTop: SPACING.md, backgroundColor: COLORS.grey[100], borderRadius: 6, padding: SPACING.sm }}>
              <Text style={{ fontSize: 12, color: COLORS.grey[700] }}>
                Recorded by: {attendance[0]?.coach_name}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.grey[500], marginTop: 2 }}>
                {attendance[0]?.recorded_at ? format(new Date(attendance[0]?.recorded_at), 'MMM d, yyyy h:mm a') : ''}
              </Text>
            </View>
          )}
          {/* Show Create Attendance button if no attendance is marked */}
          {attendance.length === 0 && (
            <Button
              mode="contained"
              style={styles.createAttendanceButton}
              onPress={() => {
                if (activity) {
                  navigation.navigate('AddAttendance', { 
                    activityId: activity.id, 
                    teamId: activity.team_id 
                  });
                }
              }}
            >
              Create Attendance
            </Button>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.grey[200] },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.error, fontSize: 16 },
  content: { flex: 1, padding: SPACING.md },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { fontSize: 16, color: COLORS.text, marginLeft: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: SPACING.md },
  summaryBox: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  summaryLabel: { fontSize: 13, color: COLORS.grey[600] },
  divider: { marginVertical: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grey[200] },
  playerName: { fontSize: 15, color: COLORS.text },
  playerStatus: { fontSize: 15, fontWeight: '600' },
  present: { color: COLORS.primary },
  absent: { color: COLORS.error },
  createAttendanceButton: { marginTop: 32, alignSelf: 'center', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
}); 