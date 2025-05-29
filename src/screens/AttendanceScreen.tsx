import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, Checkbox, FAB, TextInput } from 'react-native-paper';
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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      
      const { data, error } = await getActivitiesByDateRange(
        weekStart.toISOString(), 
        weekEnd.toISOString(),
        selectedTeam?.id // Pass the selected team ID
      );
      
      if (error) throw error;
      
      console.log('Activities found:', data?.length || 0);
      
      if (data) {
        // Filter activities by type if needed
        const filteredActivities = selectedType === 'all' 
          ? data 
          : data.filter(activity => activity.type === selectedType);
        
        console.log('After type filter:', filteredActivities.length);
        
        // Debug: log all activities with dates
        filteredActivities.forEach(activity => {
          const activityDate = new Date(activity.start_time);
          console.log(
            'Activity:', 
            activity.id, 
            activity.title, 
            activity.type,
            'Team:', activity.team_id,
            'Date:', format(activityDate, 'yyyy-MM-dd'),
            'Selected date:', format(selectedDate, 'yyyy-MM-dd'),
            'Is same day:', isSameDay(activityDate, selectedDate)
          );
        });
        
        // Filter activities by date - ensure we compare dates properly
        const activitiesForDate = filteredActivities.filter(activity => {
          // Parse the activity date and normalize timezone issues
          const activityDateStr = activity.start_time.split('T')[0]; // Get just the date part
          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
          
          // Compare date strings instead of Date objects to avoid timezone issues
          return activityDateStr === selectedDateStr;
        });
        
        console.log('After date filter:', activitiesForDate.length);
        
        setActivities(activitiesForDate);
        
        // If previously selected activity is no longer in the list, clear it
        if (selectedActivity && !activitiesForDate.find(a => a.id === selectedActivity.id)) {
          setSelectedActivity(null);
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
      } else if (userRole === 'coach' && userId) {
        // For coach, use the get_coach_players function
        const { data, error } = await supabase
          .rpc('get_coach_players', { p_coach_id: userId });
          
        if (error) {
          console.error('Error fetching players:', error);
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
        }
      }
    } catch (error) {
      console.error('Error loading players:', error);
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
      
      // Extract the base UUID from the activity ID (remove date suffix if present)
      const baseActivityId = selectedActivity.id.split('-').slice(0, 5).join('-');
      
      const { data, error } = await supabase
        .from('activity_attendance')
        .select('*')
        .eq('activity_id', baseActivityId);
        
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
      console.log('Activity ID:', selectedActivity.id);
      console.log('User ID:', userId);
      console.log('User Role:', userRole);

      // Initialize a variable to hold the user ID that will record attendance
      let attendanceRecorderId = null;

      // Get coach data to set access code and get admin_id
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      console.log('Raw stored coach data:', storedCoachData);

      if (storedCoachData) {
        const parsedCoachData = JSON.parse(storedCoachData);
        console.log('Parsed coach data:', JSON.stringify(parsedCoachData, null, 2));
        // Use coachData.user_id (or current auth user) for attendance recording
        attendanceRecorderId = parsedCoachData.user_id;
        console.log('Using coach user_id for recording:', attendanceRecorderId);
      } else if (userRole === 'admin') {
        // For admins, the userId is the auth user ID
        attendanceRecorderId = userId;
      }
      
      if (!attendanceRecorderId) {
        throw new Error('No valid user ID available for recording attendance');
      }
      
      console.log('Using attendance recorder ID:', attendanceRecorderId);
      
      // Check if the coach has permission to record attendance for this activity
      console.log('Checking coach permission for activity...');
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('team_id')
        .eq('id', selectedActivity.id)
        .single();
      
      console.log('Activity data:', activityData, 'Error:', activityError);
      
      if (activityData && activityData.team_id) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('coach_id')
          .eq('id', activityData.team_id)
          .single();
          
        console.log('Team data:', teamData, 'Error:', teamError);
        
        if (teamData && teamData.coach_id) {
          console.log('Coach ID for team:', teamData.coach_id);
        }
      }
      
      // Prepare data for upsert
      const attendanceRecords = Object.entries(attendance)
        .filter(([_, status]) => status !== null) // Only include players with a status
        .map(([playerId, status]) => ({
          activity_id: selectedActivity.id,
          player_id: playerId,
          status: status, // status is already 'present' or 'absent'
          recorded_by: attendanceRecorderId, // Use the admin_id (auth user ID)
          recorded_at: new Date().toISOString(),
          coach_name: storedCoachData ? JSON.parse(storedCoachData).name : null // Add the coach's name
        }));

      console.log('Attendance records to save:', attendanceRecords.length);
      
      if (attendanceRecords.length > 0) {
        // Use upsert operation directly - this will update existing records or insert new ones
        // The unique constraint on (activity_id, player_id) will ensure we update existing records
        const { error } = await supabase
          .from('activity_attendance')
          .upsert(attendanceRecords, { 
            onConflict: 'activity_id,player_id', 
            ignoreDuplicates: false // set to false to update existing records
          });

        if (error) {
          console.error('Error saving attendance:', error);
          throw error;
        }
        
        console.log('Attendance records successfully upserted');
      } else {
        console.log('No attendance records to save');
      }
      
      Alert.alert('Success', 'Attendance saved successfully');
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', `Failed to save attendance: ${JSON.stringify(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Main ScrollView that makes the entire page scrollable */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly Calendar */}
        <WeeklyCalendarCard
          currentDate={currentWeek}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
        />
        
        {/* Activity Type Selector */}
        <ActivityTypeSelector
          selectedType={selectedType}
          onTypeChange={(type) => {
            setSelectedType(type);
            setSelectedActivity(null);
          }}
        />
        
        {/* Activity Selector */}
        <ActivitySelector
          selectedActivity={selectedActivity}
          activities={activities}
          isLoading={isLoadingActivities}
          onActivitySelect={setSelectedActivity}
        />
        
        {/* Team Selector */}
        <TeamSelector
          selectedTeam={selectedTeam}
          teams={teams}
          onTeamSelect={setSelectedTeam}
        />
        
        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            mode="outlined"
            placeholder="Search players..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            left={<TextInput.Icon icon="magnify" color={COLORS.primary} />}
            outlineStyle={styles.searchOutline}
            dense
          />
        </View>
        
        {/* Player List */}
        {isLoadingPlayers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading players...</Text>
          </View>
        ) : filteredPlayers.length > 0 ? (
          <View style={styles.playersContainer}>
            {filteredPlayers.map(item => (
              <View key={item.id} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </Text>
                  <Text style={styles.playerTeam} numberOfLines={1} ellipsizeMode="tail">
                    {teams.find(t => t.id === item.team_id)?.name || ''}
                  </Text>
                </View>
                <View style={styles.attendanceRadioContainer}>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity 
                      style={[
                        styles.radioButton, 
                        attendance[item.id] === 'present' && styles.radioButtonSelected,
                        styles.presentRadio
                      ]}
                      onPress={() => toggleAttendance(item.id, 'present')}
                    >
                      {attendance[item.id] === 'present' && (
                        <View style={[styles.radioInner, { backgroundColor: COLORS.primary }]} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.radioLabel}>Present</Text>
                  </View>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity 
                      style={[
                        styles.radioButton, 
                        attendance[item.id] === 'absent' && styles.radioButtonSelected,
                        styles.absentRadio
                      ]}
                      onPress={() => toggleAttendance(item.id, 'absent')}
                    >
                      {attendance[item.id] === 'absent' && (
                        <View style={[styles.radioInner, { backgroundColor: COLORS.error }]} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.radioLabel}>Absent</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="account-question" 
              size={50} 
              color={COLORS.grey[400]} 
            />
            <Text style={styles.emptyText}>
              {selectedTeam ? 'No players found for this team' : 'Select a team to view players'}
            </Text>
          </View>
        )}
        
        {/* Add extra padding at the bottom for the FAB */}
        <View style={styles.fabSpacer} />
      </ScrollView>
      
      {/* Floating Save Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={!selectedActivity || isSaving}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="content-save" size={16} color="#212121" style={{ marginRight: 4 }} />
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>
    </View>
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
}); 