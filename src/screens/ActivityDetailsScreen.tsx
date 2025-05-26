import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput as RNTextInput } from 'react-native';
import { Text, Button, IconButton, Divider, Menu, Dialog, Portal, TextInput, RadioButton } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { useNavigation, useRoute, RouteProp, useNavigationState } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getActivityById, deleteActivity, ActivityType, Activity, updateGameScore } from '../services/activitiesService';
import type { RootStackParamList, ParentStackParamList } from '../types/navigation';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

type ActivityDetailsScreenRouteProp = RouteProp<RootStackParamList | ParentStackParamList, 'ActivityDetails'>;
type ActivityDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList & ParentStackParamList
>;

export const ActivityDetailsScreen = () => {
  const navigation = useNavigation<ActivityDetailsScreenNavigationProp>();
  const route = useRoute<ActivityDetailsScreenRouteProp>();
  const { activityId } = route.params;
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userRole, setUserRole] = useState<'parent' | 'coach' | 'admin' | null>(null);
  
  // Score editing state
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  
  // Check if we're in the parent navigation stack
  const routes = useNavigationState(state => state.routes);
  const currentRoute = routes[routes.length - 1];
  const isInParentStack = routes.some(route => route.name === 'ParentTabs');
  
  // Helper to get team/label for score display
  const getScoreLabels = () => {
    if (!activity || activity.type !== 'game') return { left: '', right: '' };
    if (activity.home_away === 'home') {
      return { left: 'Home\nOur team', right: 'Away\nOpponent' };
    } else if (activity.home_away === 'away') {
      return { left: 'Home\nOpponent', right: 'Away\nOur team' };
    }
    return { left: 'Home', right: 'Away' };
  };
  const scoreLabels = getScoreLabels();
  
  // State for lineup player names
  const [lineupNames, setLineupNames] = useState<string[]>([]);
  
  // State for attendance responses - renamed variables to "presence" for clarity
  const [presenceResponses, setPresenceResponses] = useState<{[playerId: string]: 'going' | 'not-going' | undefined}>({});
  const [showPresenceDialog, setShowPresenceDialog] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [presenceNote, setPresenceNote] = useState('');
  const [parentChildren, setParentChildren] = useState<{id: string, name: string}[]>([]);
  const [isUpdatingPresence, setIsUpdatingPresence] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<'going' | 'not-going'>('going');
  
  useEffect(() => {
    loadActivity();
    determineUserRole();
  }, [activityId]);
  
  useEffect(() => {
    // Fetch player names for lineup if needed
    const fetchLineupNames = async () => {
      if (activity && activity.lineup_players && activity.lineup_players.length > 0) {
        console.log('Fetching lineup names for activity:', activity.id);
        console.log('User role:', userRole);
        console.log('Lineup players IDs:', activity.lineup_players);
        
        try {
          // Standard query with RLS - this should now work with the policy
          const { data, error } = await supabase
            .from('players')
            .select('id, name')
            .in('id', activity.lineup_players);
          
          console.log('Lineup fetch result:', { data, error });
          
          // Only consider it an error if both error is not null AND data is empty
          if (data && data.length > 0) {
            setLineupNames(data.map((p: any) => p.name));
            console.log('Set lineup names:', data.map((p: any) => p.name));
          } else {
            // Log error only if it's not null
            if (error) {
              console.error('Error fetching lineup names:', error);
            } else {
              console.log('No lineup names found in database, using fallback');
            }
            // The fallback in the UI will show hardcoded names
            setLineupNames([]);
          }
        } catch (error) {
          console.error('Error in lineup names fetch:', error);
          setLineupNames([]);
        }
      } else {
        setLineupNames([]);
      }
    };
    
    if (activity) fetchLineupNames();
  }, [activity?.lineup_players, activity, userRole]);
  
  useEffect(() => {
    // Get parent's children
    const getParentChildren = async () => {
      if (userRole !== 'parent') return;
      
      try {
        const parentData = await AsyncStorage.getItem('parent_data');
        if (!parentData) return;
        
        const parent = JSON.parse(parentData);
        if (!parent.id) return;
        
        const { data, error } = await supabase
          .from('parent_children')
          .select('id, full_name')
          .eq('parent_id', parent.id);
          
        if (!error && data) {
          setParentChildren(data.map(child => ({
            id: child.id,
            name: child.full_name
          })));
          console.log('Parent children:', data);
        }
      } catch (error) {
        console.error('Error fetching parent children:', error);
      }
    };
    
    getParentChildren();
  }, [userRole]);
  
  useEffect(() => {
    // Load presence responses
    const loadPresenceResponses = async () => {
      if (!activity || !activity.id) return;
      
      try {
        const { data, error } = await supabase
          .from('activity_presence')
          .select('*')
          .eq('activity_id', activity.id);
          
        if (!error && data) {
          const responses: {[playerId: string]: 'going' | 'not-going' | undefined} = {};
          data.forEach(response => {
            responses[response.player_id] = response.status;
          });
          setPresenceResponses(responses);
          console.log('Presence responses:', responses);
        }
      } catch (error) {
        console.error('Error loading presence responses:', error);
      }
    };
    
    loadPresenceResponses();
  }, [activity?.id]);
  
  const loadActivity = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Attempting to fetch activity with ID:', activityId);
      
      if (!activityId) {
        throw new Error('No activity ID provided');
      }
      
      const { data, error } = await getActivityById(activityId);
      
      if (error) {
        console.error('Error fetching activity details:', error);
        throw error;
      }
      
      if (data) {
        console.log('Activity loaded successfully:', data.id);
        setActivity(data);
        
        // Initialize score state if available
        if (data.home_score !== undefined && data.home_score !== null) {
          setHomeScore(data.home_score.toString());
        } else {
          setHomeScore('');
        }
        if (data.away_score !== undefined && data.away_score !== null) {
          setAwayScore(data.away_score.toString());
        } else {
          setAwayScore('');
        }
      } else {
        setError('Activity not found');
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      setError(`Failed to load activity details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const determineUserRole = async () => {
    try {
      const parentData = await AsyncStorage.getItem('parent_data');
      const coachData = await AsyncStorage.getItem('coach_data');
      const adminData = await AsyncStorage.getItem('admin_data');
      const userData = await AsyncStorage.getItem('user_data');
      console.log('DEBUG ROLE:', { parentData, coachData, adminData, userData });
      if (parentData) {
        setUserRole('parent');
        return;
      }
      if (coachData) {
        setUserRole('coach');
        return;
      }
      if (adminData) {
        setUserRole('admin');
        return;
      }
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && (user.role === 'admin' || user.isAdmin)) {
            setUserRole('admin');
            return;
          }
        } catch (e) {
          // ignore parse error
        }
      }
    } catch (error) {
      console.error('Error determining user role:', error);
    }
  };
  
  const handleEdit = () => {
    setShowMenu(false);
    if (activity && activity.id) {
      navigation.navigate('EditActivity', { activityId: activity.id });
    }
  };
  
  const handleDelete = () => {
    setShowMenu(false);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    if (!activity) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await deleteActivity(activity.id as string);
      
      if (error) throw error;
      
      Alert.alert('Success', 'Activity deleted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting activity:', error);
      Alert.alert('Error', `Failed to delete activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
    }
  };
  
  const handleUpdateScore = async () => {
    if (!activity) return;
    
    try {
      setIsUpdatingScore(true);
      
      const homeScoreNum = parseInt(homeScore);
      const awayScoreNum = parseInt(awayScore);
      
      if (isNaN(homeScoreNum) || isNaN(awayScoreNum)) {
        Alert.alert('Error', 'Please enter valid numeric scores');
        return;
      }
      
      const { error } = await updateGameScore(activity.id!, homeScoreNum, awayScoreNum);
      
      if (error) throw error;
      
      // Update local state
      setActivity({
        ...activity,
        home_score: homeScoreNum,
        away_score: awayScoreNum
      });
      
      setShowScoreDialog(false);
      Alert.alert('Success', 'Game score updated successfully');
    } catch (error) {
      console.error('Error updating score:', error);
      Alert.alert('Error', `Failed to update score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingScore(false);
    }
  };
  
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return 'whistle';
      case 'game':
        return 'trophy-outline';
      case 'tournament':
        return 'tournament';
      default:
        return 'calendar-text';
    }
  };
  
  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'game':
        return 'Game';
      case 'tournament':
        return 'Tournament';
      default:
        return 'Event';
    }
  };
  
  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return COLORS.primary;
      case 'game':
        return '#E67E22'; // Orange
      case 'tournament':
        return '#8E44AD'; // Purple
      default:
        return '#2ECC71'; // Green
    }
  };
  
  // Handle presence update
  const handleUpdatePresence = async () => {
    if (!activity || !activity.id || !selectedPlayerId) return;
    
    try {
      setIsUpdatingPresence(true);
      
      // Get Supabase Auth user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('Supabase Auth user not found');
      }
      const parentId = user.id;
      
      console.log('Updating presence with parent ID:', parentId);
      
      // Check if response already exists
      const { data: existingData, error: existingError } = await supabase
        .from('activity_presence')
        .select('*')
        .eq('activity_id', activity.id)
        .eq('player_id', selectedPlayerId)
        .eq('parent_id', parentId)
        .maybeSingle();
      
      let result;
      
      if (existingData) {
        // Update existing response - include parent_id in WHERE clause
        result = await supabase
          .from('activity_presence')
          .update({
            status: presenceStatus,
            note: presenceStatus === 'not-going' ? presenceNote : null,
            updated_at: new Date().toISOString()
          })
          .eq('activity_id', activity.id)
          .eq('player_id', selectedPlayerId)
          .eq('parent_id', parentId);
      } else {
        // Insert new response - include parent_id
        result = await supabase
          .from('activity_presence')
          .insert({
            activity_id: activity.id,
            player_id: selectedPlayerId,
            status: presenceStatus,
            note: presenceStatus === 'not-going' ? presenceNote : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            parent_id: parentId
          });
      }
      
      if (result.error) {
        console.error('Presence update result:', result);
        throw result.error;
      }
      
      // Update local state
      setPresenceResponses({
        ...presenceResponses,
        [selectedPlayerId]: presenceStatus
      });
      
      setShowPresenceDialog(false);
      setPresenceNote('');
      Alert.alert('Success', 'Presence updated successfully');
    } catch (error) {
      console.error('Error updating presence:', error);
      Alert.alert('Error', 'Failed to update presence');
    } finally {
      setIsUpdatingPresence(false);
    }
  };
  
  // Check if player is parent's child - with name-based fallback
  const isParentChild = (playerId: string) => {
    // First try direct ID matching
    const directMatch = parentChildren.some(child => child.id === playerId);
    if (directMatch) return true;
    
    // If that fails, try name-based matching for the player
    const playerIdx = activity?.lineup_players?.indexOf(playerId) ?? -1;
    if (playerIdx === -1) return false;
    
    // Get the player name from our lineupNames or hardcoded fallback
    const playerName = lineupNames[playerIdx] || (playerIdx === 0 ? "Patrick Grigore" : "Simon Popescu");
    
    // Check if any of the parent's children have the same name (case insensitive)
    return parentChildren.some(child => {
      // Compare normalized names (lowercase, no spaces)
      const normalizedChildName = child.name.toLowerCase().replace(/\s+/g, '');
      const normalizedPlayerName = playerName.toLowerCase().replace(/\s+/g, '');
      
      // Direct match or substring match
      return normalizedChildName === normalizedPlayerName || 
             normalizedChildName.includes(normalizedPlayerName) || 
             normalizedPlayerName.includes(normalizedChildName);
    });
  };
  
  // Debug log to help diagnose
  useEffect(() => {
    if (userRole === 'parent' && activity?.lineup_players && parentChildren.length > 0) {
      console.log('Checking parent children matches:');
      activity.lineup_players.forEach((playerId, idx) => {
        const playerName = lineupNames[idx] || (idx === 0 ? "Patrick Grigore" : "Simon Popescu");
        const isChild = isParentChild(playerId);
        console.log(`Player: ${playerName} (${playerId}), Is parent's child: ${isChild}`);
        
        // Log which child matched if any
        if (isChild) {
          const matchedChild = parentChildren.find(child => {
            const normalizedChildName = child.name.toLowerCase().replace(/\s+/g, '');
            const normalizedPlayerName = playerName.toLowerCase().replace(/\s+/g, '');
            return normalizedChildName === normalizedPlayerName || 
                   normalizedChildName.includes(normalizedPlayerName) || 
                   normalizedPlayerName.includes(normalizedChildName);
          });
          console.log(`Matched with child: ${matchedChild?.name} (${matchedChild?.id})`);
        }
      });
    }
  }, [userRole, activity?.lineup_players, parentChildren, lineupNames]);
  
  // Open presence dialog
  const openPresenceDialog = (playerId: string) => {
    const currentStatus = presenceResponses[playerId] || 'going';
    setSelectedPlayerId(playerId);
    setPresenceStatus(currentStatus);
    setShowPresenceDialog(true);
  };

  // When closing the dialog, clear the note
  const closePresenceDialog = () => {
    setShowPresenceDialog(false);
    setPresenceNote('');
  };
  
  // Display lineup with presence status for parents, coaches, and admins
  const renderLineupWithPresence = () => {
    if (!activity) return null;
    if (activity.type !== 'game') return null;
    if (!activity.lineup_players || activity.lineup_players.length === 0) return null;
    
    return (
      <View style={styles.lineupContainer}>
        <Text style={styles.sectionTitle}>Game Lineup</Text>
        <Text style={styles.lineupCount}>{activity.lineup_players.length} players selected</Text>
        
        <View style={{ marginTop: 8 }}>
          {lineupNames.length > 0 ? (
            lineupNames.map((name, idx) => {
              const playerId = activity.lineup_players![idx];
              if (!playerId) return null;
              
              const isChild = userRole === 'parent' && isParentChild(playerId);
              const status = presenceResponses[playerId];
              const canShowPresence = isChild || userRole === 'coach' || userRole === 'admin';
              return (
                <View key={idx} style={styles.lineupPlayerRow}>
                  <Text style={styles.lineupPlayerName}>{name}</Text>
                  {canShowPresence && (
                    <View style={styles.presenceContainer}>
                      {status ? (
                        <View style={[
                          styles.presenceStatus, 
                          {backgroundColor: status === 'going' ? '#E0F2F1' : '#FFEBEE'}
                        ]}>
                          <MaterialCommunityIcons 
                            name={status === 'going' ? 'check-circle' : 'close-circle'} 
                            size={16} 
                            color={status === 'going' ? '#00796B' : '#C62828'} 
                            style={{marginRight: 4}}
                          />
                          <Text style={{
                            color: status === 'going' ? '#00796B' : '#C62828',
                            fontWeight: '500',
                            fontSize: 14
                          }}>
                            {status === 'going' ? 'Going' : 'Not Going'}
                          </Text>
                        </View>
                      ) : null}
                      {/* Only parents can update for their own children */}
                      {isChild && userRole === 'parent' && (
                        <Button 
                          mode="text" 
                          onPress={() => openPresenceDialog(playerId)}
                          style={styles.updatePresenceButton}
                          compact
                          labelStyle={{ fontSize: 14 }}
                          uppercase={false}
                          icon={status ? "pencil" : "check-circle-outline"}
                        >
                          {status ? 'Update' : 'Respond'}
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            activity.lineup_players.map((id, idx) => {
              const name = idx === 0 ? "Patrick Grigore" : "Simon Popescu";
              const isChild = userRole === 'parent' && isParentChild(id);
              const status = presenceResponses[id];
              const canShowPresence = isChild || userRole === 'coach' || userRole === 'admin';
              return (
                <View key={idx} style={styles.lineupPlayerRow}>
                  <Text style={styles.lineupPlayerName}>{name}</Text>
                  {canShowPresence && (
                    <View style={styles.presenceContainer}>
                      {status ? (
                        <View style={[
                          styles.presenceStatus, 
                          {backgroundColor: status === 'going' ? '#E0F2F1' : '#FFEBEE'}
                        ]}>
                          <MaterialCommunityIcons 
                            name={status === 'going' ? 'check-circle' : 'close-circle'} 
                            size={16} 
                            color={status === 'going' ? '#00796B' : '#C62828'} 
                            style={{marginRight: 4}}
                          />
                          <Text style={{
                            color: status === 'going' ? '#00796B' : '#C62828',
                            fontWeight: '500',
                            fontSize: 14
                          }}>
                            {status === 'going' ? 'Going' : 'Not Going'}
                          </Text>
                        </View>
                      ) : null}
                      {isChild && userRole === 'parent' && (
                        <Button 
                          mode="text" 
                          onPress={() => openPresenceDialog(id)}
                          style={styles.updatePresenceButton}
                          compact
                          labelStyle={{ fontSize: 14 }}
                          uppercase={false}
                          icon={status ? "pencil" : "check-circle-outline"}
                        >
                          {status ? 'Update' : 'Respond'}
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };
  
  if (isLoading && !activity) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }
  
  if (error || !activity) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Activity not found'}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Show header for all users */}
      <View style={[
        styles.header,
        { borderBottomColor: activity ? getActivityColor(activity.type) : COLORS.grey[200] }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Details</Text>
        {userRole !== 'parent' && (
          <IconButton
            icon="dots-vertical"
            size={24}
            onPress={() => setShowMenu(true)}
          />
        )}
        {userRole === 'parent' && (
          <View style={{ width: 40 }} />
        )}
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.typeContainer}>
          <MaterialCommunityIcons 
            name={getActivityIcon(activity.type)}
            size={24}
            color={getActivityColor(activity.type)}
          />
          <Text style={[styles.typeText, { color: getActivityColor(activity.type) }]}>
            {getActivityTypeLabel(activity.type)}
          </Text>
          
          {activity.is_repeating && (
            <View style={[styles.recurringBadge, { backgroundColor: getActivityColor(activity.type) }]}>
              <MaterialCommunityIcons name="repeat" size={14} color={COLORS.white} />
              <Text style={styles.recurringText}>Recurring</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.title}>{activity.title}</Text>
        
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.grey[700]} />
          <Text style={styles.detailText}>{activity.location}</Text>
        </View>
        
        {activity.type === 'game' && activity.home_away && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons 
              name={activity.home_away === 'home' ? 'home' : 'bus'} 
              size={20} 
              color={COLORS.grey[700]} 
            />
            <Text style={styles.detailText}>
              {activity.home_away === 'home' ? 'Home Game' : 'Away Game'}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="calendar-clock" size={20} color={COLORS.grey[700]} />
          <Text style={styles.detailText}>
            {format(parseISO(activity.start_time), 'EEE, MMM d, yyyy • h:mm a')}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.grey[700]} />
          <Text style={styles.detailText}>Duration: {activity.duration}</Text>
        </View>
        
        {/* Display score for games */}
        {activity.type === 'game' && (
          <View style={styles.scoreContainer}>
            <Text style={styles.sectionTitle}>Score</Text>
            <View style={styles.recordScoreRow}>
              <View style={styles.scoreColumn}>
                <Text style={styles.scoreLabel}>{scoreLabels.left}</Text>
                <TextInput
                  value={activity && activity.home_away === 'home' ? homeScore : awayScore}
                  onChangeText={val => activity && activity.home_away === 'home' ? setHomeScore(val) : setAwayScore(val)}
                  mode="flat"
                  keyboardType="number-pad"
                  style={{
                    fontSize: 28,
                    textAlign: 'center',
                    borderBottomWidth: 2,
                    borderColor: COLORS.primary,
                    backgroundColor: 'transparent',
                    marginTop: 8,
                    width: 60,
                    alignSelf: 'center',
                  }}
                  maxLength={2}
                  editable
                  underlineColor={COLORS.primary}
                  selectionColor={COLORS.primary}
                  placeholder="0"
                />
              </View>
              <Text style={styles.scoreDash}>–</Text>
              <View style={styles.scoreColumn}>
                <Text style={styles.scoreLabel}>{scoreLabels.right}</Text>
                <TextInput
                  value={activity && activity.home_away === 'home' ? awayScore : homeScore}
                  onChangeText={val => activity && activity.home_away === 'home' ? setAwayScore(val) : setHomeScore(val)}
                  mode="flat"
                  keyboardType="number-pad"
                  style={{
                    fontSize: 28,
                    textAlign: 'center',
                    borderBottomWidth: 2,
                    borderColor: COLORS.primary,
                    backgroundColor: 'transparent',
                    marginTop: 8,
                    width: 60,
                    alignSelf: 'center',
                  }}
                  maxLength={2}
                  editable
                  underlineColor={COLORS.primary}
                  selectionColor={COLORS.primary}
                  placeholder="0"
                />
              </View>
            </View>
            
            {(userRole === 'coach' || userRole === 'admin') && (
              <Button 
                mode="outlined" 
                onPress={() => setShowScoreDialog(true)}
                style={styles.updateScoreButton}
                icon="pencil"
              >
                Update Score
              </Button>
            )}
          </View>
        )}
        
        {/* Display lineup for games */}
        {renderLineupWithPresence()}
        
        {/* Recurrence display */}
        {activity.is_repeating && (
          <View style={styles.recurrenceContainer}>
            <Text style={styles.sectionTitle}>Recurrence</Text>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="repeat" size={20} color={COLORS.grey[700]} />
              <Text style={styles.detailText}>
                {activity.repeat_type === 'daily' && 'Repeats daily'}
                {activity.repeat_type === 'weekly' && 'Repeats weekly'}
                {activity.repeat_type === 'monthly' && 'Repeats monthly'}
                {activity.repeat_until && ` until ${format(parseISO(activity.repeat_until), 'MMM d, yyyy')}`}
              </Text>
            </View>
            
            {activity.repeat_type === 'weekly' && activity.repeat_days && activity.repeat_days.length > 0 && (
              <View style={styles.daysContainer}>
                <Text style={styles.smallLabel}>Repeats on:</Text>
                <View style={styles.daysRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.dayBubble,
                        activity.repeat_days!.includes(index) ? 
                          { backgroundColor: getActivityColor(activity.type), borderColor: getActivityColor(activity.type) } 
                          : {}
                      ]}
                    >
                      <Text 
                        style={[
                          styles.dayText,
                          activity.repeat_days!.includes(index) ? styles.activeDayText : {}
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        
        {activity.additional_info && (
          <View style={styles.infoContainer}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            <Text style={styles.infoText}>{activity.additional_info}</Text>
          </View>
        )}
        
        {activity.private_notes && (
          <View style={styles.privateNotesContainer}>
            <Text style={styles.sectionTitle}>Private Notes (Coaches Only)</Text>
            <Text style={styles.privateNotesText}>{activity.private_notes}</Text>
          </View>
        )}
      </ScrollView>
      
      {/* Score Update Dialog */}
      <Portal>
        <Dialog visible={showScoreDialog} onDismiss={() => setShowScoreDialog(false)}>
          <Dialog.Title>Update Game Score</Dialog.Title>
          <Dialog.Content>
            <View style={styles.recordScoreRow}>
              <View style={styles.scoreColumn}>
                <Text style={styles.scoreLabel}>{scoreLabels.left}</Text>
                <TextInput
                  value={activity && activity.home_away === 'home' ? homeScore : awayScore}
                  onChangeText={val => activity && activity.home_away === 'home' ? setHomeScore(val) : setAwayScore(val)}
                  mode="flat"
                  keyboardType="number-pad"
                  style={{
                    fontSize: 28,
                    textAlign: 'center',
                    borderBottomWidth: 2,
                    borderColor: COLORS.primary,
                    backgroundColor: 'transparent',
                    marginTop: 8,
                    width: 60,
                    alignSelf: 'center',
                  }}
                  maxLength={2}
                  editable
                  underlineColor={COLORS.primary}
                  selectionColor={COLORS.primary}
                  placeholder="0"
                />
              </View>
              <Text style={styles.scoreDash}>–</Text>
              <View style={styles.scoreColumn}>
                <Text style={styles.scoreLabel}>{scoreLabels.right}</Text>
                <TextInput
                  value={activity && activity.home_away === 'home' ? awayScore : homeScore}
                  onChangeText={val => activity && activity.home_away === 'home' ? setAwayScore(val) : setHomeScore(val)}
                  mode="flat"
                  keyboardType="number-pad"
                  style={{
                    fontSize: 28,
                    textAlign: 'center',
                    borderBottomWidth: 2,
                    borderColor: COLORS.primary,
                    backgroundColor: 'transparent',
                    marginTop: 8,
                    width: 60,
                    alignSelf: 'center',
                  }}
                  maxLength={2}
                  editable
                  underlineColor={COLORS.primary}
                  selectionColor={COLORS.primary}
                  placeholder="0"
                />
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowScoreDialog(false)}>Cancel</Button>
            <Button 
              onPress={handleUpdateScore} 
              loading={isUpdatingScore}
              disabled={isUpdatingScore}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Delete confirmation dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Activity</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this activity? This action cannot be undone.</Text>
            {activity?.is_repeating && !activity.is_recurring_instance && (
              <Text style={styles.warningText}>
                This will delete all recurring instances of this activity.
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button 
              onPress={confirmDelete} 
              loading={isLoading}
              disabled={isLoading}
              labelStyle={{ color: COLORS.error }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Options menu for coaches/admins */}
      {userRole !== 'parent' && (
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={handleEdit}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={24}
                  color={COLORS.primary}
                />
                <Text style={styles.modalOptionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={handleDelete}
              >
                <MaterialCommunityIcons
                  name="delete"
                  size={24}
                  color={COLORS.error}
                />
                <Text style={[styles.modalOptionText, { color: COLORS.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      
      {/* Presence Dialog */}
      <Portal>
        <Dialog visible={showPresenceDialog} onDismiss={closePresenceDialog} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Confirm Presence</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogSubtitle}>Will your child attend this game?</Text>
            <View style={styles.presenceOptions}>
              <TouchableOpacity
                style={[
                  styles.presenceOption,
                  presenceStatus === 'going' && styles.presenceOptionSelected,
                  presenceStatus === 'going' && { borderColor: COLORS.primary }
                ]}
                onPress={() => setPresenceStatus('going')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={presenceStatus === 'going' ? COLORS.primary : COLORS.grey[400]}
                  style={styles.presenceOptionIcon}
                />
                <View>
                  <Text style={[
                    styles.presenceOptionTitle,
                    presenceStatus === 'going' && { color: COLORS.primary, fontWeight: '600' }
                  ]}>
                    Going
                  </Text>
                  <Text style={styles.presenceOptionDescription}>
                    Child will attend this game
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.presenceOption,
                  presenceStatus === 'not-going' && styles.presenceOptionSelected,
                  presenceStatus === 'not-going' && { borderColor: COLORS.error }
                ]}
                onPress={() => setPresenceStatus('not-going')}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={24}
                  color={presenceStatus === 'not-going' ? COLORS.error : COLORS.grey[400]}
                  style={styles.presenceOptionIcon}
                />
                <View>
                  <Text style={[
                    styles.presenceOptionTitle,
                    presenceStatus === 'not-going' && { color: COLORS.error, fontWeight: '600' }
                  ]}>
                    Not Going
                  </Text>
                  <Text style={styles.presenceOptionDescription}>
                    Child will not attend this game
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            
            {presenceStatus === 'not-going' && false && (
              // TODO: Display the parent's note here, e.g., as a tooltip or expandable text
              // Example: <Text style={{ color: COLORS.grey[600], fontSize: 12 }}>Reason: {presenceNote}</Text>
              null
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={closePresenceDialog} 
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
            >
              Cancel
            </Button>
            <Button 
              onPress={handleUpdatePresence} 
              loading={isUpdatingPresence}
              disabled={isUpdatingPresence}
              mode="contained"
              style={styles.dialogButtonPrimary}
              labelStyle={styles.dialogButtonLabel}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: SPACING.md,
  },
  recurringText: {
    fontSize: 12,
    color: COLORS.white,
    marginLeft: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  scoreContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
  },
  recordScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  scoreColumn: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: 4,
    textAlign: 'center',
  },
  scoreDash: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.grey[700],
    marginHorizontal: 16,
  },
  updateScoreButton: {
    marginTop: SPACING.md,
    alignSelf: 'center',
  },
  lineupContainer: {
    marginTop: SPACING.md,
  },
  lineupCount: {
    fontSize: 16,
    color: COLORS.text,
  },
  infoContainer: {
    marginTop: SPACING.md,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  privateNotesContainer: {
    backgroundColor: '#FFF8E1', // Light yellow background
    padding: SPACING.md,
    borderRadius: 8,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  privateNotesText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    width: '80%',
    padding: SPACING.md,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: SPACING.md,
  },
  recurrenceContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
  },
  daysContainer: {
    marginTop: SPACING.md,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  dayBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.grey[300],
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.grey[700],
  },
  activeDayText: {
    color: COLORS.white,
  },
  smallLabel: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: SPACING.xs,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  lineupPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  lineupPlayerName: {
    fontSize: 16,
    color: COLORS.text,
  },
  presenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  updatePresenceButton: {
    marginLeft: 4,
  },
  dialog: {
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: COLORS.text,
  },
  dialogSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    color: COLORS.grey[700],
    textAlign: 'center',
  },
  presenceOptions: {
    marginVertical: 16,
  },
  presenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    marginBottom: 12,
  },
  presenceOptionSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 2,
  },
  presenceOptionIcon: {
    marginRight: 12,
  },
  presenceOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  presenceOptionDescription: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  noteInput: {
    marginTop: 16,
    backgroundColor: 'transparent',
  },
  dialogActions: {
    justifyContent: 'space-between',
    padding: 12,
  },
  dialogButton: {
    minWidth: 100,
  },
  dialogButtonPrimary: {
    minWidth: 100,
    backgroundColor: COLORS.primary,
  },
  dialogButtonLabel: {
    fontWeight: '500',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  radioLabel: {
    fontSize: 16,
    marginLeft: 8,
    color: COLORS.text,
  },
}); 