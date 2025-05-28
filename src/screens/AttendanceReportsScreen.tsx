import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity, TextInput as RNTextInput, Alert, Modal } from 'react-native';
import { Text, Card, Button, Chip, SegmentedButtons, Portal, Menu, IconButton, Divider, TextInput as PaperTextInput } from 'react-native-paper';
import { COLORS, SPACING } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO, addMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, differenceInMinutes } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TeamSelector } from '@/components/Attendance/TeamSelector';
import { ActivityTypeSelector } from '@/components/Attendance/ActivityTypeSelector';
import { 
  ActivityType, 
  AttendanceRecord, 
  AttendanceStatus, 
  AttendanceStats,
  FilterPreset,
  ColumnConfig,
  AttendanceSummary
} from '@/types/attendance';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

type Team = {
  id: string;
  name: string;
};

interface GroupedRecord {
  activity: AttendanceRecord;
  records: AttendanceRecord[];
}

// Add type annotations for the trend data
interface TrendDataPoint {
  date: string;
  rate: number;
}

// Add type for player record
interface PlayerRecord {
  player_id: string;
  player_name: string;
  status: AttendanceStatus;
}

// Add type guards
const isAttendanceRecord = (record: AttendanceRecord | AttendanceStats): record is AttendanceRecord => {
  return 'player_name' in record && 'status' in record && 'recorded_by_name' in record && 'recorded_at' in record;
};

