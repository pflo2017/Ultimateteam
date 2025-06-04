import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Text, Button, TextInput, IconButton, ActivityIndicator, Divider, Menu } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, addMonths } from 'date-fns';
import { ActivityType, createActivity, getPlayersByTeamId } from '../services/activitiesService';
import { RepeatSchedule, RepeatType, DayOfWeek } from '../components/Schedule/RepeatSchedule';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCoachInternalId, getCoachAuthId } from '../utils/coachUtils';

type CreateActivityScreenRouteProp = RouteProp<RootStackParamList, 'CreateActivity'>;

// Team interface
interface Team {
  id: string;
  name: string;
}

// Define MaterialCommunityIcons name type to fix type error
type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const CreateActivityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<CreateActivityScreenRouteProp>();
  
  // Initialize with the type from route params or default to 'training'
  const initialType: ActivityType = 'training';
  
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [duration, setDuration] = useState('1h');
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  
  // Repeat schedule state
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState<RepeatType>('weekly');
  const [repeatDays, setRepeatDays] = useState<DayOfWeek[]>([]);
  const [repeatUntil, setRepeatUntil] = useState<Date>(addMonths(new Date(), 1));
  
  // Add state for teams
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamMenu, setShowTeamMenu] = useState(false);

  // Game specific state
  const [homeAway, setHomeAway] = useState<'home' | 'away'>('home');
  const [availablePlayers, setAvailablePlayers] = useState<Array<{id: string, name: string}>>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);

  // Initial data loading
  useEffect(() => {
    getCurrentUser();
    
    // Ensure startDate is initialized to a valid date
    setStartDate(prev => {
      if (!prev || isNaN(prev.getTime())) {
        console.log('Initializing startDate to current date');
        return new Date();
      }
      return prev;
    });
  }, []);
  
  // Initialize repeat days with the current day of the week
  useEffect(() => {
    const currentDay = new Date().getDay() as DayOfWeek;
    setRepeatDays([currentDay]);
  }, []);

  // Load players when team is selected and activity type is game
  useEffect(() => {
    if (selectedTeam && activityType === 'game') {
      loadPlayersForTeam(selectedTeam.id);
    }
  }, [selectedTeam, activityType]);

  const loadPlayersForTeam = async (teamId: string) => {
    try {
      const { data, error } = await getPlayersByTeamId(teamId);
      if (error) throw error;
      if (data) {
        setAvailablePlayers(data);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const getCurrentUser = async () => {
    try {
      // Get user data from AsyncStorage
      const coachData = await AsyncStorage.getItem('coach_data');
      const parentData = await AsyncStorage.getItem('parent_data');
      const adminData = await AsyncStorage.getItem('admin_data');
      
      // Handle admin user - this is the auth user approach
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        // Check if user is an admin
        const { data: adminProfile, error: adminProfileError } = await supabase
          .from('admin_profiles')
          .select('id, user_id')
          .eq('user_id', user.id)
          .single();
        
        if (!adminProfileError && adminProfile) {
          console.log('User is an admin:', adminProfile.id);
          setUserId(adminProfile.id);
          
          // Get the admin's club
          const { data: clubData, error: clubError } = await supabase
            .from('clubs')
            .select('id')
            .eq('admin_id', user.id)
            .single();
          
          if (!clubError && clubData) {
            console.log('Admin club found:', clubData.id);
            
            // Get all teams for this club
            const { data: teamsData, error: teamsError } = await supabase
              .from('teams')
              .select('id, name')
              .eq('club_id', clubData.id)
              .eq('is_active', true)
              .order('name');
              
            if (teamsError) {
              console.error('Error fetching teams for admin:', teamsError);
            } else if (teamsData && teamsData.length > 0) {
              console.log(`Found ${teamsData.length} teams for admin`);
              const teams: Team[] = teamsData.map((team: any) => ({
                id: team.id,
                name: team.name
              }));
              
              setAvailableTeams(teams);
            } else {
              console.log('No teams found for admin');
            }
            
            // Exit early as we've handled the admin case
            return;
          } else {
            console.error('Error fetching club for admin:', clubError);
          }
        }
      }
      
      // Handle coach user
      if (coachData) {
        try {
          const coach = JSON.parse(coachData);
          
          // Try to get coach teams
          if (coach && coach.id) {
            setUserId(coach.id);
            
            const { data: teamsData, error: teamsError } = await supabase
              .rpc('get_coach_teams', { p_coach_id: coach.id });
              
            if (teamsError) {
              console.error('Error fetching teams:', teamsError);
            } else if (teamsData && teamsData.length > 0) {
              const teams: Team[] = teamsData.map((team: any) => ({
                id: team.team_id,
                name: team.team_name
              }));
              
              setAvailableTeams(teams);
              
              // If there's only one team, select it by default
              if (teams.length === 1) {
                setSelectedTeam(teams[0]);
                setTeamId(teams[0].id);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing coach data:', e);
        }
      }
      
      // Handle parent user
      if (parentData) {
        const parent = JSON.parse(parentData);
        
        if (parent && parent.id) {
          setParentId(parent.id);
          
          // Get the first child for this parent
          const { data: childrenData, error: childrenError } = await supabase
            .from('parent_children')
            .select('id')
            .eq('parent_id', parent.id)
            .eq('is_active', true)
            .limit(1);
            
          if (!childrenError && childrenData && childrenData.length > 0) {
            setChildId(childrenData[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return false;
    }
    
    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return false;
    }
    
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return false;
    }
    
    if (isRepeating && repeatType === 'weekly' && repeatDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for weekly repeat');
      return false;
    }
    
    if (availableTeams.length > 0 && !selectedTeam) {
      Alert.alert('Error', 'Please select a team for this activity');
      return false;
    }
    
    return true;
  };

  // Calculate end time
  const calculateEndTime = (startTime: Date, durationStr: string): Date => {
    const endTime = new Date(startTime);
    
    // Parse duration string (e.g., "1h", "2h30m", "45m")
    const hourMatch = durationStr.match(/(\d+)h/);
    const minuteMatch = durationStr.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    
    // If no valid duration format, default to 1 hour
    const totalMinutes = (hours * 60 + minutes) || 60;
    
    endTime.setMinutes(endTime.getMinutes() + totalMinutes);
    return endTime;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    
    try {
      setIsLoading(true);
      
      // Get auth user ID for created_by (activities require auth.users ID)
      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id;
      
      // Basic validation - we need at least a user ID
      if (!authUserId) {
        throw new Error('User ID not available. Please log in again.');
      }
      
      if (availableTeams.length > 0 && !selectedTeam) {
        throw new Error('Please select a team for this activity');
      }
      
      // Calculate end time from start time and duration
      const startTimeDate = new Date(startDate);
      const endTimeDate = calculateEndTime(startTimeDate, duration);
      
      const activityData: any = {
        title,
        location,
        start_time: startDate.toISOString(),
        end_time: endTimeDate.toISOString(),
        duration,
        type: activityType,
        created_by: authUserId, // Use auth user ID as required by the DB schema
        team_id: selectedTeam ? selectedTeam.id : teamId,
        is_public: true,
        additional_info: additionalInfo || undefined,
        private_notes: privateNotes || undefined,
        // Repeat schedule fields
        is_repeating: isRepeating,
        repeat_type: isRepeating ? repeatType : undefined,
        repeat_days: isRepeating ? repeatDays : undefined,
        repeat_until: isRepeating ? repeatUntil.toISOString() : undefined
      };
      
      // Add game-specific fields if this is a game
      if (activityType === 'game') {
        activityData.home_away = homeAway;
        activityData.lineup_players = selectedPlayers.length > 0 ? selectedPlayers : undefined;
      }
      
      // Only add parent and child IDs if available
      if (parentId) {
        activityData.parent_id = parentId;
      }
      
      if (childId) {
        activityData.child_id = childId;
      }
      
      const { data, error } = await createActivity(activityData);
      
      if (error) {
        throw error;
      }
      
      Alert.alert('Success', 'Activity created successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', `Failed to create activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showStartDatePicker = () => {
    console.log('Opening date picker with date:', startDate);
    setIsDatePickerVisible(true);
  };

  const hideStartDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const handleStartDateConfirm = (date: Date) => {
    console.log('Date selected:', date);
    setStartDate(date);
    hideStartDatePicker();
  };

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    setTeamId(team.id);
    setShowTeamMenu(false);
    setSelectedPlayers([]); // Reset selected players when team changes
  };

  const handlePlayerSelect = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const ActivityTypeButton = ({ type, label, icon }: { type: ActivityType, label: string, icon: MaterialCommunityIconName }) => (
    <TouchableOpacity
      style={[
        styles.activityTypeButton,
        activityType === type && { backgroundColor: getActivityColor(type) }
      ]}
      onPress={() => setActivityType(type)}
    >
      <View style={styles.activityTypeContent}>
        <MaterialCommunityIcons 
          name={icon}
          size={20} 
          color={activityType === type ? COLORS.white : COLORS.grey[700]} 
        />
        <Text 
          style={[
            styles.activityTypeText,
            activityType === type && styles.activeActivityTypeText
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return '#4AADCC';
      case 'game':
        return '#E67E22'; // Orange
      case 'tournament':
        return '#8E44AD'; // Purple
      default:
        return '#2ECC71'; // Green
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Activity</Text>
        <Button 
          mode="contained" 
          onPress={handleCreate} 
          style={styles.createButton}
          labelStyle={styles.createButtonLabel}
          loading={isLoading}
          disabled={isLoading}
        >
          Create
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.activityTypeContainer}>
          <ActivityTypeButton type="training" label="Training" icon="whistle" />
          <ActivityTypeButton type="game" label="Game" icon="trophy-outline" />
          <ActivityTypeButton type="tournament" label="Tournament" icon="tournament" />
          <ActivityTypeButton type="other" label="Other" icon="calendar-text" />
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          placeholder="Enter activity title"
          dense
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          style={styles.input}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          placeholder="Enter location"
          dense
        />

        {/* Home/Away selection for Game type */}
        {activityType === 'game' && (
          <View>
            <Text style={styles.label}>Home/Away</Text>
            <View style={styles.homeAwayContainer}>
              <TouchableOpacity
                style={[
                  styles.homeAwayButton,
                  homeAway === 'home' && { backgroundColor: getActivityColor(activityType) }
                ]}
                onPress={() => setHomeAway('home')}
              >
                <Text style={[
                  styles.homeAwayButtonText,
                  homeAway === 'home' && styles.activeHomeAwayButtonText
                ]}>
                  Home
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.homeAwayButton,
                  homeAway === 'away' && { backgroundColor: getActivityColor(activityType) }
                ]}
                onPress={() => setHomeAway('away')}
              >
                <Text style={[
                  styles.homeAwayButtonText,
                  homeAway === 'away' && styles.activeHomeAwayButtonText
                ]}>
                  Away
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.label}>Time</Text>
        <View style={styles.timeContainer}>
          <View style={styles.startTimeContainer}>
            <Text style={styles.timeLabel}>Start</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton} 
              onPress={showStartDatePicker}
            >
              <MaterialCommunityIcons 
                name="calendar-clock" 
                size={18} 
                color={getActivityColor(activityType)} 
                style={styles.inputIcon}
              />
              <Text style={styles.dateTimeText}>
                {format(startDate, 'EEE, MMM d, HH:mm')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.durationContainer}>
            <Text style={styles.timeLabel}>Duration</Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              style={styles.durationInput}
              mode="outlined"
              outlineColor={COLORS.grey[200]}
              activeOutlineColor={getActivityColor(activityType)}
              outlineStyle={styles.inputOutline}
              placeholder="1h"
              dense
              left={<TextInput.Icon icon="clock-outline" color={getActivityColor(activityType)} />}
            />
          </View>
        </View>

        {/* Team Selection */}
        <Text style={styles.label}>Select Team</Text>
        <TouchableOpacity 
          style={styles.teamSelector}
          onPress={() => setShowTeamMenu(true)}
        >
          <View>
            <Text style={styles.teamSelectorText}>
              {selectedTeam ? selectedTeam.name : 'Select a team'}
            </Text>
            <Text style={styles.teamSelectorSubtext}>
              This activity will be visible to the selected team
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-down" 
            size={24} 
            color={getActivityColor(activityType)} 
          />
        </TouchableOpacity>

        {/* Lineup Selection for Game type */}
        {activityType === 'game' && selectedTeam && (
          <View>
            <Text style={styles.label}>Lineup</Text>
            <TouchableOpacity 
              style={styles.teamSelector}
              onPress={() => setShowPlayerMenu(true)}
              disabled={!selectedTeam}
            >
              <View>
                <Text style={styles.teamSelectorText}>
                  {selectedPlayers.length > 0 
                    ? `${selectedPlayers.length} player${selectedPlayers.length > 1 ? 's' : ''} selected` 
                    : 'Select players for lineup'}
                </Text>
                <Text style={styles.teamSelectorSubtext}>
                  Select players that will be in the game lineup
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-down" 
                size={24} 
                color={getActivityColor(activityType)} 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Modal for Team Selection */}
        <Modal
          visible={showTeamMenu}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTeamMenu(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Team</Text>
                <TouchableOpacity 
                  onPress={() => setShowTeamMenu(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.teamsList}>
                {availableTeams.length > 0 ? (
                  availableTeams.map(team => (
                    <TouchableOpacity
                      key={team.id}
                      style={[
                        styles.teamItem,
                        selectedTeam?.id === team.id && styles.selectedTeamItem
                      ]}
                      onPress={() => handleTeamSelect(team)}
                    >
                      <View style={styles.teamItemContent}>
                        <MaterialCommunityIcons
                          name="account-group"
                          size={24}
                          color={COLORS.primary}
                        />
                        <Text style={styles.teamName}>{team.name}</Text>
                      </View>
                      {selectedTeam?.id === team.id && (
                        <MaterialCommunityIcons
                          name="check"
                          size={24}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noTeamsText}>No teams available</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Players Modal for Lineup Selection */}
        <Modal
          visible={showPlayerMenu}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPlayerMenu(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Players for Lineup</Text>
                <TouchableOpacity 
                  onPress={() => setShowPlayerMenu(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.teamsList}>
                {availablePlayers.length > 0 ? (
                  availablePlayers.map(player => (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.teamItem,
                        selectedPlayers.includes(player.id) && styles.selectedTeamItem
                      ]}
                      onPress={() => handlePlayerSelect(player.id)}
                    >
                      <View style={styles.teamItemContent}>
                        <MaterialCommunityIcons
                          name="account"
                          size={24}
                          color={COLORS.primary}
                        />
                        <Text style={styles.teamName}>{player.name}</Text>
                      </View>
                      {selectedPlayers.includes(player.id) && (
                        <MaterialCommunityIcons
                          name="check"
                          size={24}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noTeamsText}>No players available</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Repeat Schedule Component */}
        <View style={styles.repeatContainer}>
          <View style={styles.repeatHeader}>
            <Text style={styles.label}>Repeat Schedule</Text>
            <TouchableOpacity 
              style={styles.repeatToggle}
              onPress={() => setIsRepeating(!isRepeating)}
            >
              <MaterialCommunityIcons 
                name={isRepeating ? "checkbox-marked" : "checkbox-blank-outline"} 
                size={24} 
                color={isRepeating ? getActivityColor(activityType) : COLORS.grey[500]} 
              />
              <Text style={[
                styles.repeatToggleText,
                isRepeating && { color: getActivityColor(activityType) }
              ]}>
                Repeat this event
              </Text>
            </TouchableOpacity>
          </View>

          {isRepeating && (
            <View style={styles.repeatOptions}>
              <RepeatSchedule
                isRepeating={isRepeating}
                repeatType={repeatType}
                repeatDays={repeatDays}
                repeatUntil={repeatUntil}
                onIsRepeatingChange={setIsRepeating}
                onRepeatTypeChange={setRepeatType}
                onRepeatDaysChange={setRepeatDays}
                onRepeatUntilChange={setRepeatUntil}
              />
            </View>
          )}
        </View>

        <Text style={styles.label}>Additional information</Text>
        <TextInput
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          style={styles.textAreaInput}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          multiline
          numberOfLines={3}
          placeholder="Don't forget to bring..."
        />

        <View style={styles.privateNotesContainer}>
          <Text style={styles.privateNotesTitle}>Private notes for coaches</Text>
          <Text style={styles.privateNotesSubtitle}>Visible for all coaches and admins in the team</Text>
          <TextInput
            value={privateNotes}
            onChangeText={setPrivateNotes}
            style={styles.privateNotesInput}
            mode="outlined"
            outlineColor={COLORS.grey[200]}
            activeOutlineColor={getActivityColor(activityType)}
            outlineStyle={styles.inputOutline}
            multiline
            numberOfLines={3}
            placeholder="Add notes..."
          />
        </View>
        
        <View style={styles.spacer} />
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleStartDateConfirm}
        onCancel={hideStartDatePicker}
        date={startDate instanceof Date && !isNaN(startDate.getTime()) ? startDate : new Date()}
        display="inline"
        minimumDate={new Date()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  createButton: {
    borderRadius: 20,
  },
  createButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activityTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  activityTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: COLORS.grey[100],
    marginBottom: 8,
    minWidth: '22%',
  },
  activityTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTypeText: {
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: 4,
  },
  activeActivityTypeText: {
    color: COLORS.white,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: COLORS.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.grey[100],
    marginBottom: 20,
    height: 48,
  },
  textAreaInput: {
    backgroundColor: COLORS.grey[100],
    marginBottom: 20,
    minHeight: 80,
  },
  inputOutline: {
    borderRadius: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  startTimeContainer: {
    flex: 2,
    marginRight: 12,
  },
  durationContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: COLORS.grey[700],
  },
  dateTimeButton: {
    backgroundColor: COLORS.grey[100],
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    color: COLORS.text,
  },
  durationInput: {
    backgroundColor: COLORS.grey[100],
    height: 48,
  },
  teamSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  teamSelectorText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  teamSelectorSubtext: {
    fontSize: 14,
    color: COLORS.grey[700],
  },
  repeatContainer: {
    marginBottom: 24,
    backgroundColor: COLORS.grey[100],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  repeatHeader: {
    marginBottom: 8,
  },
  repeatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  repeatToggleText: {
    fontSize: 16,
    marginLeft: 8,
    color: COLORS.text,
    fontWeight: '500',
  },
  repeatOptions: {
    marginTop: 16,
  },
  privateNotesContainer: {
    backgroundColor: '#FFF8E1', // Light yellow background
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  privateNotesTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  privateNotesSubtitle: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: 8,
  },
  privateNotesInput: {
    backgroundColor: COLORS.white,
    minHeight: 80,
  },
  spacer: {
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  teamsList: {
    paddingTop: 8,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.grey[100],
  },
  selectedTeamItem: {
    backgroundColor: COLORS.primary + '10', // 10% opacity of primary color
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: 8,
  },
  noTeamsText: {
    textAlign: 'center',
    color: COLORS.grey[600],
    fontSize: 16,
    marginTop: 24,
  },
  homeAwayContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  homeAwayButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 8,
  },
  homeAwayButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  activeHomeAwayButtonText: {
    color: COLORS.white,
    fontWeight: '500',
  },
}); 