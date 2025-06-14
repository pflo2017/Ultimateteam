import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity, TextInput as RNTextInput, Alert, Modal, FlatList, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Text, Card, Button, Chip, SegmentedButtons, Portal, Menu, IconButton, Divider, TextInput as PaperTextInput } from 'react-native-paper';
import { FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getUserClubId } from '@/services/activitiesService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import { TeamSelector } from '@/components/Attendance/TeamSelector';
import { ActivityTypeSelector } from '@/components/Attendance/ActivityTypeSelector';
import { 
  FilterPreset,
  ColumnConfig,
  AttendanceSummary
} from '@/types/attendance';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TeamFilterModal } from '../components/Teams/TeamFilterModal';
import { COLORS, SPACING } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO, addMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, differenceInMinutes, isBefore, isAfter, isSameDay, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

// Define types
type Team = {
  id: string;
  name: string;
  is_active?: boolean;
  club_id?: string;
};

type ActivityType = 'training' | 'game' | 'tournament' | 'other';
type AttendanceStatus = 'present' | 'absent' | 'excused';

interface AttendanceRecord {
  id: string;
  activity_id: string;
  player_id: string;
  player_name: string;
  status: AttendanceStatus;
  recorded_by: string;
  recorded_at: string;
}

interface AttendanceStats {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  total_activities: number;
  attended: number;
  excused: number;
  absent: number;
  attendance_rate: number;
}

interface GroupedActivity {
  id: string;
  title: string;
  type: ActivityType;
  date: string;
  team: string;
  records: AttendanceRecord[];
}

