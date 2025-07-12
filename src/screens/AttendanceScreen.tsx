import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, ScrollView, TouchableWithoutFeedback, Modal, Platform } from 'react-native';
import { Text, Button, Checkbox, FAB, TextInput } from 'react-native-paper';
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
  getPlayersByTeamId,
  getUserClubId
} from '../services/activitiesService';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, isSameDay, startOfDay, endOfDay } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCoachInternalId } from '../utils/coachUtils';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { JWTErrorHandler } from '../utils/jwtErrorHandler';
import { useTranslation } from 'react-i18next';

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
const extractBaseActivityId = (id: string): string => {
  // Check if the ID has a date suffix (format: uuid-date)
  if (id.includes('-2025') || id.includes('-2024')) {
    // Extract the base UUID part (first 36 characters which is a standard UUID)
    return id.substring(0, 36);
  }
  return id;
};

// Add WeekRange type definition
interface WeekRange {
  start: string;
  end: string;
}

// Add a function to get attendance records for an activity, handling both base and composite IDs
const getAttendanceRecordsForActivity = async (activityId: string) => {
  try {
    // First try with the exact activity ID
    const { data: exactMatches, error: exactError } = await supabase
      .from('activity_attendance')
      .select('*')
      .eq('activity_id', activityId);
      
    if (exactError) throw exactError;
    
    if (exactMatches && exactMatches.length > 0) {
      console.log(`[AttendanceScreen] Found ${exactMatches.length} exact attendance matches for activity ${activityId}`);
      return exactMatches;
    }
    
    // If no exact matches and this is a composite ID, try with the base ID
    if (activityId.includes('-')) {
      const baseId = extractBaseActivityId(activityId);
      
      const { data: baseMatches, error: baseError } = await supabase
        .from('activity_attendance')
        .select('*')
        .eq('activity_id', baseId);
        
      if (baseError) throw baseError;
      
      if (baseMatches && baseMatches.length > 0) {
        console.log(`[AttendanceScreen] Found ${baseMatches.length} base ID attendance matches for activity ${activityId} using base ID ${baseId}`);
        return baseMatches;
      }
    }
    
    // If this is a base ID, try to find any composite IDs that match
    const { data: compositeMatches, error: compositeError } = await supabase
      .from('activity_attendance')
      .select('*')
      .like('activity_id', `${activityId}-%`);
      
    if (compositeError) throw compositeError;
    
    if (compositeMatches && compositeMatches.length > 0) {
      console.log(`[AttendanceScreen] Found ${compositeMatches.length} composite attendance matches for base activity ${activityId}`);
      return compositeMatches;
    }
    
    // No matches found
    console.log(`[AttendanceScreen] No attendance records found for activity ${activityId}`);
    return [];
  } catch (error) {
    console.error(`[AttendanceScreen] Error fetching attendance for activity ${activityId}:`, error);
    return [];
  }
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
  const [datesWithAttendance, setDatesWithAttendance] = useState<string[]>([]);

  // Add a ref to track the last fetch time
  const lastFetchRef = useRef<number>(0);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { t } = useTranslation();

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

  useFocusEffect(
    useCallback(() => {
      // Standard focus actions
      if (userRole) {
        console.log('[AttendanceScreen] Screen focused, loading teams.');
        loadTeams();
      }

      // Check for refresh request from another screen
      const params = (route.params as any) || {};
      if (params.refresh) {
        console.log('[AttendanceScreen] Refresh requested.');

        // Restore date if provided, to ensure calendar stays on the right day
        if (params.restoreDate) {
          const restoreDate = new Date(params.restoreDate);
          // Only update if the date is different to avoid unnecessary re-renders
          if (!isSameDay(restoreDate, selectedDate)) {
            console.log('[AttendanceScreen] Restoring date to:', restoreDate);
            setSelectedDate(restoreDate);
          }
        }
        
        // Force a re-fetch of attendance data
        console.log('[AttendanceScreen] Forcing attendance records refresh.');
        fetchAttendanceRecords();

        // Clear the refresh param to prevent loops
        navigation.setParams({ refresh: undefined, restoreDate: undefined });
      } else {
        // Always refresh attendance records when screen comes into focus
        // This ensures that when we return from AddAttendanceScreen, the data is updated
        console.log('[AttendanceScreen] Screen focused - refreshing attendance records.');
        fetchAttendanceRecords();
      }
    }, [userRole, route.params]) // Rerun when role or params change
  );

  // Load activities for date range and type
  useEffect(() => {
    if (selectedTeam) {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }).toISOString();
      const weekRange: WeekRange = { start: weekStart, end: weekEnd };
      
      loadActivities(weekRange, selectedTeam.id, selectedType);
    }
  }, [selectedTeam, selectedType, currentWeek, selectedDate]);

  // Add useEffect to fetch attendance records when dependencies change
  useEffect(() => {
    console.log('[AttendanceScreen] useEffect triggered for fetchAttendanceRecords');
    fetchAttendanceRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedType, selectedTeam, currentWeek]);

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

  // Modified fetchAttendanceRecords function with debounce mechanism
  const fetchAttendanceRecords = async () => {
    // Debounce mechanism to prevent multiple calls within 500ms
    const now = Date.now();
    if (now - lastFetchRef.current < 500) {
      console.log('[AttendanceScreen] Skipping duplicate fetch, too soon after last fetch');
      return;
    }
    lastFetchRef.current = now;
    
    console.log('[AttendanceScreen] Starting fetchAttendanceRecords...');
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
      
      // Filter by selected date
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log('[AttendanceScreen] Filtering for date:', selectedDateStr);
      const activitiesForDate = activitiesData.filter(activity => {
        const activityDateStr = activity.start_time.split('T')[0];
        return activityDateStr === selectedDateStr;
      });
      
      // Filter by type if needed
      const filteredActivities = selectedType === 'all'
        ? activitiesForDate
        : activitiesForDate.filter(a => a.type === selectedType);
      
      console.log('[AttendanceScreen] Final filtered activities:', filteredActivities.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        date: a.start_time.split('T')[0]
      })));
      
      if (filteredActivities.length === 0) {
        setAttendanceRecords([]);
        setDatesWithAttendance([]); // Clear attendance dots if no activities
        setIsLoadingAttendanceRecords(false);
        return;
      }
      
      // 2. Get all attendance records for these activities, but ONLY for the selected date range
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();
      
      // For recurring activities, we need to query using the full composite IDs
      // For regular activities, we use the base ID
      const activityIdsToQuery = filteredActivities.map(activity => activity.id);
      
      console.log(`[AttendanceScreen] Searching for attendance for activity IDs:`, activityIdsToQuery, `on ${selectedDateStr}`);
      
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('*, player:player_id (id, name)')
        .in('activity_id', activityIdsToQuery);

      if (attendanceError) {
        console.error('[AttendanceScreen] Error fetching attendance:', attendanceError);
        throw attendanceError;
      }
      
      // NEW LOGIC: Determine which dates have marked attendance to show dots on the calendar
      if (attendanceData && attendanceData.length > 0) {
        const datesWithRecords = attendanceData.map(rec => {
          // For recurring activities, extract date from the composite ID
          if (rec.activity_id.includes('-')) {
            const datePart = rec.activity_id.split('-')[1];
            if (datePart && datePart.length === 8) {
              const year = datePart.substring(0, 4);
              const month = datePart.substring(4, 6);
              const day = datePart.substring(6, 8);
              return `${year}-${month}-${day}`;
            }
          }
          // Fallback to created_at date
          return new Date(rec.created_at).toISOString().split('T')[0];
        });
        const uniqueDates = [...new Set(datesWithRecords)];
        setDatesWithAttendance(uniqueDates);
        console.log('[AttendanceScreen] Dates with actual attendance:', uniqueDates);
      } else {
        setDatesWithAttendance([]);
      }
      
      // 3. Group attendance records by activity
      const groupedRecords: Record<string, { activity: Activity, records: any[] }> = {};
      
      // Initialize the grouped records structure
      filteredActivities.forEach(activity => {
        groupedRecords[activity.id] = {
          activity,
          records: []
        };
      });
      
      // Process the attendance records - match by exact activity_id
      (attendanceData || []).forEach(record => {
        // Find the activity that matches this attendance record
        const targetActivity = filteredActivities.find(a => a.id === record.activity_id);
        
        if (targetActivity) {
          groupedRecords[targetActivity.id].records.push(record);
        }
      });
      
      console.log('[AttendanceScreen] Grouped attendance records:', 
        Object.entries(groupedRecords).map(([id, data]) => ({
          activityId: id,
          activityTitle: data.activity.title,
          recordCount: data.records.length
        }))
      );
      
      setAttendanceRecords(Object.values(groupedRecords));
    } catch (error) {
      console.error('[AttendanceScreen] Error in fetchAttendanceRecords:', error);
      setAttendanceRecords([]);
    } finally {
      setIsLoadingAttendanceRecords(false);
    }
  };

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
        // Get club ID for proper data isolation
        const clubId = await getUserClubId();
        if (!clubId) {
          console.error('[AttendanceScreen] No club ID found for admin');
          setTeams([]);
          return;
        }

        // Use JWT error handling wrapper
        const { data, error } = await JWTErrorHandler.withJWTHandling(async () => {
          return await supabase
            .from('teams')
            .select('id, name')
            .eq('club_id', clubId) // CRITICAL: Filter by club_id for data isolation
            .eq('is_active', true)
            .order('name');
        });
          
        if (error) {
          console.error('[AttendanceScreen] Error fetching teams:', error);
          throw error;
        }
        
        if (data) {
          console.log('[AttendanceScreen] Teams loaded for admin:', data.length);
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

        // Use JWT error handling wrapper
        const { data, error } = await JWTErrorHandler.withJWTHandling(async () => {
          return await supabase
            .rpc('get_coach_teams', {
              p_coach_id: coachId
            });
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
  const loadActivities = async (week: WeekRange, teamId?: string, type?: string) => {
    try {
      setIsLoadingActivities(true);
      console.log('[AttendanceScreen] Fetching activities for week:', { start: week.start, end: week.end, teamId, type });
      
      // Get coach's team IDs if user is a coach and no specific team is selected
      let coachTeamIds: string[] = [];
      if (userRole === 'coach' && !teamId) {
        const coachDataRaw = await AsyncStorage.getItem('coach_data');
        const coachData = coachDataRaw ? JSON.parse(coachDataRaw) : null;
        const coachId = coachData?.id;
        
        if (coachId) {
          const { data, error } = await supabase
            .rpc('get_coach_teams', { p_coach_id: coachId });
            
          if (!error && data) {
            coachTeamIds = data.map((team: any) => team.team_id);
            console.log('[AttendanceScreen] Coach teams:', coachTeamIds);
          }
        }
      }
      
      // Get club ID for proper data isolation
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('[AttendanceScreen] No club ID found');
        setActivities([]);
        setIsLoadingActivities(false);
        return;
      }
      
      // Fetch activities with proper filtering
      let query = supabase
        .from('activities')
        .select('*')
        .eq('club_id', clubId)
        .gte('start_time', week.start)
        .lte('start_time', week.end)
        .order('start_time', { ascending: true });
      
      // Add team filter if specified
      if (teamId) {
        query = query.eq('team_id', teamId);
      } 
      // Filter by coach's teams if user is a coach and no specific team is selected
      else if (userRole === 'coach' && coachTeamIds.length > 0) {
        query = query.in('team_id', coachTeamIds);
      }
      
      // Add type filter if specified
      if (type && type !== 'all') {
        query = query.eq('type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[AttendanceScreen] Error fetching activities:', error);
        setActivities([]);
      } else {
        console.log('[AttendanceScreen] Activities found:', data?.length || 0);
        
        // Apply type filter if needed (as a backup to the query filter)
        let filteredActivities = data || [];
        if (type && type !== 'all') {
          filteredActivities = filteredActivities.filter(activity => activity.type === type);
        }
        
        // CORRECTED DATE FILTERING
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        console.log(`[AttendanceScreen] Filtering activities for date: ${selectedDateStr}`);
        
        const selectedDateActivities = filteredActivities.filter(activity => {
          const activityDate = activity.start_time.split('T')[0];
          return activityDate === selectedDateStr;
        });
        
        console.log('[AttendanceScreen] Activities for selected date:', selectedDateActivities.length);
        setActivities(selectedDateActivities);
      }
    } catch (error) {
      console.error('[AttendanceScreen] Error in loadActivities:', error);
      setActivities([]);
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
      
      // Get attendance records using the helper function that handles all ID formats
      const attendanceRecords = await getAttendanceRecordsForActivity(selectedActivity.id);
      
      // Convert the array of attendance records to an object keyed by player_id
      const attendanceMap = attendanceRecords.reduce((acc: AttendanceRecord, record) => {
        acc[record.player_id] = record.status;
        return acc;
      }, {});
      
      setAttendance(attendanceMap);
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

  // Update the handleSave function to ensure the actual_activity_date matches the activity's start_time
  const handleSave = async () => {
    if (!selectedActivity?.id) {
      Alert.alert('Error', 'Please select an activity first');
      return;
    }
    try {
      setIsSaving(true);
      
      const baseActivityId = extractBaseActivityId(selectedActivity.id);
      console.log('[AttendanceScreen] Using BASE activity ID for attendance:', baseActivityId);

      const { data: { user } } = await supabase.auth.getUser();
      console.log('[AttendanceScreen] Auth user:', user?.id);

      // Fetch the club_id. This is the correct way.
      const clubId = await getUserClubId();
      if (!clubId) {
        throw new Error("Could not determine the user's club.");
      }

      const coachId = await getCoachInternalId();
      console.log('[AttendanceScreen] Coach ID:', coachId);
      
      const adminData = await AsyncStorage.getItem('admin_data');
      let recordedBy = coachId;
      
      if (userRole === 'admin' && adminData) {
          const admin = JSON.parse(adminData);
          recordedBy = admin.id;
          console.log('[AttendanceScreen] User is admin, recorded_by:', recordedBy);
      }
      
      const { data: coachDetails } = await supabase
        .from('coaches')
        .select('name')
        .eq('id', coachId)
        .single();

      const coachName = coachDetails?.name || 'Unknown Coach';

      const scheduledActivityDate = selectedActivity.start_time;

      const attendanceData = Object.entries(attendance).map(([playerId, status]) => ({
        player_id: playerId,
        activity_id: baseActivityId,
        status: status,
        recorded_by: recordedBy,
        club_id: clubId, // Use the fetched clubId here.
        team_id: selectedActivity.team_id,
        coach_name: coachName,
        actual_activity_date: scheduledActivityDate
      }));
      
      if (attendanceData.length === 0) {
        Alert.alert('No Changes', 'No attendance data has been modified.');
        setIsSaving(false);
        return;
      }

      console.log('[AttendanceScreen] Saving attendance data:', JSON.stringify(attendanceData, null, 2));

      const { data, error } = await supabase
        .from('activity_attendance')
        .upsert(attendanceData, {
          onConflict: 'player_id, activity_id',
        });

      if (error) {
        console.error('Error saving attendance:', error);
        throw error;
      }

      console.log('Attendance saved successfully:', data);
      Alert.alert('Success', 'Attendance has been saved successfully.');
      
      // Refresh attendance records after saving. This call takes no arguments.
      fetchAttendanceRecords();

    } catch (error) {
      const typedError = error as { message?: string };
      console.error('An unexpected error occurred:', typedError.message);
      Alert.alert('Error', `Failed to save attendance: ${typedError.message || 'Unknown error'}`);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Calculate weekDates and eventDates for event dots */}
      <WeeklyCalendarCard
        currentDate={currentWeek}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        eventDates={datesWithAttendance}
      />

      {/* Header row with Attendance title and filter icon */}
      <View style={[
        styles.headerRow,
        Platform.OS === 'android' ? { paddingTop: 24 } : null
      ]}>
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
                onPress={() => navigation.navigate('AttendanceReportDetails', { 
                  activityId: record.activity.id, // Use the full activity ID including date suffix
                  selectedDate: format(selectedDate, 'yyyy-MM-dd') 
                })}
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
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.error} style={{ marginRight: 4 }} />
                    <Text style={styles.noAttendanceText}>{t('attendance.noAttendanceMarked')}</Text>
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
                            size={18}
                            color={isSelected ? '#fff' : color}
                            style={{ marginRight: 8 }}
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
                    {/* All Teams option */}
                    <TouchableOpacity
                      key="all-teams"
                      style={[
                        styles.chip,
                        !selectedTeam && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                      ]}
                      onPress={() => setSelectedTeam(null)}
                    >
                      <MaterialCommunityIcons
                        name="account-group-outline"
                        size={18}
                        color={!selectedTeam ? '#fff' : COLORS.primary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[
                        styles.chipText,
                        !selectedTeam && { color: '#fff' }
                      ]}>
                        All Teams
                      </Text>
                    </TouchableOpacity>
                    {teams.map((team) => {
                      const isSelected = selectedTeam?.id === team.id;
                      return (
                        <TouchableOpacity
                          key={team.id}
                          style={[
                            styles.chip,
                            isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                          ]}
                          onPress={() => setSelectedTeam(isSelected ? null : team)}
                        >
                          <MaterialCommunityIcons
                            name="account-group"
                            size={18}
                            color={isSelected ? '#fff' : COLORS.primary}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={[
                            styles.chipText,
                            isSelected && { color: '#fff' }
                          ]}>
                            {team.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Button mode="contained" onPress={() => {
                    setFilterModalVisible(false);
                    setSelectedType(filterType);
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
          {t('attendance.viewStatistics')}
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
    paddingHorizontal: 16,
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
    justifyContent: 'flex-start',
    marginBottom: 16,
    marginHorizontal: -4, // Negative margin to offset the padding
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
    minWidth: 105,
    justifyContent: 'flex-start',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 15,
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