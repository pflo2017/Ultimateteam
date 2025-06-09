import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, ScrollView, TouchableWithoutFeedback, Modal } from 'react-native';
import { Text, Button, Checkbox, FAB, TextInput, Menu } from 'react-native-paper';
import { Chip } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WeeklyCalendarCard } from '../components/Attendance/WeeklyCalendarCard';
import { ActivityTypeSelector } from '../components/Attendance/ActivityTypeSelector';
import { TeamSelector } from '../components/Attendance/TeamSelector';
import { ActivitySelector } from '../components/Attendance/ActivitySelector';
import { supabase } from '../lib/supabase';
import { 
  Activity, 
  ActivityType,
  getActivitiesByDateRange, 
  getPlayersByTeamId
} from '../services/activitiesService';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCoachInternalId } from '../utils/coachUtils';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { PieChart } from 'react-native-chart-kit';
import { CalendarPickerModal } from '../components/CalendarPickerModal';

type Player = {
  id: string;
  name: string;
  team_id: string;
};

type Team = {
  id: string;
  name: string;
};

type AttendanceStatus = 'present' | 'absent' | null;

type AttendanceRecord = {
  [playerId: string]: AttendanceStatus;
};

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

export const AttendanceScreen = () => {
  // Date and week state
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Activity states
  const [selectedType, setSelectedType] = useState<ActivityType | 'all'>('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  
  // Team states
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  // Player states
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Attendance states
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  
  // User role state
  const [userRole, setUserRole] = useState<'admin' | 'coach' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Add this near the other useState hooks:
  const [isSaving, setIsSaving] = useState(false);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);

  // Add to styles
  const activityTypeOptions = [
    { label: 'All', value: 'all' },
    { label: 'Training', value: 'training' },
    { label: 'Game', value: 'game' },
    { label: 'Tournament', value: 'tournament' },
    { label: 'Other', value: 'other' },
  ];

  // Add to AttendanceScreen component
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [filterTeamIds, setFilterTeamIds] = useState<string[]>([]);

  // Add at the top of the component, after useState hooks
  const [attendanceRecords, setAttendanceRecords] = useState<{ activity: Activity, records: any[] }[]>([]);
  const [isLoadingAttendanceRecords, setIsLoadingAttendanceRecords] = useState(false);

  // Add at the top of the component, after useState hooks
  const [isStatisticsModalVisible, setStatisticsModalVisible] = useState(false);
  const [statisticsMonthFilter, setStatisticsMonthFilter] = useState<'last_month' | 'last_3_months' | 'last_6_months' | 'custom'>('last_month');
  const [statisticsActivity, setStatisticsActivity] = useState<Activity | null>(null);

  // Add at the top of the component, after useState hooks
  const [statisticsData, setStatisticsData] = useState<any[]>([]);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);

  // Add at the top of the component, after useState hooks
  const [periodMenuVisible, setPeriodMenuVisible] = useState(false);
  const [activityTypeMenuVisible, setActivityTypeMenuVisible] = useState(false);
  const [customDateModalVisible, setCustomDateModalVisible] = useState(false);
  const [customRangeStep, setCustomRangeStep] = useState<'start' | 'end'>('start');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [statisticsActivityType, setStatisticsActivityType] = useState<ActivityType | 'all'>('all');

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Load user role on mount
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const adminData = await AsyncStorage.getItem('admin_data');
        const coachData = await AsyncStorage.getItem('coach_data');
        
        if (adminData) {
          setUserRole('admin');
          const admin = JSON.parse(adminData);
          setUserId(admin.id);
        } else if (coachData) {
          setUserRole('coach');
          const coach = JSON.parse(coachData);
          // Get the user ID from the auth session, not the coach ID
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserId(user.id);
          } else {
            setUserId(coach.id); // Fallback to coach ID if no user ID
          }
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };
    
    loadUserRole();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userRole) {
        loadTeams();
        loadActivities();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userRole, userId])
  );

  // Load activities for date range and type
  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedType, currentWeek]);

  // Load players when team is selected
  useEffect(() => {
    if (selectedTeam) {
      loadPlayers(selectedTeam.id);
    } else if (selectedTeam === null && teams.length > 0) {
      // When "All Teams" is selected, load players from all teams
      loadAllPlayers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  // Clear attendance when activity changes
  useEffect(() => {
    if (selectedActivity) {
      loadAttendance();
    } else {
      setAttendance({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActivity]);

  // Move fetchAttendanceRecords function above hooks and ensure it's only defined once
  const fetchAttendanceRecords = async (activityId?: string) => {
    setIsLoadingAttendanceRecords(true);
    try {
      // 1. Get activities for the selected date, team, and type
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      console.log('[AttendanceScreen] Fetching activities for week:', {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
        teamId: selectedTeam?.id,
        type: selectedType
      });
      const { data: activitiesData, error: activitiesError } = await getActivitiesByDateRange(
        weekStart.toISOString(),
        weekEnd.toISOString(),
        selectedTeam?.id
      );
      if (activitiesError) throw activitiesError;
      if (!activitiesData) {
        setAttendanceRecords([]);
        setIsLoadingAttendanceRecords(false);
        return;
      }
      console.log('[AttendanceScreen] Raw activities found:', activitiesData.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        date: a.start_time.split('T')[0]
      })));
      // Filter by type
      const filteredActivities = selectedType === 'all'
        ? activitiesData
        : activitiesData.filter(a => a.type === selectedType);
      console.log('[AttendanceScreen] After type filter:', filteredActivities.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        date: a.start_time.split('T')[0]
      })));
      // Filter by selected date
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log('[AttendanceScreen] Filtering for date:', selectedDateStr);
      const activitiesForDate = filteredActivities.filter(activity => {
        const activityDateStr = activity.start_time.split('T')[0];
        const matches = activityDateStr === selectedDateStr;
        console.log('[AttendanceScreen] Activity date check:', {
          activityId: activity.id,
          activityDate: activityDateStr,
          selectedDate: selectedDateStr,
          matches
        });
        return activityDateStr === selectedDateStr;
      });
      console.log('[AttendanceScreen] Final filtered activities:', activitiesForDate.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        date: a.start_time.split('T')[0]
      })));
      if (activitiesForDate.length === 0) {
        setAttendanceRecords([]);
        setIsLoadingAttendanceRecords(false);
        return;
      }
      
      // 2. Get all attendance records for these activities - use the FULL activity IDs
      const activityIds = activitiesForDate.map(a => a.id);
      console.log('[AttendanceScreen] Fetching attendance for activity IDs:', activityIds);
      
      // Use the full activity IDs to ensure each instance has its own attendance data
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('*, player:player_id (id, name)')
        .in('activity_id', activityIds);
        
      if (attendanceError) {
        console.error('[AttendanceScreen] Error fetching attendance records:', attendanceError);
        console.error('[AttendanceScreen] Error details:', JSON.stringify(attendanceError, null, 2));
        throw attendanceError;
      }
      
      // 3. Group attendance records by activity
      const grouped: Record<string, { activity: Activity, records: any[] }> = {};
      activitiesForDate.forEach(activity => {
        grouped[activity.id] = {
          activity,
          records: []
        };
      });
      
      (attendanceData || []).forEach(record => {
        const activityId = record.activity_id;
        // Find the exact activity that matches this record
        const activity = activitiesForDate.find(a => a.id === activityId);
        if (activity && grouped[activity.id]) {
          grouped[activity.id].records.push(record);
        }
      });
      
      console.log('[AttendanceScreen] Final grouped records:', Object.entries(grouped).map(([id, data]) => ({
        activityId: id,
        activityTitle: data.activity.title,
        activityType: data.activity.type,
        recordCount: data.records.length
      })));
      
      setAttendanceRecords(Object.values(grouped));
    } catch (error) {
      console.error('[AttendanceScreen] Error fetching attendance records:', error);
      setAttendanceRecords([]);
    } finally {
      setIsLoadingAttendanceRecords(false);
    }
  };

  useEffect(() => {
    fetchAttendanceRecords();
  }, [selectedDate, selectedType, selectedTeam, currentWeek]);

  useFocusEffect(
    useCallback(() => {
      fetchAttendanceRecords();
    }, [selectedDate, selectedType, selectedTeam, currentWeek])
  );

  // Week navigation
  const handlePrevWeek = () => {
    setCurrentWeek(prevWeek => subWeeks(prevWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prevWeek => addWeeks(prevWeek, 1));
  };

  // Load teams based on user role
  const loadTeams = async () => {
    try {
      setIsLoadingTeams(true);
      
      if (userRole === 'admin') {
        // For admins, get all active teams
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
          
        if (error) throw error;
        
        if (data) {
          setTeams(data);
          // If there's only one team, select it automatically
          if (data.length === 1) {
            setSelectedTeam(data[0]);
          }
        }
      } else if (userRole === 'coach') {
        // Get coach data from storage
        const coachDataRaw = await AsyncStorage.getItem('coach_data');
        const coachData = coachDataRaw ? JSON.parse(coachDataRaw) : null;
        const coachId = coachData?.id;

        if (!coachId) {
          console.error('No coach ID found in storage');
          setTeams([]);
          return;
        }

        const { data, error } = await supabase
          .rpc('get_coach_teams', {
            p_coach_id: coachId
          });
          
        if (error) throw error;
        
        if (data) {
          const formattedTeams = data.map((team: any) => ({
            id: team.team_id,
            name: team.team_name
          }));
          setTeams(formattedTeams);
          console.log('Teams for coach:', formattedTeams); // Debug log
          if (formattedTeams.length === 1) {
            setSelectedTeam(formattedTeams[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Load activities for the current week
  const loadActivities = async () => {
    try {
      setIsLoadingActivities(true);
      
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
      console.log('Loading activities from', format(weekStart, 'yyyy-MM-dd'), 'to', format(weekEnd, 'yyyy-MM-dd'));
      console.log('Selected date:', format(selectedDate, 'yyyy-MM-dd'));
      console.log('Selected type:', selectedType);
      console.log('Selected team:', selectedTeam?.id);
      
      // Always pass the selected team ID if available
      const { data, error } = await getActivitiesByDateRange(
        weekStart.toISOString(), 
        weekEnd.toISOString(),
        selectedTeam?.id // Pass the selected team ID
      );
      
      if (error) throw error;
      
      console.log('Activities found:', data?.length || 0);
      
      // Filter activities by type if needed
      const typeFilteredActivities = selectedType === 'all' 
        ? (data || [])
        : (data || []).filter(activity => activity.type === selectedType);
      
      console.log('Activities after type filtering:', typeFilteredActivities.length);
      setActivities(typeFilteredActivities);
      
      // Set filtered activities based on selected date
      if (selectedDate) {
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const activitiesForDate = typeFilteredActivities.filter(activity => {
          const activityDateStr = activity.start_time.split('T')[0];
          return activityDateStr === selectedDateStr;
        });
        
        console.log('Activities for selected date:', activitiesForDate.length);
        // Update the filtered activities for the current date
        setActivities(activitiesForDate);
        
        // If there are filtered activities, update the selectedActivity
        if (activitiesForDate.length > 0 && !selectedActivity) {
          setSelectedActivity(activitiesForDate[0]);
          await fetchAttendanceRecords(activitiesForDate[0].id);
        } else if (activitiesForDate.length === 0) {
          setSelectedActivity(null);
          setAttendanceRecords([]);
        }
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Load players for a specific team
  const loadPlayers = async (teamId: string) => {
    try {
      setIsLoadingPlayers(true);
      
      if (userRole === 'admin') {
        // For admin, fetch players directly
        const { data, error } = await supabase
          .from('players')
          .select('id, name, team_id')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('name');
          
        if (error) throw error;
        
        if (data) {
          setPlayers(data);
        }
      } else if (userRole === 'coach') {
        // Get the internal coach ID using the utility function
        const coachId = await getCoachInternalId();

        if (!coachId) {
          console.error('[AttendanceScreen] No coach ID found');
          setPlayers([]);
          return;
        }

        // For coach, use the get_coach_players function with the internal coach ID
        const { data, error } = await supabase
          .rpc('get_coach_players', { p_coach_id: coachId });

        console.log('[AttendanceScreen] get_coach_players data:', data, 'for coach ID:', coachId, 'and teamId:', teamId);

        if (error) {
          console.error('[AttendanceScreen] Error fetching players:', error);
          return;
        }

        if (data) {
          // Filter players for the selected team and transform to expected format
          const teamPlayers = data
            .filter((player: any) => player.team_id === teamId)
            .map((player: any) => ({
              id: player.player_id,
              name: player.player_name,
              team_id: player.team_id
            }));
          setPlayers(teamPlayers);
          console.log('[AttendanceScreen] Filtered teamPlayers:', teamPlayers);
        }
      }
    } catch (error) {
      console.error('[AttendanceScreen] Error loading players:', error);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Load players from all teams
  const loadAllPlayers = async () => {
    try {
      setIsLoadingPlayers(true);
      
      if (teams.length === 0) {
        setPlayers([]);
        return;
      }
      
      const teamIds = teams.map(team => team.id);
      
      const { data, error } = await supabase
        .from('players')
        .select('id, name, team_id')
        .in('team_id', teamIds)
        .eq('is_active', true)
        .order('name');
        
      if (error) throw error;
      
      if (data) {
        setPlayers(data);
      }
    } catch (error) {
      console.error('Error loading all players:', error);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Load attendance records for the selected activity
  const loadAttendance = async () => {
    if (!selectedActivity) return;
    
    try {
      setIsLoadingPlayers(true);
      
      // Use the FULL activity ID to ensure we're loading attendance for this specific instance
      const activityIdToUse = selectedActivity.id;
      
      const { data, error } = await supabase
        .from('activity_attendance')
        .select('*')
        .eq('activity_id', activityIdToUse);
        
      if (error) throw error;
      
      if (data) {
        // Convert the array of attendance records to an object keyed by player_id
        const attendanceMap = data.reduce((acc: AttendanceRecord, record) => {
          acc[record.player_id] = record.status;
          return acc;
        }, {});
        setAttendance(attendanceMap);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Toggle attendance status for a player
  const toggleAttendance = (playerId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [playerId]: status }));
  };

  // Filter players by search query
  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Update the handleSave function to use verify_coach_access instead of set_coach_access_code.
  const handleSave = async () => {
    if (!selectedActivity?.id) {
      Alert.alert('Error', 'Please select an activity first');
      return;
    }
    try {
      setIsSaving(true);
      
      // Use the FULL activity ID to ensure each instance has its own attendance data
      const activityIdToUse = selectedActivity.id;
      console.log('[AttendanceScreen] Using full activity ID for attendance:', activityIdToUse);

      // Get the auth user's ID
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[AttendanceScreen] Auth user ID:', user?.id);

      // Use auth user's ID for recorded_by as required by the database schema
      const attendanceRecorderId = user?.id;
      
      // Prepare data for upsert
      const attendanceRecords = Object.entries(attendance)
        .filter(([_, status]) => status !== null) // Only include players with a status
        .map(([playerId, status]) => ({
          activity_id: activityIdToUse,
          player_id: playerId,
          status: status,
          recorded_by: attendanceRecorderId, // Use auth user's ID as required by DB schema
          recorded_at: new Date().toISOString()
        }));

      console.log('[AttendanceScreen] Attendance records to save:', JSON.stringify(attendanceRecords, null, 2));
      
      if (attendanceRecords.length > 0) {
        const { error } = await supabase
          .from('activity_attendance')
          .upsert(attendanceRecords, { 
            onConflict: 'activity_id,player_id', 
            ignoreDuplicates: false
          });

        if (error) {
          console.error('[AttendanceScreen] Error saving attendance:', error);
          console.error('[AttendanceScreen] Full error details:', JSON.stringify(error, null, 2));
          throw error;
        }
        
        console.log('[AttendanceScreen] Attendance records successfully upserted');
      } else {
        console.log('[AttendanceScreen] No attendance records to save');
      }
      
      Alert.alert('Success', 'Attendance saved successfully');
    } catch (error) {
      console.error('[AttendanceScreen] Error saving attendance:', error);
      console.error('[AttendanceScreen] Full error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to save attendance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions for icons and labels (copy from ScheduleCalendar)
  const getActivityIcon = (type: ActivityType | 'all') => {
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
        return 'filter-variant-remove';
    }
  };
  const getActivityTypeLabel = (type: ActivityType | 'all') => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'game':
        return 'Game';
      case 'tournament':
        return 'Tournament';
      case 'other':
        return 'Other';
      case 'all':
        return 'All Types';
      default:
        return 'Event';
    }
  };
  const getActivityColor = (type: ActivityType | 'all') => {
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

  // Helper to get date range from dropdown
  const getStatisticsDateRange = () => {
    const now = new Date();
    let start: Date, end: Date;
    if (statisticsMonthFilter === 'last_month') {
      // Current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (statisticsMonthFilter === 'last_3_months') {
      // Last 3 months including current month
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (statisticsMonthFilter === 'last_6_months') {
      // Last 6 months including current month
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (statisticsMonthFilter === 'custom' && customStartDate && customEndDate) {
      start = customStartDate;
      end = customEndDate;
    } else {
      // Default to current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { start, end };
  };

  // Fetch statistics when modal opens or filters change
  useEffect(() => {
    if (!isStatisticsModalVisible) return;
    const fetchStatistics = async () => {
      setIsLoadingStatistics(true);
      setStatisticsError(null);
      try {
        const { start, end } = getStatisticsDateRange();
        let activityTypeParam = null;
        if (statisticsActivityType !== 'all') {
          activityTypeParam = statisticsActivityType;
        }
        const params = {
          p_start_date: start.toISOString(),
          p_end_date: end.toISOString(),
          p_team_id: selectedTeam?.id || null,
          p_activity_type: activityTypeParam // null for 'all', string for others
        };
        console.log('[get_attendance_stats] Supabase params:', params);
        const { data, error } = await supabase.rpc('get_attendance_stats', params);
        if (error) {
          console.error('[get_attendance_stats] Error:', error);
          throw error;
        }
        setStatisticsData(data || []);
      } catch (err: any) {
        setStatisticsError(err.message || 'Failed to load statistics');
        setStatisticsData([]);
        console.error('[get_attendance_stats] Fetch error:', err);
      } finally {
        setIsLoadingStatistics(false);
      }
    };
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatisticsModalVisible, statisticsMonthFilter, statisticsActivityType, customStartDate, customEndDate, selectedTeam]);

  // Calculate general stats
  const totalPresent = statisticsData.reduce((sum, a) => sum + (a.present_count || 0), 0);
  const totalAbsent = statisticsData.reduce((sum, a) => sum + (a.absent_count || 0), 0);
  const total = totalPresent + totalAbsent;
  const presentPercent = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
  const absentPercent = total > 0 ? Math.round((totalAbsent / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Calculate weekDates and eventDates for event dots */}
      {(() => {
        const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
        let d = new Date(weekStart);
        const weekDates: string[] = [];
        while (d <= weekEnd) {
          weekDates.push(format(new Date(d), 'yyyy-MM-dd'));
          d.setDate(d.getDate() + 1);
        }
        const eventDates = activities.map(a => a.start_time.split('T')[0]).filter((date, i, arr) => arr.indexOf(date) === i && weekDates.includes(date));
        return (
      <WeeklyCalendarCard
        currentDate={currentWeek}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
            eventDates={eventDates}
      />
        );
      })()}

      {/* Header row with Attendance title and filter icon */}
      <View style={styles.headerRow}>
        <Text style={styles.reportsTitle}>Reports</Text>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterIconButton}>
          <MaterialCommunityIcons name="filter" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Attendance Reports List for selected date */}
      <ScrollView style={styles.reportsList}>
        {isLoadingAttendanceRecords ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 12, color: COLORS.grey[600] }}>Loading attendance records...</Text>
            </View>
        ) : attendanceRecords.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={COLORS.grey[400]} />
            <Text style={{ marginTop: 12, color: COLORS.grey[600], fontSize: 16 }}>No attendance records for this date.</Text>
                  </View>
        ) : (
          attendanceRecords.map((record, idx) => {
            const presentCount = record.records.filter(r => r.status === 'present').length;
            const totalCount = record.records.length;
            return (
                      <TouchableOpacity 
                key={record.activity.id}
                style={[styles.reportCard, idx > 0 && { marginTop: 16 }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AttendanceReportDetails', { activityId: record.activity.id })}
              >
                <View style={styles.reportHeader}>
                  <MaterialCommunityIcons 
                    name={getActivityIcon(record.activity.type)} 
                    size={20} 
                    color={getActivityColor(record.activity.type)} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={styles.reportTitle} numberOfLines={1} ellipsizeMode="tail">{record.activity.title}</Text>
                  <Text style={styles.reportTime}>{format(new Date(record.activity.start_time), 'HH:mm')}</Text>
                    </View>
                {record.records.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.grey[600]} style={{ marginRight: 4 }} />
                    <Text style={styles.noAttendanceText}>No attendance marked yet</Text>
            </View>
          ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text style={styles.attendanceCount}>{presentCount}</Text>
                    <Text style={styles.attendanceSlash}>/</Text>
                    <Text style={styles.attendanceTotal}>{totalCount}</Text>
                    <Text style={styles.attendanceLabel}> present</Text>
            </View>
          )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* View Statistics Button */}
      <View style={{ alignItems: 'center', marginVertical: 16 }}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('AttendanceStatistics')}
          style={{ borderRadius: 8, paddingHorizontal: 32 }}
        >
          View Statistics
        </Button>
      </View>

      {/* Filter Modal (refactored to match ScheduleCalendar) */}
        <Modal
          visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.filterModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.filterModalContent}>
              <ScrollView>
                <Text style={styles.filterModalTitle}>Filter Activities</Text>
                <Text style={styles.filterModalSection}>Activity Type</Text>
                <View style={styles.filterChipRow}>
                  {(['all', 'training', 'game', 'tournament', 'other'] as (ActivityType | 'all')[]).map((type) => {
                    const isSelected = filterType === type;
                    const color = getActivityColor(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.chip,
                          isSelected && { backgroundColor: color, borderColor: color }
                        ]}
                        onPress={() => setFilterType(type)}
                      >
                        <MaterialCommunityIcons
                          name={getActivityIcon(type)}
                          size={16}
                          color={isSelected ? '#fff' : color}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[
                          styles.chipText,
                          isSelected && { color: '#fff' }
                        ]}>
                          {getActivityTypeLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.filterModalSection}>Teams</Text>
                <View style={styles.filterChipRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      filterTeamIds.length === 0 && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                    ]}
                    onPress={() => setFilterTeamIds([])}
                  >
                    <Text style={[
                      styles.chipText,
                      filterTeamIds.length === 0 && { color: '#fff' }
                    ]}>All Teams</Text>
                  </TouchableOpacity>
                  {teams.map(team => {
                    const isSelected = filterTeamIds.includes(team.id);
                    return (
                      <TouchableOpacity
                        key={team.id}
                        style={[
                          styles.chip,
                          isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                        ]}
                        onPress={() => {
                          setFilterTeamIds(prev =>
                            prev.includes(team.id)
                              ? prev.filter(id => id !== team.id)
                              : [...prev, team.id]
                          );
                        }}
                      >
                        <Text style={[
                          styles.chipText,
                          isSelected && { color: '#fff' }
                        ]}>{team.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                  <Button mode="contained" onPress={() => {
                    setFilterModalVisible(false);
                    setSelectedType(filterType);
                    setSelectedTeam(filterTeamIds.length > 0 ? teams.find(t => t.id === filterTeamIds[0]) || null : null);
                  }} style={styles.filterApplyButton}>
                  Apply Filters
                </Button>
              </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add the Statistics button at the bottom */}
      <View style={styles.statisticsButtonContainer}>
        <Button
          mode="contained"
          icon="chart-bar"
          onPress={() => navigation.navigate('StatisticsScreen')}
          style={styles.statisticsButton}
          labelStyle={styles.statisticsButtonLabel}
        >
          View Statistics
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16, // Add some bottom padding for the FAB
  },
  searchContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInput: {
    backgroundColor: COLORS.white,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: 8,
    borderColor: COLORS.grey[300],
  },
  bulkRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    justifyContent: 'space-between',
  },
  bulkButton: {
    flex: 1,
    marginRight: SPACING.xs,
    backgroundColor: COLORS.primary,
  },
  absentButton: {
    backgroundColor: COLORS.error,
    marginLeft: SPACING.xs,
    marginRight: 0,
  },
  playersContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 0,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  playerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  playerTeam: {
    fontSize: 13,
    color: COLORS.grey[600],
  },
  attendanceRadioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 150,
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentRadio: {
    borderColor: COLORS.primary,
  },
  absentRadio: {
    borderColor: COLORS.error,
  },
  radioButtonSelected: {
    borderWidth: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 12,
    marginLeft: 4,
    marginRight: 8,
    color: COLORS.text,
  },
  loadingContainer: {
    padding: SPACING.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
  },
  emptyContainer: {
    padding: SPACING.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
    fontSize: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#B6DFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  saveButtonText: {
    color: '#212121',
    fontWeight: '600',
    fontSize: 13,
  },
  playerCheckboxWrapper: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 3,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    height: 20,
    backgroundColor: '#fff',
  },
  playerCheckboxWrapperChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  fabSpacer: {
    height: 80, // Space for the FAB
  },
  playerList: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reportsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterIconButton: {
    padding: SPACING.xs,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  fabText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.primary,
  },
  closeButton: {
    padding: 4,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  reportsList: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    minHeight: 320,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterModalSection: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 32,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  filterApplyButton: {
    marginTop: 16,
  },
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginHorizontal: 8,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
  },
  reportTime: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: 8,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportPlayer: {
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
  },
  reportStatus: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  noAttendanceText: {
    color: COLORS.grey[600],
    fontSize: 14,
    fontStyle: 'italic',
  },
  attendanceCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  attendanceSlash: {
    fontSize: 16,
    color: COLORS.text,
    marginHorizontal: 2,
  },
  attendanceTotal: {
    fontSize: 16,
    color: COLORS.text,
  },
  attendanceLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: 4,
  },
  statisticsButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  statisticsButton: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  statisticsButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
}); 