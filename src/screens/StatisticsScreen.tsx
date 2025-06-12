import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityType } from '../types/attendance';
import { getCoachInternalId } from '../utils/coachUtils';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

export const StatisticsScreen = () => {
  // Navigation
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  // Activity type options
  const activityTypes = [
    { value: 'all' as const, label: 'All Activities' },
    { value: 'training' as ActivityType, label: 'Training' },
    { value: 'game' as ActivityType, label: 'Game' },
    { value: 'tournament' as ActivityType, label: 'Tournament' },
    { value: 'other' as ActivityType, label: 'Other' }
  ];

  // Month names
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

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
      if (userRole) {
        loadTeams();
        loadStatistics();
      }
    }, [userRole, userId, coachId])
  );

  // Load teams based on user role
  const loadTeams = async () => {
    try {
      console.log('Loading teams for role:', userRole);
      if (userRole === 'admin') {
        // Get current admin's club
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: club, error: clubError } = await supabase
          .from('clubs')
          .select('id')
          .eq('admin_id', user.id)
          .single();
        if (clubError || !club) return;

        // Fetch only teams from this club
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('club_id', club.id)
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
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
          
          // Select first team by default if there are teams
          if (formattedTeams.length > 0 && !selectedTeamId) {
            setSelectedTeamId(formattedTeams[0].id);
          }
        } else {
          console.log('No teams found for coach');
          setTeams([]);
        }
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeams([]);
    }
  };

  // Completely revise the loadStatistics function for player stats
  const loadStatistics = async () => {
    try {
      setIsLoading(true);

      // Calculate start and end dates for the selected month
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of the month

      // Format dates for the query
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      console.log('Loading statistics for date range:', startDateStr, 'to', endDateStr);
      console.log('Selected team:', selectedTeamId);
      console.log('Selected activity type:', selectedActivityType);

      if (activeView === 'player') {
        try {
          // Simplify to just use the players we've already loaded
          // We'll fetch activities separately
          
          // First, get activities for the date range
          let activitiesQuery = supabase
            .from('activities')
            .select('id, title, type, start_time, team_id')
            .gte('start_time', startDateStr)
            .lte('start_time', endDateStr);
          
          if (selectedTeamId) {
            activitiesQuery = activitiesQuery.eq('team_id', selectedTeamId);
          }
          
          if (selectedActivityType !== 'all') {
            activitiesQuery = activitiesQuery.filter('type', 'eq', selectedActivityType);
          }
          
          const { data: activitiesData, error: activitiesError } = await activitiesQuery;
          
          if (activitiesError) {
            console.error('Error fetching activities:', activitiesError);
            throw activitiesError;
          }
          
          console.log(`Found ${activitiesData?.length || 0} activities matching criteria`);
          
          if (!activitiesData || activitiesData.length === 0) {
            // No activities found, but we'll still display players
            // Just without attendance data
            if (selectedTeamId && players.length > 0) {
              console.log(`Creating empty stats for ${players.length} players`);
              const emptyPlayerStats = players.map(player => ({
                player_id: player.id,
                player_name: player.name,
                team_id: player.team_id,
                team_name: selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name || 'Unknown Team' : 'All Teams',
                present_count: 0,
                absent_count: 0,
                total_activities: 0,
                attendance_percentage: 0
              }));
              
              setPlayerStats(emptyPlayerStats);
            } else {
              setPlayerStats([]);
            }
            return;
          }
          
          // Get the activity IDs
          const activityIds = activitiesData.map(a => a.id);
          
          // Get team name for display
          const teamName = selectedTeamId 
            ? teams.find(t => t.id === selectedTeamId)?.name || 'Unknown Team' 
            : 'All Teams';
          
          // Now get attendance records - but use separate queries, not relationships
          console.log("Getting attendance records for activities:", activityIds.length, "activities");
          console.log("IMPORTANT: Only using official coach-marked attendance from activity_attendance table, not parent RSVPs");
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('activity_attendance') // Only use official coach-marked attendance
            .select('activity_id, player_id, status')
            .in('activity_id', activityIds);
            
          if (attendanceError) {
            console.error('Error fetching attendance:', attendanceError);
            throw attendanceError;
          }
          
          console.log(`Found ${attendanceData?.length || 0} attendance records`);
          
          // Also fetch players if we need them
          let relevantPlayers = players;
          
          // Always fetch fresh player data when loading statistics
          let activePlayersQuery = supabase.from('players').select('id, name, team_id').eq('is_active', true);
          
          if (selectedTeamId) {
            activePlayersQuery = activePlayersQuery.eq('team_id', selectedTeamId);
          } else if (userRole === 'coach' && coachId) {
            // For coach with no team selected, get players from all their teams
            const { data: coachTeams } = await supabase
              .from('teams')
              .select('id')
              .eq('coach_id', coachId);
              
            if (coachTeams && coachTeams.length > 0) {
              const teamIds = coachTeams.map(t => t.id);
              activePlayersQuery = activePlayersQuery.in('team_id', teamIds);
            }
          }
          
          const { data: playersData, error: playersError } = await activePlayersQuery;
          
          if (playersError) {
            console.error('Error fetching players for stats:', playersError);
          } else if (playersData) {
            relevantPlayers = playersData;
            // Update the players state to keep it in sync
            setPlayers(playersData);
            console.log(`Fetched ${playersData.length} players for statistics`);
          }
          
          // Now create stats for each player
          const playerStatsMap = new Map();
          
          // Initialize all players with zero attendance
          relevantPlayers.forEach(player => {
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
          
          // Update with actual attendance data
          attendanceData?.forEach(record => {
            const playerId = record.player_id;
            // Only count this attendance record if it belongs to a valid activity
            if (playerStatsMap.has(playerId) && activityIds.includes(record.activity_id)) {
              const stats = playerStatsMap.get(playerId);
              stats.total_activities++;
              
              if (record.status === 'present') {
                stats.present_count++;
              } else if (record.status === 'absent') {
                stats.absent_count++;
              }
            }
          });
          
          // Calculate attendance percentages
          playerStatsMap.forEach(stats => {
            if (stats.total_activities > 0) {
              stats.attendance_percentage = Math.round((stats.present_count / stats.total_activities) * 100);
            }
          });
          
          // Convert to array and apply search filter if needed
          let processedStats = Array.from(playerStatsMap.values());
          
          const filteredStats = searchQuery
            ? processedStats.filter(stat => 
                stat.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                stat.team_name.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : processedStats;
            
          console.log('Final player stats:', filteredStats.length, 'players');
          setPlayerStats(filteredStats);
          setFilteredPlayerStats(filteredStats);
          
        } catch (error) {
          console.error('Error processing player statistics:', error);
          
          // Fallback to just showing players without attendance data
          if (selectedTeamId && players.length > 0) {
            console.log('Fallback: showing players without attendance data');
            const teamName = teams.find(t => t.id === selectedTeamId)?.name || 'Unknown Team';
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
          } else {
            setPlayerStats([]);
          }
        }
      } else {
        // Team statistics - completely revised approach
        try {
          console.log('Loading team statistics...');
          
          // Get all teams based on user role
          let teamsToShow = [...teams]; // Clone the array
          
          if (selectedTeamId) {
            teamsToShow = teamsToShow.filter(team => team.id === selectedTeamId);
          }
          
          if (teamsToShow.length === 0) {
            console.log('No teams to show statistics for');
            setTeamStats([]);
            return;
          }
          
          console.log(`Showing statistics for ${teamsToShow.length} teams`);
          
          // For each team, get their activities
          const allTeamStats = [];
          
          for (const team of teamsToShow) {
            console.log(`Processing team ${team.name} (${team.id})`);
            
            // Get activities for this team within the date range and of the selected type
            let activitiesQuery = supabase
              .from('activities')
              .select('id, title, type, start_time')
              .eq('team_id', team.id)
              .gte('start_time', startDateStr)
              .lte('start_time', endDateStr);
              
            if (selectedActivityType !== 'all') {
              activitiesQuery = activitiesQuery.filter('type', 'eq', selectedActivityType);
            }
            
            const { data: activities, error: activitiesError } = await activitiesQuery;
            
            if (activitiesError) {
              console.error(`Error loading activities for team ${team.id}:`, activitiesError);
              continue;
            }
            
            if (!activities || activities.length === 0) {
              console.log(`No activities found for team ${team.id} in the selected period`);
              
              // Add team with zero stats
              allTeamStats.push({
                team_id: team.id,
                team_name: team.name,
                present_count: 0,
                absent_count: 0,
                total_activities: 0,
                attendance_percentage: 0
              });
              
              continue;
            }
            
            console.log(`Found ${activities.length} activities for team ${team.id}`);
            
            // Get attendance records for these activities
            const activityIds = activities.map(a => a.id);
            
            const { data: attendance, error: attendanceError } = await supabase
              .from('activity_attendance')
              .select('activity_id, status')
              .in('activity_id', activityIds);
              
            if (attendanceError) {
              console.error(`Error loading attendance for team ${team.id}:`, attendanceError);
              continue;
            }
            
            // Calculate statistics
            let presentCount = 0;
            let absentCount = 0;
            
            attendance?.forEach(record => {
              if (record.status === 'present') {
                presentCount++;
              } else if (record.status === 'absent') {
                absentCount++;
              }
            });
            
            const totalAttendance = presentCount + absentCount;
            const attendancePercentage = totalAttendance > 0
              ? Math.round((presentCount / totalAttendance) * 100)
              : 0;
              
            console.log(`Team ${team.id} stats: ${presentCount} present, ${absentCount} absent, ${attendancePercentage}%`);
            
            allTeamStats.push({
              team_id: team.id,
              team_name: team.name,
              present_count: presentCount,
              absent_count: absentCount,
              total_activities: totalAttendance,
              attendance_percentage: attendancePercentage
            });
          }
          
          // Filter by search query if needed
          const filteredStats = searchQuery
            ? allTeamStats.filter(stat => 
                stat.team_name.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : allTeamStats;
            
          console.log(`Final team stats: ${filteredStats.length} teams`);
          setTeamStats(filteredStats);
          setFilteredTeamStats(filteredStats);
          
        } catch (error) {
          console.error('Team stats error:', error);
          // Fallback - just show empty stats
          setTeamStats([]);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add useEffect to load players when a team is selected
  useEffect(() => {
    if (selectedTeamId) {
      loadPlayersForTeam(selectedTeamId);
    }
  }, [selectedTeamId]);
  
  // Remove debouncedSearchQuery from the effect dependencies
  useEffect(() => {
    if (userRole) {
      loadStatistics();
    }
  }, [activeView, selectedMonth, selectedYear, selectedActivityType, selectedTeamId, userRole, coachId]);

  // Add new state for filtered stats
  const [filteredPlayerStats, setFilteredPlayerStats] = useState<typeof playerStats>([]);
  const [filteredTeamStats, setFilteredTeamStats] = useState<typeof teamStats>([]);

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

  // Add function to load players for a team
  const loadPlayersForTeam = async (teamId: string) => {
    try {
      console.log('Loading players for team:', teamId);
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
          setPlayers([]);
          return;
        }
        
        if (!teamData || teamData.length === 0) {
          console.log('Coach does not have access to this team');
          setPlayers([]);
          return;
        }
        
        query = supabase
          .from('players')
          .select('id, name, team_id')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('name');
      } else {
        setPlayers([]);
        return;
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading players:', error);
        setPlayers([]);
        return;
      }
      
      console.log(`Loaded ${data?.length || 0} players for team ${teamId}`);
      // Always update the players state with fresh data
      setPlayers(data || []);
      
      // If we're in player view, trigger a statistics reload to ensure we have fresh data
      if (activeView === 'player') {
        loadStatistics();
      }
    } catch (error) {
      console.error('Error in loadPlayersForTeam:', error);
      setPlayers([]);
    }
  };

  // After setting the selected month in the initialization, add effect to scroll to it
  useEffect(() => {
    // Scroll to center the selected month
    setTimeout(() => {
      const currentMonthIndex = new Date().getMonth();
      if (monthScrollViewRef.current) {
        // Calculate position to center the month
        const itemWidth = 80; // Approximate width of month item
        const screenWidth = 390; // Average screen width
        const offset = Math.max(0, (currentMonthIndex * itemWidth) - (screenWidth / 2) + (itemWidth / 2));
        monthScrollViewRef.current.scrollTo({ x: offset, animated: true });
      }
    }, 100);
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
            Activity Type: {selectedType?.label || 'All Activities'}
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
            Player Statistics
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
            Team Statistics
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
        <Text style={styles.sectionLabel}>Team:</Text>
        <TouchableOpacity 
          style={styles.teamSelectorButton}
          onPress={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
        >
          <Text style={styles.teamSelectorButtonText}>
            {selectedTeam?.name || 'All Teams'}
          </Text>
          <MaterialCommunityIcons 
            name={isTeamDropdownOpen ? "chevron-up" : "chevron-down"} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        
        {isTeamDropdownOpen && (
          <View style={styles.teamDropdownMenu}>
            <TouchableOpacity
              style={[
                styles.teamDropdownMenuItem,
                !selectedTeamId && styles.teamDropdownMenuItemSelected
              ]}
              onPress={() => {
                setSelectedTeamId(null);
                setIsTeamDropdownOpen(false);
              }}
            >
              <Text style={[
                styles.teamDropdownMenuItemText,
                !selectedTeamId && styles.teamDropdownMenuItemTextSelected
              ]}>
                All Teams
              </Text>
              {!selectedTeamId && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamDropdownMenuItem,
                  selectedTeamId === team.id && styles.teamDropdownMenuItemSelected
                ]}
                onPress={() => {
                  setSelectedTeamId(team.id);
                  setIsTeamDropdownOpen(false);
                }}
              >
                <Text style={[
                  styles.teamDropdownMenuItemText,
                  selectedTeamId === team.id && styles.teamDropdownMenuItemTextSelected
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
    // If team is selected but no players, show empty state
    if (selectedTeamId && players.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="account-search" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>No players found for the selected team</Text>
        </View>
      );
    }
    
    // If no team is selected, show instruction
    if (!selectedTeamId) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="arrow-up-drop-circle" size={48} color={COLORS.primary} />
          <Text style={styles.emptyStateText}>Please select a team to view player statistics</Text>
        </View>
      );
    }
    
    // If we have playerStats, show them
    if (filteredPlayerStats.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="calendar-question" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>No attendance data found for this period</Text>
          
          {/* Show players anyway */}
          {players.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Players in {teams.find(t => t.id === selectedTeamId)?.name}</Text>
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

    // Update the stats calculation to use filteredPlayerStats
    const totalPresent = filteredPlayerStats.reduce((sum, player) => sum + player.present_count, 0);
    const totalAbsent = filteredPlayerStats.reduce((sum, player) => sum + player.absent_count, 0);
    const totalActivities = totalPresent + totalAbsent;

    return (
      <View style={styles.statsContainer}>
        {/* Search Bar */}
        {renderSearchBar()}
        
        {/* Stats Summary */}
        <View style={styles.statsSummary}>
          <View style={styles.statsSummaryItem}>
            <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
            <Text style={styles.statsSummaryLabel}>Present</Text>
            <Text style={styles.statsSummaryValue}>{totalPresent}</Text>
          </View>
          
          <View style={styles.statsSummaryItem}>
            <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
            <Text style={styles.statsSummaryLabel}>Absent</Text>
            <Text style={styles.statsSummaryValue}>{totalAbsent}</Text>
          </View>
          
          <View style={styles.statsSummaryItem}>
            <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
            <Text style={styles.statsSummaryLabel}>Total</Text>
            <Text style={styles.statsSummaryValue}>{totalActivities}</Text>
          </View>
        </View>
        
        {/* Player List - Display only players from the selected team or all teams */}
        <Text style={styles.sectionTitle}>Player Attendance</Text>
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
                <View style={styles.attendanceStatus}>
                  {player.attendance_percentage > 0 ? (
                    player.attendance_percentage >= 70 ? (
                      <>
                        <MaterialCommunityIcons name="check" size={20} color={COLORS.success} />
                        <Text style={[styles.attendanceStatusText, { color: COLORS.success }]}>Good</Text>
                      </>
                    ) : player.attendance_percentage >= 50 ? (
                      <>
                        <MaterialCommunityIcons name="alert" size={20} color={COLORS.warning} />
                        <Text style={[styles.attendanceStatusText, { color: COLORS.warning }]}>Average</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="close" size={20} color={COLORS.error} />
                        <Text style={[styles.attendanceStatusText, { color: COLORS.error }]}>Poor</Text>
                      </>
                    )
                  ) : (
                    <>
                      <MaterialCommunityIcons name="minus" size={20} color={COLORS.grey[500]} />
                      <Text style={[styles.attendanceStatusText, { color: COLORS.grey[500] }]}>No Data</Text>
                    </>
                  )}
                </View>
              </View>
              
              <View style={styles.playerCardContent}>
                {!selectedTeamId && <Text style={styles.teamNameText}>{player.team_name}</Text>}
                {player.total_activities > 0 ? (
                  <>
                    <Text style={styles.attendanceDetailText}>
                      Present: <Text style={styles.attendanceDetailValue}>{player.present_count}</Text> |
                      Absent: <Text style={styles.attendanceDetailValue}>{player.absent_count}</Text> |
                      Total: <Text style={styles.attendanceDetailValue}>{player.total_activities}</Text>
                    </Text>
                    <Text style={styles.attendanceRateText}>
                      Attendance Rate: <Text style={styles.attendanceRateValue}>{player.attendance_percentage}%</Text>
                    </Text>
                  </>
                ) : (
                  <Text style={styles.attendanceDetailText}>No attendance data available for this period</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render team statistics
  const renderTeamStats = () => {
    if (filteredTeamStats.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="account-group" size={48} color={COLORS.grey[400]} />
          <Text style={styles.emptyStateText}>No team statistics found for this period</Text>
        </View>
      );
    }

    // Update the stats calculation to use filteredTeamStats
    const totalTeams = filteredTeamStats.length;
    const totalPresent = filteredTeamStats.reduce((sum, team) => sum + team.present_count, 0);
    const totalAbsent = filteredTeamStats.reduce((sum, team) => sum + team.absent_count, 0);
    const totalAttendance = totalPresent + totalAbsent;
    const overallPercentage = totalAttendance > 0 
      ? Math.round((totalPresent / totalAttendance) * 100) 
      : 0;

    return (
      <View style={styles.statsContainer}>
        {/* Search Bar */}
        {renderSearchBar()}
        
        {/* Summary Header */}
        <View style={styles.teamStatsSummary}>
          <Text style={styles.teamStatsSummaryTitle}>Overall Attendance</Text>
          <View style={styles.teamStatsSummaryContent}>
            <View style={styles.attendancePercentageCircle}>
              <Text style={styles.attendancePercentageText}>{overallPercentage}%</Text>
            </View>
            <View style={styles.teamStatsSummaryDetails}>
              <Text style={styles.teamStatsSummaryDetailText}>
                {totalTeams} Team{totalTeams !== 1 ? 's' : ''} | {totalPresent} Present | {totalAbsent} Absent
              </Text>
              <Text style={styles.teamStatsSummaryPeriodText}>
                {months[selectedMonth]} {selectedYear}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Team List */}
        <Text style={styles.sectionTitle}>Team Attendance</Text>
        
        {filteredTeamStats.map((team) => (
          <View key={team.team_id} style={styles.teamStatCard}>
            <Text style={styles.teamStatTitle}>{team.team_name}</Text>
            <View style={styles.teamStatContent}>
              <MaterialCommunityIcons 
                name={team.attendance_percentage >= 70 ? "check-circle" : team.attendance_percentage >= 50 ? "alert-circle" : "close-circle"} 
                size={24} 
                color={team.attendance_percentage >= 70 ? COLORS.success : team.attendance_percentage >= 50 ? COLORS.warning : COLORS.error} 
              />
              <Text style={styles.teamStatValue}>{team.attendance_percentage}%</Text>
              {team.total_activities > 0 ? (
                <Text style={styles.teamStatDetail}>
                  ({team.present_count}/{team.total_activities} players present)
                </Text>
              ) : (
                <Text style={styles.teamStatDetail}>(No attendance records)</Text>
              )}
            </View>
            {selectedActivityType !== 'all' && (
              <Text style={styles.teamStatActivityType}>
                Activity type: {selectedActivityType}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Main render function
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Attendance Statistics</Text>
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
    paddingTop: 60,
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
  statsSummary: {
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
  statsSummaryItem: {
    alignItems: 'center',
  },
  statsSummaryLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
  },
  statsSummaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
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
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendanceStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  playerCardContent: {
    marginTop: SPACING.sm,
  },
  attendanceDetailText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: 4,
  },
  attendanceDetailValue: {
    fontWeight: '500',
    color: COLORS.text,
  },
  attendanceRateText: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  attendanceRateValue: {
    fontWeight: '500',
    color: COLORS.text,
  },
  teamStatsSummary: {
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
  teamStatsSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  teamStatsSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendancePercentageCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  attendancePercentageText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamStatsSummaryDetails: {
    flex: 1,
  },
  teamStatsSummaryDetailText: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  teamStatsSummaryPeriodText: {
    fontSize: 12,
    color: COLORS.grey[600],
  },
  teamStatActivityType: {
    fontSize: 12,
    color: COLORS.grey[600],
    marginTop: SPACING.xs,
    fontStyle: 'italic',
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
  teamStatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  teamStatContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  teamStatDetail: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: SPACING.sm,
  },
  teamDropdownMenu: {
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
  teamDropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  teamDropdownMenuItemSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  teamDropdownMenuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  teamDropdownMenuItemTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
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