const isAttendanceStats = (record: AttendanceRecord | AttendanceStats): record is AttendanceStats => {
  return 'present_count' in record && 'absent_count' in record && 'total_players' in record && 'attendance_percentage' in record;
};

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
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
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
      
      if (userRole === 'admin') {
        // For admin, fetch all teams from their club
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

        const { data: club } = await supabase
          .from('clubs')
        .select('id')
          .eq('admin_id', user.id)
        .single();

        if (!club) return;
        
        const { data } = await supabase
          .from('teams')
          .select('id, name')
          .eq('club_id', club.id)
          .eq('is_active', true)
          .order('name');

        if (data) {
          setTeams(data);
          setSelectedTeam(null); // Default to All Teams
        }
      } else if (userRole === 'coach' && userId) {
        // For coach, fetch teams using the get_coach_teams function
        const { data, error } = await supabase
          .rpc('get_coach_teams', { p_coach_id: userId });

        if (error) {
          console.error('Error fetching teams:', error);
          return;
        }
        
        if (data) {
          // Transform the data to match the expected format
          const transformedTeams = data.map((team: { team_id: string; team_name: string }) => ({
            id: team.team_id,
            name: team.team_name
          }));
          setTeams(transformedTeams);
          setSelectedTeam(null); // Default to All Teams
        }
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Load detailed attendance records
  const loadAttendanceRecords = async () => {
    try {
      setIsLoading(true);
      
      // Cast the activity_type to explicitly handle the type compatibility
      let activityTypeParam = null;
      if (selectedType !== 'all') {
        activityTypeParam = selectedType;
      }
      
      // Step 1: Get activities for the selected team(s) and date range
      let activitiesQuery = supabase
        .from('activities')
        .select('id, title, type, start_time, team_id')
        .gte('start_time', dateRange.start.toISOString())
        .lte('start_time', dateRange.end.toISOString());
        
      // Apply team filter if a specific team is selected
      if (selectedTeam) {
        activitiesQuery = activitiesQuery.eq('team_id', selectedTeam.id);
      } else if (teams.length > 0) {
        // If "All Teams" is selected, include all teams the user has access to
        const teamIds = teams.map(team => team.id);
        activitiesQuery = activitiesQuery.in('team_id', teamIds);
      } else {
        // No teams available
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }
      
      const { data: activitiesData, error: activitiesError } = await activitiesQuery;
        
      if (activitiesError) {
        console.error('Error loading activities:', activitiesError);
        throw activitiesError;
      }
      
      // Filter by activity type if needed
      let filteredActivities = activitiesData || [];
      if (activityTypeParam && filteredActivities.length > 0) {
        filteredActivities = filteredActivities.filter(activity => 
          activity.type === activityTypeParam
        );
      }
      
      if (filteredActivities.length === 0) {
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }
      
      // Step 2: Get all attendance records for these activities
      const activityIds = filteredActivities.map(a => a.id);
      
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('id, activity_id, player_id, status, recorded_by, recorded_at')
        .in('activity_id', activityIds);
        
      if (attendanceError) {
        console.error('Error loading attendance records:', attendanceError);
        throw attendanceError;
      }
      
      if (!attendanceData || attendanceData.length === 0) {
        console.log('No attendance records found for the selected activities');
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }
      
      console.log(`Found ${attendanceData.length} attendance records`);
      
      // Step 3: Get player details for these records
      const playerIds = [...new Set(attendanceData.map(record => record.player_id))];
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', playerIds);
        
      if (playersError) {
        console.error('Error loading players:', playersError);
        throw playersError;
      }
      
      // Also fetch team details for each activity
      const teamIds = [...new Set(filteredActivities.map(a => a.team_id))];
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
        
      if (teamsError) {
        console.error('Error loading teams:', teamsError);
        throw teamsError;
      }
      
      // Create maps for quick lookup
      interface PlayerMap {
        [key: string]: string;
      }
      
      interface ActivityMap {
        [key: string]: {
          id: string;
          title: string;
          type: string;
          start_time: string;
          team_id: string;
        };
      }
      
      interface TeamMap {
        [key: string]: string;
      }
      
      const playerMap: PlayerMap = (playersData || []).reduce((map: PlayerMap, player) => {
        map[player.id] = player.name;
        return map;
      }, {});
      
      const activityMap: ActivityMap = filteredActivities.reduce((map: ActivityMap, activity) => {
        map[activity.id] = activity;
        return map;
      }, {});
      
      const teamMap: TeamMap = (teamsData || []).reduce((map: TeamMap, team) => {
        map[team.id] = team.name;
        return map;
      }, {});
      
      // Step 4: Combine all data into the expected format
      const formattedRecords = attendanceData.map(record => {
        const activity = activityMap[record.activity_id];
        // Ensure activity_type is a valid ActivityType
        let activityType: ActivityType = 'other';
        if (activity?.type === 'training' || activity?.type === 'game' || 
            activity?.type === 'tournament' || activity?.type === 'other') {
          activityType = activity.type as ActivityType;
        }
        
        return {
          activity_id: record.activity_id,
          activity_title: activity?.title || 'Unknown Activity',
          activity_type: activityType,
          activity_date: activity?.start_time,
          team_id: activity?.team_id,
          team_name: teamMap[activity?.team_id] || (selectedTeam?.name || 'Unknown Team'),
          player_id: record.player_id,
          player_name: playerMap[record.player_id] || 'Unknown Player',
          status: record.status as AttendanceStatus,
          recorded_by: record.recorded_by,
          recorded_by_name: 'Coach', // Simplified for now
          recorded_at: record.recorded_at
        };
      });
      
      console.log(`Formatted ${formattedRecords.length} attendance records`);
      setAttendanceRecords(formattedRecords);
      
    } catch (error) {
      console.error('Error loading attendance records:', error);
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
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
    
    attendanceRecords.forEach(record => {
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
    navigation.navigate('AttendanceReportDetails', { activityId: activity.id });
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
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading attendance records...</Text>
        </View>
      );
    }

    if (groupedActivities.length === 0) {
      let emptyMessage = '';
      if (teams.length === 0) {
        emptyMessage = 'No teams found.';
      } else if (!selectedTeam) {
        emptyMessage = 'No attendance records found for your teams in this date range.';
      } else {
        emptyMessage = `No attendance has been recorded for ${selectedTeam.name} in ${format(selectedMonth, 'MMMM yyyy')}.`;
      }
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name="clipboard-text-outline" 
            size={50} 
            color={COLORS.grey[400]} 
          />
          <Text style={styles.emptyText}>No attendance records found</Text>
          <Text style={styles.emptySubText}>{emptyMessage}</Text>
          {selectedTeam && (
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => {
                setSelectedMonth(new Date());
                setDateRange({
                  start: startOfMonth(new Date()),
                  end: endOfMonth(new Date())
                });
                setSelectedType('all');
              }}
            >
              <Text style={styles.emptyActionButtonText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <ScrollView style={{ flex: 1 }}>
        {groupedActivities.map((activity) => (
          <View key={activity.id} style={{ width: '100%' }}>
          <TouchableOpacity 
            onPress={() => handleActivityPress(activity)}
            activeOpacity={0.7}
          >
              <Card
                style={[
                  styles.eventCard,
                  {
                    borderLeftWidth: 4,
                    borderLeftColor: getActivityTypeColor(activity.type),
                    marginHorizontal: 4, // Tiny gap for shadow
                    marginBottom: SPACING.md,
                  },
                ]}
              >
              <Card.Content>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventType}>
                      <MaterialCommunityIcons 
                        name={getActivityTypeIcon(activity.type)}
                        size={18} 
                        color={getActivityTypeColor(activity.type)} 
                      />
                      <Text style={[styles.eventTypeText, { color: getActivityTypeColor(activity.type) }]}>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.eventTime}>
                      {format(new Date(activity.date), 'HH:mm')}
                    </Text>
                  </View>
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventTitle}>{activity.title}</Text>
                  </View>
                  {/* Team name below the title */}
                  <Text style={styles.eventTeam}>{activity.team}</Text>
                  {/* Schedule date and presence count on the same row */}
                  <View style={styles.eventDateRow}>
                    <Text style={styles.eventDate}>{format(new Date(activity.date), 'EEE, d MMM')}</Text>
                    <View style={styles.attendanceSummaryRow}>
                      <Text style={styles.attendanceCount}>
                        <Text style={styles.presentCount}>{activity.records.filter(r => r.status === 'present').length}</Text>
                        <Text> / </Text>
                        <Text>{activity.records.length}</Text>
                      </Text>
                      <Text style={styles.attendanceLabel}>present</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
              </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
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

      {/* Team Filter Modal */}
      <Modal
        visible={showTeamFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTeamFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <TouchableOpacity 
                onPress={() => setShowTeamFilter(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.optionItem, !selectedTeam && styles.optionSelected]}
              onPress={() => { 
                setSelectedTeam(null); 
                setShowTeamFilter(false); 
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, !selectedTeam && styles.optionTextSelected]}>All Teams</Text>
              </View>
              {!selectedTeam && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <ScrollView>
              {teams.map((team) => {
                const isSelected = selectedTeam?.id === team.id;
                
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.optionItem, isSelected && styles.optionSelected]}
                    onPress={() => { 
                      setSelectedTeam(team);
                      setShowTeamFilter(false); 
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{team.name}</Text>
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
}); 