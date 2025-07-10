import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityType } from '../types/attendance';
import { getCoachInternalId } from '../utils/coachUtils';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { getUserClubId } from '../services/activitiesService';
import { fetchPlayerAttendanceStats, fetchTeamAttendanceStats } from '../services/attendanceService';
import { useTranslation } from 'react-i18next';

export const StatisticsScreen = () => {
  // Navigation
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  // Refs
  const monthScrollViewRef = useRef<ScrollView>(null);
  
  // State variables
  const [userRole, setUserRole] = useState<'admin' | 'coach' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'player' | 'team'>('player');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | 'all'>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<{ id: string; name: string; }[]>([]);
  const [playerStats, setPlayerStats] = useState<{
    player_id: string;
    player_name: string;
    team_id: string;
    team_name: string;
    present_count: number;
    absent_count: number;
    total_activities: number;
    attendance_percentage: number;
  }[]>([]);
  const [teamStats, setTeamStats] = useState<{
    team_id: string;
    team_name: string;
    present_count: number;
    absent_count: number;
    total_activities: number;
    attendance_percentage: number;
  }[]>([]);
  const [isActivityTypeDropdownOpen, setIsActivityTypeDropdownOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [players, setPlayers] = useState<{
    id: string;
    name: string;
    team_id: string;
  }[]>([]);
  const [filteredPlayerStats, setFilteredPlayerStats] = useState<typeof playerStats>([]);
  const [filteredTeamStats, setFilteredTeamStats] = useState<typeof teamStats>([]);

  // Activity type options
  const activityTypes = [
    { value: 'all' as const, label: t('attendance.statistics.all') },
    { value: 'training' as ActivityType, label: t('attendance.statistics.training') },
    { value: 'game' as ActivityType, label: t('attendance.statistics.game') },
    { value: 'tournament' as ActivityType, label: t('attendance.statistics.tournament') },
    { value: 'other' as ActivityType, label: t('attendance.statistics.other') }
  ];

  // Month names
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Keep track of the latest team ID to prevent race conditions
  const latestTeamIdRef = useRef<string | null>(null);

  // Initialize and load user data
  useEffect(() => {
    const initializeUserData = async () => {
      try {
        setIsLoading(true);
        
        // Determine user role
        const adminData = await AsyncStorage.getItem('admin_data');
        const coachData = await AsyncStorage.getItem('coach_data');
        
        if (adminData) {
          const admin = JSON.parse(adminData);
          setUserRole('admin');
          setUserId(admin.id);
        } else if (coachData) {
          const coach = JSON.parse(coachData);
          setUserRole('coach');
          
          // Get the auth user ID
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserId(user.id);
          } else {
            setUserId(coach.user_id); // Use coach's auth user ID
          }
          
          // Get and store coach's internal ID
          const internalCoachId = await getCoachInternalId();
          console.log('Coach internal ID:', internalCoachId);
          setCoachId(internalCoachId);
        }
      } catch (error) {
        console.error('Error initializing user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeUserData();
  }, []);

  // Load teams when user role and IDs are available
  useEffect(() => {
    if (userRole) {
      loadTeams();
    }
  }, [userRole, userId, coachId]);
  
  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Create a unique identifier for this focus event
      const focusId = Date.now();
      console.log(`[StatisticsScreen] Focus event ${focusId}`);
      
      if (userRole) {
        // First load teams
        loadTeams().then(() => {
          // Check if we're still on the same focus event
          console.log(`[StatisticsScreen] Teams loaded for focus event ${focusId}`);
          
          // Then if we have a selected team ID, load its data
          if (selectedTeamId) {
            // Update the latest team ID reference
            latestTeamIdRef.current = selectedTeamId;
            
            // Clear previous data first
            setPlayers([]);
            setPlayerStats([]);
            setFilteredPlayerStats([]);
            setTeamStats([]);
            setFilteredTeamStats([]);
            
            // Load fresh data
            console.log(`[StatisticsScreen] Loading data for team ${selectedTeamId} on focus event ${focusId}`);
            loadStatistics(selectedTeamId);
          }
        });
      }
    }, [userRole, userId, coachId])
  );

  // Load teams based on user role
  const loadTeams = async () => {
    try {
      console.log('Loading teams for role:', userRole);
      if (userRole === 'admin') {
        // Get club_id using the reliable utility function
        const clubId = await getUserClubId();
        
        if (!clubId) {
          console.error('Error getting club for admin: No club ID found');
          return Promise.resolve();
        }
        
        console.log('Admin club ID:', clubId);

        // Fetch only teams from this club
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .order('name');
          
        if (error) {
          console.error('Error fetching teams:', error);
          throw error;
        }
        
        setTeams(data || []);
      } else if (userRole === 'coach' && coachId) {
        // Coach sees only their teams
        console.log('Loading teams for coach with internal ID:', coachId);
        
        const { data, error } = await supabase
          .rpc('get_coach_teams', { p_coach_id: coachId });
          
        if (error) {
          console.error('Error fetching coach teams:', error);
          throw error;
        }
          
        console.log('Coach teams data:', data);
        
        if (data && data.length > 0) {
          const formattedTeams = data.map((team: any) => ({
            id: team.team_id,
            name: team.team_name
          }));
          
          console.log('Formatted teams for coach:', formattedTeams);
          setTeams(formattedTeams);
          
          // Remove automatic team selection for coaches to match admin behavior
          // No longer automatically selecting the first team
        } else {
          console.log('No teams found for coach');
          setTeams([]);
        }
      }
      
      // Return a resolved promise to allow proper chaining
      return Promise.resolve();
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeams([]);
      
      // Return a resolved promise even in case of error to prevent chain breaking
      return Promise.resolve();
    }
  };

  // Completely revise the loadStatistics function for player stats
  const loadStatistics = async (teamId?: string) => {
    try {
      // Use the provided team ID or fall back to the selected team ID
      const currentTeamId = teamId || selectedTeamId;
      
      // If no team is selected, don't load any statistics
      if (!currentTeamId) {
        setPlayerStats([]);
        setTeamStats([]);
        return;
      }
      
      // Check if this is still the latest team ID request
      if (latestTeamIdRef.current !== currentTeamId) {
        console.log(`[StatisticsScreen] Aborting statistics load for team ${currentTeamId} - newer request in progress`);
        return;
      }

      // Calculate start and end dates for the selected month
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of the month

      // Format dates for the query
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      console.log('Loading statistics for date range:', startDateStr, 'to', endDateStr);
      console.log('Selected team:', currentTeamId);
      console.log('Selected activity type:', selectedActivityType);

      // Make sure we have the latest player data for the selected team
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, team_id')
        .eq('team_id', currentTeamId)
        .eq('is_active', true)
        .order('name');
      
      if (playersError) {
        console.error('Error fetching players for stats:', playersError);
        throw playersError;
      }
      
      // Update the players state
      setPlayers(playersData || []);
      console.log(`Fetched ${playersData?.length || 0} active players for statistics`);

      if (activeView === 'player') {
        try {
          // Get team name for display
          const teamName = teams.find(t => t.id === currentTeamId)?.name || 'Unknown Team';
          
          // Initialize player stats map
          const playerStatsMap = new Map();
          
          // Initialize all players with zero attendance
          playersData?.forEach(player => {
            playerStatsMap.set(player.id, {
              player_id: player.id,
              player_name: player.name,
              team_id: player.team_id,
              team_name: teamName,
              present_count: 0,
              absent_count: 0,
              total_activities: 0,
              attendance_percentage: 0
            });
          });
          
          // Create a set to track unique activity IDs for each player
          const playerActivityMap = new Map<string, Set<string>>();
          
          // Process each player's attendance separately using the fixed attendance service
          for (const player of playersData || []) {
            try {
              // Use the new attendance service function that handles composite IDs correctly
              const attendanceData = await fetchPlayerAttendanceStats(
                player.id,
                currentTeamId,
                startDateStr,
                endDateStr,
                selectedActivityType === 'all' ? undefined : selectedActivityType
              );
              
              // Skip if no attendance data
              if (!attendanceData || attendanceData.length === 0) continue;
              
              // Get the player stats object
              const stats = playerStatsMap.get(player.id);
              if (!stats) continue;
              
              // Initialize activity tracking for this player
              if (!playerActivityMap.has(player.id)) {
                playerActivityMap.set(player.id, new Set());
              }
              
              // Count attendance records
              attendanceData.forEach((record: any) => {
                if (record.status === 'present') {
                  stats.present_count++;
                } else if (record.status === 'absent') {
                  stats.absent_count++;
                }
                
                // Track unique activities
                playerActivityMap.get(player.id)?.add(record.activity_id);
              });
              
              // Update total activities count
              if (playerActivityMap.has(player.id)) {
                stats.total_activities = playerActivityMap.get(player.id)!.size;
              }
              
              // Calculate attendance percentage
              if (stats.total_activities > 0) {
                stats.attendance_percentage = Math.round((stats.present_count / stats.total_activities) * 100);
              }
              
              console.log(`Player ${stats.player_name}: ${stats.present_count} present, ${stats.absent_count} absent, ${stats.total_activities} total, ${stats.attendance_percentage}%`);
              
            } catch (playerError) {
              console.error(`Error processing attendance for player ${player.name}:`, playerError);
            }
          }
          
          // Convert to array and apply search filter if needed
          let processedStats = Array.from(playerStatsMap.values());
          
          const filteredStats = searchQuery
            ? processedStats.filter(stat => 
                stat.player_name.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : processedStats;
            
          console.log('Final player stats:', filteredStats.length, 'players');
          setPlayerStats(filteredStats);
          setFilteredPlayerStats(filteredStats);
          
        } catch (error) {
          console.error('Error processing player statistics:', error);
          
          // Fallback to just showing players without attendance data
          if (players.length > 0) {
            console.log('Fallback: showing players without attendance data');
            const teamName = teams.find(t => t.id === currentTeamId)?.name || 'Unknown Team';
            const fallbackStats = players.map(player => ({
              player_id: player.id,
              player_name: player.name,
              team_id: player.team_id,
              team_name: teamName,
              present_count: 0,
              absent_count: 0,
              total_activities: 0,
              attendance_percentage: 0
            }));
            setPlayerStats(fallbackStats);
            setFilteredPlayerStats(fallbackStats);
          } else {
            setPlayerStats([]);
            setFilteredPlayerStats([]);
          }
        }
      } else if (activeView === 'team') {
        // Team statistics view
        try {
          console.log('Loading team statistics...');
          console.log(`Showing statistics for team: ${teams.find(t => t.id === currentTeamId)?.name} (${currentTeamId})`);
          
          // Use the new attendance service function for team stats
          const attendanceData = await fetchTeamAttendanceStats(
            currentTeamId,
            startDateStr,
            endDateStr,
            selectedActivityType === 'all' ? undefined : selectedActivityType
          );
          
          // Process team attendance data
          if (!attendanceData || attendanceData.length === 0) {
            // No attendance data, show empty stats
            setTeamStats([]);
            setFilteredTeamStats([]);
            return;
          }
          
          // Calculate team-level statistics
          const activityAttendanceMap = new Map<string, { present: number, absent: number, total: number }>();
          
          // Group attendance by activity
          attendanceData.forEach((record: any) => {
            const activityId = record.activity_id;
            
            if (!activityAttendanceMap.has(activityId)) {
              activityAttendanceMap.set(activityId, { present: 0, absent: 0, total: 0 });
            }
            
            const stats = activityAttendanceMap.get(activityId)!;
            
            if (record.status === 'present') {
              stats.present++;
            } else if (record.status === 'absent') {
              stats.absent++;
            }
            
            stats.total++;
          });
          
          // Calculate overall team stats
          let totalPresent = 0;
          let totalAbsent = 0;
          let totalActivities = activityAttendanceMap.size;
          
          activityAttendanceMap.forEach(stats => {
            totalPresent += stats.present;
            totalAbsent += stats.absent;
          });
          
          const attendancePercentage = totalPresent + totalAbsent > 0 
            ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
            : 0;
          
          // Create team stats object
          const teamStats = [{
            team_id: currentTeamId,
            team_name: teams.find(t => t.id === currentTeamId)?.name || 'Unknown Team',
            present_count: totalPresent,
            absent_count: totalAbsent,
            total_activities: totalActivities,
            attendance_percentage: attendancePercentage
          }];
          
          setTeamStats(teamStats);
          setFilteredTeamStats(teamStats);
          
        } catch (error) {
          console.error('Team stats error:', error);
          setTeamStats([]);
          setFilteredTeamStats([]);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      setPlayerStats([]);
      setFilteredPlayerStats([]);
      setTeamStats([]);
      setFilteredTeamStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add effect to filter stats when search query changes
  useEffect(() => {
    if (activeView === 'player') {
      const filtered = searchQuery
        ? playerStats.filter(stat => 
            stat.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stat.team_name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : playerStats;
      setFilteredPlayerStats(filtered);
    } else {
      const filtered = searchQuery
        ? teamStats.filter(stat => 
            stat.team_name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : teamStats;
      setFilteredTeamStats(filtered);
    }
  }, [searchQuery, playerStats, teamStats, activeView]);

  // Add useEffect to load players when a team is selected
  useEffect(() => {
    if (selectedTeamId) {
      // Update the latest team ID reference
      latestTeamIdRef.current = selectedTeamId;
      
      // Generate a unique request ID for this selection
      const requestId = Date.now();
      console.log(`[StatisticsScreen] Team selection changed to ${selectedTeamId} (request ${requestId})`);
      
      // Load players for the selected team
      loadPlayersForTeam(selectedTeamId, requestId);
    } else {
      // Clear players when no team is selected
      setPlayers([]);
      setPlayerStats([]);
      setFilteredPlayerStats([]);
      setTeamStats([]);
      setFilteredTeamStats([]);
    }
  }, [selectedTeamId]);
  
  // Update the useEffect for loading statistics to only run when month/year/activity type changes
  useEffect(() => {
    if (userRole && selectedTeamId) {
      // Only load statistics if this is still the latest team ID
      if (latestTeamIdRef.current === selectedTeamId) {
        console.log(`[StatisticsScreen] Loading statistics due to filter change for team ${selectedTeamId}`);
        loadStatistics(selectedTeamId);
      } else {
        console.log(`[StatisticsScreen] Skipping statistics load - team ID ${selectedTeamId} is not the latest`);
      }
    }
  }, [activeView, selectedMonth, selectedYear, selectedActivityType, userRole, coachId]);

  // Add function to load players for a team
  const loadPlayersForTeam = async (teamId: string, requestId?: number) => {
    try {
      // Update the latest team ID reference to prevent race conditions
      latestTeamIdRef.current = teamId;
      const currentTeamId = teamId;
      
      console.log(`[StatisticsScreen] Loading players for team: ${teamId}${requestId ? ` (request ${requestId})` : ''}`);
      setIsLoading(true); // Show loading indicator
      
      // Clear previous data immediately to prevent showing stale data
      setPlayers([]);
      setPlayerStats([]);
      setFilteredPlayerStats([]);
      setTeamStats([]);
      setFilteredTeamStats([]);
      
      let query;
      
      if (userRole === 'admin') {
        // Admin sees all players in the team
        query = supabase
          .from('players')
          .select('id, name, team_id')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('name');
      } else if (userRole === 'coach' && coachId) {
        // Coach sees only players in teams they manage
        // First verify the coach manages this team
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('id', teamId)
          .eq('coach_id', coachId)
          .limit(1);
          
        if (teamError) {
          console.error('Error verifying coach team access:', teamError);
          setIsLoading(false);
          return;
        }
        
        if (!teamData || teamData.length === 0) {
          console.log('Coach does not have access to this team');
          setIsLoading(false);
          return;
        }
        
        query = supabase
          .from('players')
          .select('id, name, team_id')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('name');
      } else {
        setIsLoading(false);
        return;
      }
      
      // Check if this is still the latest team ID request
      if (latestTeamIdRef.current !== currentTeamId) {
        console.log(`[StatisticsScreen] Aborting player load for team ${teamId} - newer request in progress`);
        return;
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading players:', error);
        setIsLoading(false);
        return;
      }
      
      // Check again if this is still the latest team ID request
      if (latestTeamIdRef.current !== currentTeamId) {
        console.log(`[StatisticsScreen] Aborting player load for team ${teamId} - newer request in progress`);
        return;
      }
      
      console.log(`[StatisticsScreen] Loaded ${data?.length || 0} players for team ${teamId}`);
      
      // Update the players state with fresh data
      setPlayers(data || []);
      
      // Always load statistics when team changes to ensure immediate update
      await loadStatistics(teamId); // Wait for statistics to load
      
      // Final check before completing
      if (latestTeamIdRef.current !== currentTeamId) {
        console.log(`[StatisticsScreen] Aborting statistics completion for team ${teamId} - newer request in progress`);
        return;
      }
      
      setIsLoading(false); // Hide loading indicator
    } catch (error) {
      console.error('Error in loadPlayersForTeam:', error);
      setPlayers([]);
      setIsLoading(false);
    }
  };

  // After setting the selected month in the initialization, add effect to scroll to it
  useEffect(() => {
    // Scroll to center the selected month with multiple attempts for reliability
    const currentMonthIndex = new Date().getMonth();
    
    // Use a sequence of timeouts at different intervals for more reliable centering
    const timers = [100, 300, 600, 1000].map(delay => 
      setTimeout(() => {
        if (monthScrollViewRef.current) {
          // Calculate position to center the month
          const itemWidth = 90; // Approximate width of month item including margins
          const screenWidth = Dimensions.get('window').width;
          const offset = Math.max(0, (currentMonthIndex * itemWidth) - (screenWidth / 2) + (itemWidth / 2));
          
          console.log(`Scrolling to month ${currentMonthIndex} at offset ${offset}px with delay ${delay}ms`);
          monthScrollViewRef.current.scrollTo({ x: offset, animated: false });
        }
      }, delay)
    );
    
    return () => timers.forEach(clearTimeout);
  }, []);

  // Render month selector
  const renderMonthSelector = () => {
    return (
      <ScrollView 
        ref={monthScrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthSelectorContainer}
      >
        {months.map((month, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.monthItem,
              selectedMonth === index && styles.selectedMonthItem
            ]}
            onPress={() => setSelectedMonth(index)}
          >
            <Text style={[
              styles.monthItemText,
              selectedMonth === index && styles.selectedMonthItemText
            ]}>
              {month}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render activity type dropdown
  const renderActivityTypeDropdown = () => {
    const selectedType = activityTypes.find(type => type.value === selectedActivityType);
    
    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity 
          style={styles.dropdownButton}
          onPress={() => setIsActivityTypeDropdownOpen(!isActivityTypeDropdownOpen)}
        >
          <Text style={styles.dropdownButtonText}>
            {t('attendance.statistics.activityType')}: {t('attendance.statistics.' + (selectedType?.value || 'all'))}
          </Text>
          <MaterialCommunityIcons 
            name={isActivityTypeDropdownOpen ? "chevron-up" : "chevron-down"} 
            size={24} 
            color={COLORS.text}
          />
        </TouchableOpacity>
        
        {isActivityTypeDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {activityTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.dropdownMenuItem,
                  selectedActivityType === type.value && styles.dropdownMenuItemSelected
                ]}
                onPress={() => {
                  setSelectedActivityType(type.value);
                  setIsActivityTypeDropdownOpen(false);
                }}
              >
                <Text style={[
                  styles.dropdownMenuItemText,
                  selectedActivityType === type.value && styles.dropdownMenuItemTextSelected
                ]}>
                  {type.label}
                </Text>
                {selectedActivityType === type.value && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render view toggle
  const renderViewToggle = () => {
    return (
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            activeView === 'player' && styles.viewToggleButtonActive,
            { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }
          ]}
          onPress={() => setActiveView('player')}
        >
          <Text style={[
            styles.viewToggleButtonText,
            activeView === 'player' && styles.viewToggleButtonTextActive
          ]}>
            {t('attendance.statistics.playerStatistics')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            activeView === 'team' && styles.viewToggleButtonActive,
            { borderTopRightRadius: 8, borderBottomRightRadius: 8 }
          ]}
          onPress={() => setActiveView('team')}
        >
          <Text style={[
            styles.viewToggleButtonText,
            activeView === 'team' && styles.viewToggleButtonTextActive
          ]}>
            {t('attendance.statistics.teamStatistics')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render team selector
  const renderTeamSelector = () => {
    const selectedTeam = teams.find(team => team.id === selectedTeamId);
    
    return (
      <View style={styles.teamSelectorContainer}>
        <Text style={styles.sectionLabel}>{t('attendance.statistics.team')}</Text>
        <TouchableOpacity 
          style={styles.teamSelectorButton}
          disabled={isLoading} // Disable when loading
          onPress={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
        >
          <Text style={styles.teamSelectorButtonText}>
            {selectedTeam?.name || 'Select Team'}
          </Text>
          <MaterialCommunityIcons 
            name={isTeamDropdownOpen ? "chevron-up" : "chevron-down"} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        
        {isTeamDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.dropdownMenuItem,
                  selectedTeamId === team.id && styles.dropdownMenuItemSelected
                ]}
                disabled={isLoading} // Disable when loading
                onPress={() => {
                  // Close dropdown first to prevent multiple selections
                  setIsTeamDropdownOpen(false);
                  
                  // Only reload if selecting a different team
                  if (team.id !== selectedTeamId) {
                    // Generate a unique request ID
                    const requestId = Date.now();
                    
                    // Set the team ID first
                    setSelectedTeamId(team.id);
                    
                    // Clear previous data immediately
                    setPlayers([]);
                    setPlayerStats([]);
                    setFilteredPlayerStats([]);
                    setTeamStats([]);
                    setFilteredTeamStats([]);
                    
                    // Load the players immediately with the request ID
                    loadPlayersForTeam(team.id, requestId);
                  }
                }}
              >
                <Text style={[
                  styles.dropdownMenuItemText,
                  selectedTeamId === team.id && styles.dropdownMenuItemTextSelected
                ]}>
                  {team.name}
                </Text>
                {selectedTeamId === team.id && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Update the search bar to include placeholder for both views
  const renderSearchBar = () => {
    return (
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeView === 'player' ? "Search player..." : "Search team..."}
          placeholderTextColor={COLORS.grey[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    );
  };

  // Update the renderPlayerStats function to handle different data scenarios
  const renderPlayerStats = () => {
    // If loading, show a loading indicator
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading player data...</Text>
        </View>
      );
    }
    
    // If no team is selected, show instruction
    if (!selectedTeamId) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="arrow-up-drop-circle" size={48} color={COLORS.primary} />
          <Text style={styles.emptyStateText}>{t('attendance.statistics.selectTeamPlayer')}</Text>
        </View>
      );
    }
    
    // If team is selected but no players, show empty state
    if (selectedTeamId && players.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="account-search" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>{t('attendance.statistics.noPlayers')}</Text>
        </View>
      );
    }
    
    // If we have playerStats, show them
    if (filteredPlayerStats.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="calendar-question" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>{t('attendance.statistics.noAttendanceData')}</Text>
          
          {/* Show players anyway */}
          {players.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('attendance.statistics.playersInTeam', { team: teams.find(t => t.id === selectedTeamId)?.name })}</Text>
              {players.map(player => (
                <View key={player.id} style={styles.playerCard}>
                  <View style={styles.playerCardHeader}>
                    <View style={styles.playerInfo}>
                      <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
                      <Text style={styles.playerName}>{player.name}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      );
    }

    return (
      <View style={styles.statsContainer}>
        {/* Player List */}
        <Text style={styles.sectionTitle}>{t('attendance.statistics.playerAttendance')}</Text>
        {filteredPlayerStats.map((player) => (
          <TouchableOpacity
            key={player.player_id}
            onPress={() => navigation.navigate('PlayerAttendanceReportScreen', {
              playerId: player.player_id,
              playerName: player.player_name,
              teamName: player.team_name,
              selectedMonth,
              selectedYear,
              selectedActivityType
            })}
            activeOpacity={0.8}
          >
            <View style={styles.playerCard}>
              <View style={styles.playerCardHeader}>
                <View style={styles.playerInfo}>
                  <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
                  <Text style={styles.playerName}>{player.player_name}</Text>
                </View>
                <View style={styles.playerAttendanceStatus}>
                  {player.attendance_percentage > 0 ? (
                    player.attendance_percentage >= 70 ? (
                      <>
                        <MaterialCommunityIcons name="check" size={20} color={COLORS.success} />
                        <Text style={[styles.playerAttendanceStatusText, { color: COLORS.success }]}>{t('attendance.statistics.good')}</Text>
                      </>
                    ) : player.attendance_percentage >= 50 ? (
                      <>
                        <MaterialCommunityIcons name="alert" size={20} color={COLORS.warning} />
                        <Text style={[styles.playerAttendanceStatusText, { color: COLORS.warning }]}>{t('attendance.statistics.average')}</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="close" size={20} color={COLORS.error} />
                        <Text style={[styles.playerAttendanceStatusText, { color: COLORS.error }]}>{t('attendance.statistics.poor')}</Text>
                      </>
                    )
                  ) : (
                    <>
                      <MaterialCommunityIcons name="minus" size={20} color={COLORS.grey[500]} />
                      <Text style={[styles.playerAttendanceStatusText, { color: COLORS.grey[500] }]}>{t('attendance.statistics.noData')}</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={styles.playerCardDetails}>
                <Text style={styles.attendanceDetailText}>
                  {t('attendance.statistics.present')}: {player.present_count} | {t('attendance.statistics.absent')}: {player.absent_count} | {t('attendance.statistics.total')}: {player.total_activities}
                </Text>
                <Text style={styles.attendanceDetailText}>
                  {t('attendance.statistics.attendanceRate')}: {player.attendance_percentage}%
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Update the renderTeamStats function to handle different data scenarios
  const renderTeamStats = () => {
    // If loading, show a loading indicator
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading team data...</Text>
        </View>
      );
    }
    
    // If no team is selected, show instruction
    if (!selectedTeamId) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="arrow-up-drop-circle" size={48} color={COLORS.primary} />
          <Text style={styles.emptyStateText}>{t('attendance.statistics.selectTeamTeam')}</Text>
        </View>
      );
    }
    
    // If no team stats available
    if (filteredTeamStats.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="calendar-question" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>{t('attendance.statistics.noAttendanceData')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.statsContainer}>
        {/* Team Stats */}
        {filteredTeamStats.map((team) => (
          <View key={team.team_id} style={styles.teamStatCard}>
            <View style={styles.teamStatHeader}>
              <View style={styles.teamInfo}>
                <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
                <Text style={styles.teamName}>{team.team_name}</Text>
              </View>
              <View style={styles.teamAttendanceStatus}>
                {team.attendance_percentage > 0 ? (
                  team.attendance_percentage >= 70 ? (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.success} />
                      <Text style={[styles.teamAttendanceStatusText, { color: COLORS.success }]}>Good</Text>
                    </>
                  ) : team.attendance_percentage >= 50 ? (
                    <>
                      <MaterialCommunityIcons name="alert" size={20} color={COLORS.warning} />
                      <Text style={[styles.teamAttendanceStatusText, { color: COLORS.warning }]}>Average</Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="close" size={20} color={COLORS.error} />
                      <Text style={[styles.teamAttendanceStatusText, { color: COLORS.error }]}>Poor</Text>
                    </>
                  )
                ) : (
                  <>
                    <MaterialCommunityIcons name="minus" size={20} color={COLORS.grey[500]} />
                    <Text style={[styles.teamAttendanceStatusText, { color: COLORS.grey[500] }]}>No data</Text>
                  </>
                )}
              </View>
            </View>
            
            <View style={styles.teamStatsSummary}>
              <View style={styles.teamStatsSummaryItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                <Text style={styles.teamStatsSummaryLabel}>Present</Text>
                <Text style={styles.teamStatsSummaryValue}>{team.present_count}</Text>
              </View>
              
              <View style={styles.teamStatsSummaryItem}>
                <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                <Text style={styles.teamStatsSummaryLabel}>Absent</Text>
                <Text style={styles.teamStatsSummaryValue}>{team.absent_count}</Text>
              </View>
              
              <View style={styles.teamStatsSummaryItem}>
                <MaterialCommunityIcons name="percent" size={20} color={COLORS.primary} />
                <Text style={styles.teamStatsSummaryLabel}>Rate</Text>
                <Text style={styles.teamStatsSummaryValue}>{team.attendance_percentage}%</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Main render function
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('attendance.statistics.title')}</Text>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Month Selector */}
        {renderMonthSelector()}
        
        {/* Activity Type Dropdown */}
        {renderActivityTypeDropdown()}
        
        {/* View Toggle */}
        {renderViewToggle()}
        
        {/* Team Selector */}
        {renderTeamSelector()}
        
        {/* Stats View */}
        {activeView === 'player' ? renderPlayerStats() : renderTeamStats()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.md,
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.grey[600],
  },
  monthSelectorContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    justifyContent: 'center',
    minWidth: '100%',
  },
  monthItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: COLORS.grey[100],
  },
  selectedMonthItem: {
    backgroundColor: COLORS.primary,
  },
  monthItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  selectedMonthItemText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  dropdownContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  dropdownMenuItemSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  dropdownMenuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  dropdownMenuItemTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  viewToggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewToggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  viewToggleButtonTextActive: {
    color: COLORS.white,
  },
  teamSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  teamSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  teamSelectorButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.text,
  },
  statsContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  playerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  playerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  playerAttendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAttendanceStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  playerCardDetails: {
    marginTop: SPACING.xs,
  },
  attendanceDetailText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: 0,
  },
  teamStatCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  teamStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  teamAttendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAttendanceStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  teamStatsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  teamStatsSummaryItem: {
    alignItems: 'center',
  },
  teamStatsSummaryLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
  },
  teamStatsSummaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.grey[600],
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  teamNameText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: SPACING.xs,
    fontStyle: 'italic'
  },
});

export default StatisticsScreen; 