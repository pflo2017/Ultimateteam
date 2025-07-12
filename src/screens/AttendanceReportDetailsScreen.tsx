import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
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
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const extractBaseActivityId = (id: string): string => {
  if (id.includes('-2025') || id.includes('-2024')) {
    return id.substring(0, 36);
  }
  return id;
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
  const [isSaving, setIsSaving] = useState(false);

  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
        const activityIdFromRoute = activityId;
        const selectedDate = (route.params as any)?.selectedDate;

        if (!selectedDate) {
          throw new Error("No date was provided to fetch attendance.");
        }
        
        console.log(`[AttendanceReportDetailsScreen] Fetching attendance for full, unique activity ID: ${activityIdFromRoute}`);

        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_with_correct_dates')
          .select('*')
          .eq('activity_id', activityIdFromRoute);
        
        if (attendanceError) throw attendanceError;
        
        console.log(`[AttendanceReportDetailsScreen] Attendance data:`, JSON.stringify(attendanceData, null, 2));
        
        const { data: activityData, error: activityError } = await getActivityById(activityId);
        if (activityError) throw activityError;
        
        let teamData = null;
        if (activityData?.team_id) {
          const { data, error: teamError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('id', activityData.team_id)
            .single();
          if (!teamError) teamData = data;
        }

        const teamPlayers = await getTeamPlayers(activityData?.team_id || '');
        const playerNameToIdMap: { [name: string]: string } = {};
        const playerIdToNameMap: { [id: string]: string } = {};
        teamPlayers.forEach(p => {
            playerNameToIdMap[p.name] = p.id;
            playerIdToNameMap[p.id] = p.name;
        });

        const initialAttendance = attendanceData.length > 0
            ? attendanceData
            : teamPlayers.map(p => ({ player_id: p.id, status: 'absent' }));

        setAttendance(initialAttendance);
        setActivity(activityData ? {
          id: activityData.id || '',
          title: activityData.title || '',
          type: activityData.type || 'other',
          start_time: activityData.start_time || '',
          team_id: activityData.team_id
        } : null);
        setTeam(teamData);
        setPlayerMap(playerIdToNameMap);
        
      } catch (err) {
        console.error("Error fetching attendance details:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [activityId, route.params]);

  const getTeamPlayers = async (teamId: string) => {
    if (!teamId) return [];
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('is_active', true);
    if (error) {
        console.error("Failed to fetch team players", error);
        return [];
    }
    return data;
  };
  
  const handleSetStatus = (playerId: string, newStatus: 'present' | 'absent') => {
    setAttendance(currentAttendance => {
      return currentAttendance.map(record => {
        if (record.player_id === playerId) {
          return { ...record, status: newStatus };
        }
        return record;
      });
    });
  };

  const handleSave = async () => {
    if (!activity) return;
    setIsSaving(true);
    try {
        const activityIdToSave = activity.id;
        const { data: { user } } = await supabase.auth.getUser();

        const recordsToUpsert = attendance.map(record => ({
            activity_id: activityIdToSave,
            player_id: record.player_id,
            status: record.status,
            actual_activity_date: activity.start_time,
            recorded_by: user?.id
        }));

        const { error } = await supabase
            .from('activity_attendance')
            .upsert(recordsToUpsert, { onConflict: 'activity_id, player_id' });

        if (error) throw error;
        
        console.log('Attendance saved successfully!');
        
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
                      restoreDate: activity.start_time,
                      activityId: activity.id,
                      refresh: true,
                    },
                  },
                },
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
                      restoreDate: activity.start_time,
                      activityId: activity.id,
                      refresh: true,
                    },
                  },
                },
              ],
            })
          );
        } else {
          navigation.goBack();
        }
    } catch (error) {
        console.error('Failed to save attendance', error);
        // Add alert here
    } finally {
        setIsSaving(false);
    }
  };

  const presentCount = attendance.filter((r) => r.status === 'present').length;
  const absentCount = attendance.filter((r) => r.status === 'absent').length;
  const total = attendance.length;
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[
        styles.header,
        Platform.OS === 'android' ? { paddingTop: insets.top + 16 } : null
      ]}>
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
        <Text style={styles.headerTitle}>{t('attendance.detailsTitle')}</Text>
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
        <View style={styles.content}>
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
            <Text style={styles.detailText}>{t('admin.activityForm.' + (activity?.type || attendance[0]?.activity_type))}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{presentCount}</Text><Text style={styles.summaryLabel}>Present</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{absentCount}</Text><Text style={styles.summaryLabel}>Absent</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryValue}>{attendanceRate}%</Text><Text style={styles.summaryLabel}>Rate</Text></View>
          </View>
          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Player Attendance</Text>
          <FlatList
            data={Object.entries(playerMap)}
            keyExtractor={([playerId]) => playerId}
            renderItem={({ item }) => {
              const [playerId, playerName] = item;
              const record = attendance.find(a => a.player_id === playerId);
              const status = record?.status || 'absent';
              return (
                <View key={playerId} style={styles.playerRow}>
                  <Text style={styles.playerName}>{playerName}</Text>
                  <View style={styles.statusButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        styles.presentButton,
                        status === 'present' && styles.presentButtonSelected,
                      ]}
                      onPress={() => handleSetStatus(playerId, 'present')}>
                      <Text
                        style={[
                          styles.statusButtonText,
                          status === 'present' && styles.selectedButtonText,
                        ]}>
                        Present
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        styles.absentButton,
                        status === 'absent' && styles.absentButtonSelected,
                      ]}
                      onPress={() => handleSetStatus(playerId, 'absent')}>
                      <Text
                        style={[
                          styles.statusButtonText,
                          status === 'absent' && styles.selectedButtonText,
                        ]}>
                        Absent
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <>
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
              </>
            }
          />
        </View>
      )}
      <SafeAreaView style={{ marginHorizontal: SPACING.md }}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={{ marginBottom: SPACING.md }}
        >
            {t('attendance.saveAttendance')}
        </Button>
      </SafeAreaView>
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
  playerName: { fontSize: 15, color: COLORS.text, flex: 1 },
  playerStatus: { fontSize: 15, fontWeight: '600' },
  present: { color: COLORS.primary },
  absent: { color: COLORS.error },
  createAttendanceButton: { marginTop: 32, alignSelf: 'center', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  statusButtonsContainer: {
    flexDirection: 'row',
  },
  statusButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 8,
    borderWidth: 1,
  },
  presentButton: {
    borderColor: COLORS.success,
  },
  presentButtonSelected: {
    backgroundColor: COLORS.success,
  },
  absentButton: {
    borderColor: COLORS.error,
  },
  absentButtonSelected: {
    backgroundColor: COLORS.error,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedButtonText: {
    color: COLORS.white,
  },
}); 