export const AttendanceReportsScreen = () => {
  // State for teams
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  // State for filters
  const [selectedType, setSelectedType] = useState<ActivityType | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });

  // State for data
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for selected activity details
  const [selectedActivity, setSelectedActivity] = useState<GroupedActivity | null>(null);
  const [showActivityDetails, setShowActivityDetails] = useState(false);

  // New state for enhanced filtering
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<('present' | 'absent')[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'date', label: 'Date', visible: true, sortable: true },
    { id: 'activity', label: 'Activity', visible: true, sortable: true },
    { id: 'type', label: 'Type', visible: true, sortable: true },
    { id: 'team', label: 'Team', visible: true, sortable: true },
    { id: 'player', label: 'Player', visible: true, sortable: true },
    { id: 'status', label: 'Status', visible: true, sortable: true },
    { id: 'recorded_by', label: 'Recorded By', visible: true, sortable: true },
    { id: 'recorded_at', label: 'Recorded At', visible: true, sortable: true },
  ]);

  // Quick filter presets
  const quickDateRanges = [
    { label: 'Last 7 days', range: { start: subDays(new Date(), 7), end: new Date() } },
    { label: 'Last 30 days', range: { start: subDays(new Date(), 30), end: new Date() } },
    { label: 'This month', range: { start: startOfMonth(new Date()), end: endOfMonth(new Date()) } },
    { label: 'Last month', range: { start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) } },
  ];

  // Add state for team filter modal
  const [showTeamFilter, setShowTeamFilter] = useState(false);

  // Add user role state
  const [userRole, setUserRole] = useState<'admin' | 'coach' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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

  // Load teams when user role is set
  useEffect(() => {
    if (userRole) {
      loadTeams();
    }
  }, [userRole, userId]);

  // Load data when filters change
  useEffect(() => {
    if (teams.length > 0 && dateRange.start && dateRange.end) {
      loadAttendanceRecords();
    }
  }, [teams, selectedTeam, selectedType, dateRange]);

  // Load teams based on user role
  const loadTeams = async () => {
    try {
      setIsLoadingTeams(true);
      console.log('[AttendanceReportsScreen] Loading teams for user role:', userRole);
      
      // Get user's club_id - this ensures data isolation
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('[AttendanceReportsScreen] No club ID found for user');
        setTeams([]);
        return;
      }
      
      console.log('[AttendanceReportsScreen] Using club ID for data isolation:', clubId);
      
      // Try the new get_user_teams_direct function first
      console.log('[AttendanceReportsScreen] RPC QUERY: Calling get_user_teams_direct()');
      const { data: directTeams, error: directError } = await supabase
        .rpc('get_user_teams_direct');
      
      console.log('[AttendanceReportsScreen] DIRECT TEAMS RPC RESULT:', directTeams);
      
      if (directTeams && directTeams.length > 0) {
        console.log('[AttendanceReportsScreen] Using teams from get_user_teams_direct()');
        setTeams(directTeams);
        return;
      }
      
      if (directError) {
        console.error('[AttendanceReportsScreen] Error from get_user_teams_direct:', directError);
      }
      
      // If direct function fails, try the get_teams_by_club_direct function
      console.log('[AttendanceReportsScreen] RPC QUERY: Calling get_teams_by_club_direct() with clubId:', clubId);
      const { data: clubDirectTeams, error: clubDirectError } = await supabase
        .rpc('get_teams_by_club_direct', { p_club_id: clubId });
      
      console.log('[AttendanceReportsScreen] CLUB DIRECT TEAMS RPC RESULT:', clubDirectTeams);
      
      if (clubDirectTeams && clubDirectTeams.length > 0) {
        console.log('[AttendanceReportsScreen] Using teams from get_teams_by_club_direct()');
        setTeams(clubDirectTeams);
        return;
      }
      
      if (clubDirectError) {
        console.error('[AttendanceReportsScreen] Error from get_teams_by_club_direct:', clubDirectError);
      }
      
      // Last resort: direct query with club_id filter
      console.log('[AttendanceReportsScreen] DIRECT QUERY: Using direct teams query with club_id filter');
      const { data: directQueryTeams, error: directQueryError } = await supabase
        .from('teams')
        .select('id, name, is_active, club_id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      console.log('[AttendanceReportsScreen] DIRECT QUERY TEAMS RESULT:', directQueryTeams);
      
      if (directQueryTeams && directQueryTeams.length > 0) {
        console.log('[AttendanceReportsScreen] Using teams from direct query');
        setTeams(directQueryTeams);
      } else {
        console.log('[AttendanceReportsScreen] No teams found through any method');
        setTeams([]);
      }
    } catch (error) {
      console.error('[AttendanceReportsScreen] Error loading teams:', error);
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Load detailed attendance records
  const loadAttendanceRecords = async () => {
    try {
      setIsLoading(true);
      console.log('[AttendanceReportsScreen] Loading attendance records...');
      console.log('[AttendanceReportsScreen] Selected team:', selectedTeam);
      console.log('[AttendanceReportsScreen] Date range:', dateRange.start.toISOString(), 'to', dateRange.end.toISOString());
      console.log('[AttendanceReportsScreen] Selected type:', selectedType);
      
      // Get user's club_id for data isolation
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('[AttendanceReportsScreen] No club ID found for user');
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }
      
      // Cast the activity_type to explicitly handle the type compatibility
      let activityTypeParam = null;
      if (selectedType !== 'all') {
        activityTypeParam = selectedType;
      }
      
      // Try the new get_attendance_reports_by_club function
      console.log('[AttendanceReportsScreen] RPC QUERY: Calling get_attendance_reports_by_club()');
      
      const params: any = {
        p_club_id: clubId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      };
      
      if (selectedTeam) {
        params.p_team_id = selectedTeam.id;
      }
      
      if (activityTypeParam) {
        params.p_activity_type = activityTypeParam;
      }
      
      const { data: reportData, error: reportError } = await supabase
        .rpc('get_attendance_reports_by_club', params);
      
      console.log('[AttendanceReportsScreen] REPORT DATA COUNT:', reportData?.length || 0);
      
      if (reportError) {
        console.error('[AttendanceReportsScreen] Error from get_attendance_reports_by_club:', reportError);
        
        // Fall back to the old method if the RPC fails
        console.log('[AttendanceReportsScreen] Falling back to manual query method');
        await loadAttendanceRecordsLegacy();
        return;
      }
      
      if (!reportData || reportData.length === 0) {
        console.log('[AttendanceReportsScreen] No attendance records found');
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }
      
      // Process the report data
      const groupedActivities: { [key: string]: GroupedActivity } = {};
      
      reportData.forEach((record: any) => {
        const activityId = record.activity_id;
        
        if (!groupedActivities[activityId]) {
          groupedActivities[activityId] = {
            id: activityId,
            title: record.activity_title,
            type: record.activity_type as ActivityType,
            date: format(parseISO(record.activity_start_time), 'yyyy-MM-dd'),
            team: record.team_name,
            records: []
          };
        }
        
        groupedActivities[activityId].records.push({
          id: `${activityId}-${record.player_id}`,
          activity_id: activityId,
          player_id: record.player_id,
          player_name: record.player_name,
          status: record.attendance_status as AttendanceStatus,
          recorded_by: record.recorded_by,
          recorded_at: record.recorded_at
        });
      });
      
      const activitiesList = Object.values(groupedActivities);
      console.log('[AttendanceReportsScreen] Processed activities count:', activitiesList.length);
      
      setAttendanceRecords(activitiesList);
    } catch (error) {
      console.error('[AttendanceReportsScreen] Error loading attendance records:', error);
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Legacy method for loading attendance records (as fallback)
  const loadAttendanceRecordsLegacy = async () => {
    try {
      console.log('[AttendanceReportsScreen] Using legacy method for loading attendance records');
      
      // Get user's club_id for data isolation
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('[AttendanceReportsScreen] No club ID found for user');
        setAttendanceRecords([]);
        return;
      }
      
      // Cast the activity_type to explicitly handle the type compatibility
      let activityTypeParam = null;
      if (selectedType !== 'all') {
        activityTypeParam = selectedType;
      }
      
      // Step 1: Get activities for the selected team(s) and date range
      let activitiesQuery = supabase
        .from('activities')
        .select('id, title, type, start_time, team_id')
        .eq('club_id', clubId) // CRITICAL: Always filter by club_id for data isolation
        .gte('start_time', dateRange.start.toISOString())
        .lte('start_time', dateRange.end.toISOString());
        
      // Apply team filter if a specific team is selected
      if (selectedTeam) {
        console.log('[AttendanceReportsScreen] Filtering by team:', selectedTeam.id);
        activitiesQuery = activitiesQuery.eq('team_id', selectedTeam.id);
      } else if (teams.length > 0) {
        // If "All Teams" is selected, include all teams the user has access to
        const teamIds = teams.map(team => team.id);
        console.log('[AttendanceReportsScreen] Filtering by all teams:', teamIds);
        activitiesQuery = activitiesQuery.in('team_id', teamIds);
      } else {
        // No teams available
        console.log('[AttendanceReportsScreen] No teams available');
        setAttendanceRecords([]);
        return;
      }
      
      const { data: activitiesData, error: activitiesError } = await activitiesQuery;
        
      if (activitiesError) {
        console.error('[AttendanceReportsScreen] Error loading activities:', activitiesError);
        throw activitiesError;
      }
      
      console.log('[AttendanceReportsScreen] Activities found:', activitiesData?.length || 0);
      
      // Filter by activity type if needed
      let filteredActivities = activitiesData || [];
      if (activityTypeParam && filteredActivities.length > 0) {
        filteredActivities = filteredActivities.filter(activity => 
          activity.type === activityTypeParam
        );
        console.log('[AttendanceReportsScreen] Activities after type filter:', filteredActivities.length);
      }
      
      if (filteredActivities.length === 0) {
        console.log('[AttendanceReportsScreen] No activities match the criteria');
        setAttendanceRecords([]);
        return;
      }
      
      // Step 2: Get all attendance records for these activities
      const activityIds = filteredActivities.map(a => a.id);
      console.log('[AttendanceReportsScreen] Searching for attendance records for activities:', activityIds);
      
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('id, activity_id, player_id, status, recorded_by, recorded_at')
        .in('activity_id', activityIds);
        
      if (attendanceError) {
        console.error('[AttendanceReportsScreen] Error loading attendance records:', attendanceError);
        throw attendanceError;
      }
      
      if (!attendanceData || attendanceData.length === 0) {
        console.log('[AttendanceReportsScreen] No attendance records found for the selected activities');
        setAttendanceRecords([]);
        return;
      }
      
      console.log(`[AttendanceReportsScreen] Found ${attendanceData.length} attendance records`);
      
      // Step 3: Get player details for these records
      const playerIds = [...new Set(attendanceData.map(record => record.player_id))];
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', playerIds);
        
      if (playersError) {
        console.error('[AttendanceReportsScreen] Error loading players:', playersError);
        throw playersError;
      }
      
      // Also fetch team details for each activity
      const teamIds = [...new Set(filteredActivities.map(a => a.team_id))];
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
        
      if (teamsError) {
        console.error('[AttendanceReportsScreen] Error loading teams:', teamsError);
        throw teamsError;
      }
      
      // Create maps for faster lookups
      const playerMap: { [key: string]: string } = {};
      playersData?.forEach(player => {
        playerMap[player.id] = player.name;
      });
      
      const teamMap: { [key: string]: string } = {};
      teamsData?.forEach(team => {
        teamMap[team.id] = team.name;
      });
      
      const activityMap: { [key: string]: any } = {};
      filteredActivities.forEach(activity => {
        activityMap[activity.id] = activity;
      });
      
      // Group attendance records by activity
      const groupedActivities: { [key: string]: GroupedActivity } = {};
      
      attendanceData.forEach((record: any) => {
        const activityId = record.activity_id;
        const activity = activityMap[activityId];
        
        if (!activity) {
          console.warn(`[AttendanceReportsScreen] Activity not found for record:`, record);
          return;
        }
        
        if (!groupedActivities[activityId]) {
          groupedActivities[activityId] = {
            id: activityId,
            title: activity.title,
            type: activity.type as ActivityType,
            date: format(parseISO(activity.start_time), 'yyyy-MM-dd'),
            team: teamMap[activity.team_id] || 'Unknown Team',
            records: []
          };
        }
        
        groupedActivities[activityId].records.push({
          id: record.id,
          activity_id: activityId,
          player_id: record.player_id,
          player_name: playerMap[record.player_id] || 'Unknown Player',
          status: record.status as AttendanceStatus,
          recorded_by: record.recorded_by,
          recorded_at: record.recorded_at
        });
      });
      
      const activitiesList = Object.values(groupedActivities);
      console.log('[AttendanceReportsScreen] Processed activities count:', activitiesList.length);
      
      setAttendanceRecords(activitiesList);
    } catch (error) {
      console.error('[AttendanceReportsScreen] Error in legacy attendance records loading:', error);
      setAttendanceRecords([]);
    }
  };

  // Load attendance statistics
  const loadAttendanceStats = async () => {
    try {
      setIsLoading(true);
      
      // Cast the activity_type to explicitly handle the type compatibility
      let activityTypeParam = null;
      if (selectedType !== 'all') {
        activityTypeParam = selectedType;
      }
      
      const { data, error } = await supabase
        .rpc('get_attendance_stats', {
          p_start_date: dateRange.start.toISOString(),
          p_end_date: dateRange.end.toISOString(),
          p_team_id: selectedTeam?.id,
          p_activity_type: activityTypeParam
        });

      if (error) {
        console.error('Error loading attendance statistics:', error);
        throw error;
      }
      
      if (data) {
        setAttendanceStats(data);
      }
    } catch (error) {
      console.error('Error loading attendance statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group records by activity 
  const groupedActivities = useMemo(() => {
    const grouped: Record<string, GroupedActivity> = {};
    
    // Skip grouping if records don't have the expected structure
    if (attendanceRecords.length > 0 && !('activity_id' in attendanceRecords[0])) {
      return attendanceRecords as GroupedActivity[];
    }
    
    attendanceRecords.forEach((record: any) => {
      if (!grouped[record.activity_id]) {
        grouped[record.activity_id] = {
          id: record.activity_id,
          title: record.activity_title,
          type: record.activity_type,
          date: record.activity_date,
          team: record.team_name,
          records: []
        };
      }
      grouped[record.activity_id].records.push(record);
    });
    
    // Sort by date (newest first)
    return Object.values(grouped).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [attendanceRecords]);

  // Handle activity card tap
  const handleActivityPress = (activity: GroupedActivity) => {
    // Navigate to the activity detail screen with the correct parameters
    navigation.navigate('AttendanceReportDetails', { 
      activityId: activity.id
    });
  };

  // Get icon for activity type
  const getActivityTypeIcon = (type: ActivityType) => {
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

  // Get color for activity type
  const getActivityTypeColor = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return COLORS.primary;
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

  // Render activity cards
  const renderActivityCards = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Loading attendance records...</Text>
        </View>
      );
    }

    if (attendanceRecords.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attendance records found for the selected criteria.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={attendanceRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.activityCard}
            onPress={() => handleActivityPress(item)}
          >
            <View style={styles.activityHeader}>
              <View style={styles.activityTypeContainer}>
                {getActivityTypeIcon(item.type)}
                <Text style={styles.activityType}>{getActivityTypeLabel(item.type)}</Text>
              </View>
              <Text style={styles.activityDate}>{item.date}</Text>
            </View>
            <Text style={styles.activityTitle}>{item.title}</Text>
            <Text style={styles.teamName}>{item.team}</Text>
            <View style={styles.attendanceStats}>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{item.records.filter((r: AttendanceRecord) => r.status === 'present').length}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{item.records.filter((r: AttendanceRecord) => r.status === 'excused').length}</Text>
                <Text style={styles.statLabel}>Excused</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{item.records.filter((r: AttendanceRecord) => r.status === 'absent').length}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{item.records.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  // Add month selection handler
  const handleMonthChange = (newMonth: Date) => {
    setSelectedMonth(newMonth);
    setDateRange({
      start: startOfMonth(newMonth),
      end: endOfMonth(newMonth)
    });
  };

  // Generate months for the full year
  const generateMonthOptions = () => {
    const months = [];
    const currentYear = selectedMonth.getFullYear();
    
    // Generate all 12 months for the current year
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthDate = new Date(currentYear, monthIndex, 1);
      months.push({
        date: monthDate,
        label: format(monthDate, 'MMMM yyyy')
      });
    }
    
    return months;
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

  // Function to get team name or "All Teams" if null
  const getTeamName = () => {
    return selectedTeam ? selectedTeam.name : 'All Teams';
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: 0 }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl }}>
      {/* Filter row - modern design matching Schedule page */}
      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          {/* Team Selector */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowTeamFilter(true)}
          >
            <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {getTeamName()}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>

          {/* Activity Type Selector */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowTypeFilter(true)}
          >
            <MaterialCommunityIcons name="filter-variant" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {getActivityTypeLabel(selectedType)}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
        </View>

        <View style={styles.filtersRow}>
          {/* Month Selector */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowMonthFilter(true)}
          >
            <MaterialCommunityIcons name="calendar-month" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {format(selectedMonth, 'MMMM yyyy')}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Activity Cards */}
      {renderActivityCards()}
      </ScrollView>

      {/* Team Filter Modal - This component ensures proper data isolation by filtering teams by club_id */}
      <TeamFilterModal
        visible={showTeamFilter}
        onClose={() => setShowTeamFilter(false)}
        onSelectTeam={(team) => setSelectedTeam(team)}
        selectedTeam={selectedTeam}
        styles={styles}
      />

      {/* Activity Type Filter Modal */}
      <Modal
        visible={showTypeFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTypeFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Activity Type</Text>
              <TouchableOpacity 
                onPress={() => setShowTypeFilter(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'all' && styles.optionSelected]}
              onPress={() => { setSelectedType('all'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="filter-variant-remove" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'all' && styles.optionTextSelected]}>All Types</Text>
              </View>
              {selectedType === 'all' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'training' && styles.optionSelected]}
              onPress={() => { setSelectedType('training'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="whistle" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'training' && styles.optionTextSelected]}>Training</Text>
              </View>
              {selectedType === 'training' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'game' && styles.optionSelected]}
              onPress={() => { setSelectedType('game'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="trophy-outline" size={20} color={'#E67E22'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'game' && styles.optionTextSelected]}>Game</Text>
              </View>
              {selectedType === 'game' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'tournament' && styles.optionSelected]}
              onPress={() => { setSelectedType('tournament'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="tournament" size={20} color={'#8E44AD'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'tournament' && styles.optionTextSelected]}>Tournament</Text>
              </View>
              {selectedType === 'tournament' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'other' && styles.optionSelected]}
              onPress={() => { setSelectedType('other'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-text" size={20} color={'#2ECC71'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'other' && styles.optionTextSelected]}>Other</Text>
              </View>
              {selectedType === 'other' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Month Filter Modal */}
      <Modal
        visible={showMonthFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMonthFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity 
                onPress={() => setShowMonthFilter(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {generateMonthOptions().map((monthOption, index) => {
                const isSelected = 
                  monthOption.date.getMonth() === selectedMonth.getMonth() && 
                  monthOption.date.getFullYear() === selectedMonth.getFullYear();
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionItem, isSelected && styles.optionSelected]}
                    onPress={() => { 
                      setSelectedMonth(monthOption.date);
                      setDateRange({
                        start: startOfMonth(monthOption.date),
                        end: endOfMonth(monthOption.date)
                      });
                      setShowMonthFilter(false); 
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="calendar-month" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{monthOption.label}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 2,
    backgroundColor: COLORS.background,
  },
  headerIconButton: {
    minWidth: 0,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    borderRadius: 6,
    height: 36,
  },
  headerIconLabel: {
    fontSize: 13,
    marginLeft: 2,
  },
  filterModalContainer: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  filterModalCard: {
    width: '92%',
    maxWidth: 420,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignSelf: 'center',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  filterDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  filterDateCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  filterLabel: {
    fontSize: 13,
    color: COLORS.grey[700],
    marginBottom: 2,
  },
  filterDateInput: {
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginBottom: 0,
    backgroundColor: COLORS.grey[100],
  },
  filterCheckboxGroup: {
    marginBottom: SPACING.sm,
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  filterCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: COLORS.grey[400],
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[400],
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterCheckboxLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  filterInput: {
    marginBottom: SPACING.md,
    marginTop: 2,
  },
  filterModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  filterModalApply: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
  },
  filterModalCancel: {
    flex: 1,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
  },
  viewToggleBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 8,
  },
  toggleChip: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: COLORS.grey[200],
    marginHorizontal: 4,
  },
  toggleChipActive: {
    backgroundColor: COLORS.primary,
  },
  toggleChipText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 15,
  },
  toggleChipTextActive: {
    color: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.grey[700],
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: SPACING.sm,
    color: COLORS.grey[600],
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyActionButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  emptyActionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  recordsContainer: {
    flex: 1,
  },
  eventCard: {
    borderRadius: 8,
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTypeText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 0,
    color: COLORS.text,
    flex: 1,
  },
  eventTeam: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: 2,
  },
  eventDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  attendanceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDate: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginTop: 2,
  },
  attendanceSummary: {
    alignItems: 'center',
    marginTop: 2,
  },
  attendanceCount: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presentCount: {
    color: COLORS.primary,
  },
  attendanceLabel: {
    fontSize: 12,
    color: COLORS.grey[500],
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsModalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    maxHeight: '90%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  detailsInfoHeader: {
    marginBottom: SPACING.md,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailsInfoIcon: {
    marginRight: 8,
  },
  detailsInfoText: {
    fontSize: 14,
    color: COLORS.grey[700],
  },
  attendanceSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    padding: SPACING.sm,
  },
  attendanceStat: {
    flex: 1,
    alignItems: 'center',
  },
  attendanceStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  attendanceStatLabel: {
    fontSize: 12,
    color: COLORS.grey[600],
  },
  divider: {
    marginVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  playerListContainer: {
    flex: 1,
    maxHeight: 300,
  },
  playerAttendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  playerAttendanceName: {
    fontSize: 14,
    flex: 1,
  },
  playerAttendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  presentIndicator: {
    backgroundColor: COLORS.primary,
  },
  absentIndicator: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    fontSize: 13,
  },
  presentText: {
    color: COLORS.primary,
  },
  absentText: {
    color: COLORS.error,
  },
  recordedByContainer: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.grey[100],
    borderRadius: 6,
  },
  recordedByText: {
    fontSize: 12,
    color: COLORS.grey[700],
  },
  recordedAtText: {
    fontSize: 12,
    color: COLORS.grey[500],
    marginTop: 2,
  },
  filtersContainer: {
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    minHeight: 36,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterIcon: {
    marginRight: SPACING.xs,
  },
  filterButtonText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    marginLeft: SPACING.xs,
    marginRight: SPACING.xs,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  optionSelected: {
    backgroundColor: COLORS.grey[100],
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  optionTextSelected: {
    fontWeight: '500',
    color: COLORS.primary,
  },
  cardContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  activityCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  activityTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityType: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  activityDate: {
    fontSize: 14,
    color: COLORS.grey[700],
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.grey[700],
    marginLeft: SPACING.xs,
  },
}); 