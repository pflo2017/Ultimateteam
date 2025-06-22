import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import { RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { ManageTeamsScreen } from './ManageTeamsScreen';
import { ManageCoachesScreen } from './ManageCoachesScreen';
import { ManagePlayersScreen } from './ManagePlayersScreen';
import { registerEventListener } from '../../utils/events';
import { getUserClubId } from '../../services/activitiesService';

type CardType = 'teams' | 'coaches' | 'players' | 'payments';

interface Team {
  id: string;
  name: string;
  access_code: string;
  created_at: string;
  is_active: boolean;
  coach_id: string | null;
  coach: {
    id: string;
    name: string;
  } | null;
  players_count: number;
}

interface Coach {
  id: string;
  name: string;
  phone_number: string;
  created_at: string;
  is_active: boolean;
  teams: {
    id: string;
    name: string;
  }[];
}

interface Player {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  team_id: string | null;
  team: {
    name: string;
  } | null;
  medicalVisaStatus: string;
  paymentStatus: string;
  payment_status?: string;
  last_payment_date?: string;
  birth_date?: string | null;
  parent_id?: string;
  medical_visa_status?: string;
  medical_visa_issue_date?: string;
  medicalVisaIssueDate?: string;
}

interface ParentChild {
  id: string;
  parent_id: string;
  full_name: string;
  medical_visa_status: string;
  medical_visa_issue_date: string | null;
  team_id: string;
  birth_date: string;
}

type ManageScreenParams = {
  activeTab?: CardType;
  refresh?: boolean | number;
};

interface SupabaseTeam {
  id: string;
  name: string;
  access_code: string;
  created_at: string;
  is_active: boolean;
  coach_id: string | null;
  coach: {
    id: string;
    name: string;
  } | null;
  players: { count: number }[];
}

export const AdminManageScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const route = useRoute<RouteProp<AdminStackParamList, 'Manage'>>();
  const [activeTab, setActiveTab] = useState<CardType>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFocused = useIsFocused();

  useEffect(() => {
    if (route.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route.params?.activeTab]);

  useEffect(() => {
    if (route.params?.refresh) {
      console.log('Refresh parameter detected, reloading data...');
      loadData();
    }
  }, [route.params?.refresh]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  // Add event listener for payment status changes
  useEffect(() => {
    // Listen for payment status changes from PaymentsScreen
    const handlePaymentStatusChange = () => {
      console.log('Payment status changed, refreshing players data');
      fetchPlayers();
    };

    // Add event listener and get the unregister function
    const unregister = registerEventListener('payment_status_changed', handlePaymentStatusChange);

    // Clean up the listener when component unmounts
    return () => {
      unregister();
    };
  }, []);

  // Add event listener for medical_visa_status_changed events
  useEffect(() => {
    // Listen for medical_visa_status_changed events
    const handleMedicalVisaStatusChange = () => {
      console.log('Medical visa status changed, refreshing players data');
      fetchPlayers();
    };

    // Add event listener and get the unregister function
    const unregister = registerEventListener('medical_visa_status_changed', handleMedicalVisaStatusChange);

    // Clean up the listener when component unmounts
    return () => {
      unregister();
    };
  }, []);

  // Add event listener for player_deleted events
  useEffect(() => {
    // Listen for player deletion events
    const handlePlayerDeleted = () => {
      console.log('Player deleted, refreshing players data');
      fetchPlayers();
    };

    // Add event listener and get the unregister function
    const unregister = registerEventListener('player_deleted', handlePlayerDeleted);

    // Clean up the listener when component unmounts
    return () => {
      unregister();
    };
  }, []);

  const fetchTeams = async () => {
    try {
      console.log('Fetching teams...');
      
      // Get the current user's club ID
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        return;
      }

      console.log('Fetching teams for club:', clubId);
      
      // IMPORTANT: Always filter by club_id to ensure proper data isolation between clubs
      // This prevents admins from seeing teams from other clubs/academies
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          access_code,
          created_at,
          is_active,
          coach_id,
          players!inner(count)
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .eq('players.is_active', true) // Only count active players
        .order('name');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return;
      }

      // Then get all coaches
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('is_active', true);

      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
        return;
      }

      console.log('Teams data:', teamsData);
      console.log('Active teams count:', teamsData?.length || 0);
      console.log('Coaches data:', coachesData);

      // Create a map of coach data for quick lookup
      const coachesMap = new Map(coachesData?.map(coach => [coach.id, coach]));

      const transformedTeams: Team[] = teamsData.map(team => ({
        id: team.id,
        name: team.name,
        access_code: team.access_code,
        created_at: team.created_at,
        is_active: team.is_active,
        coach_id: team.coach_id,
        coach: team.coach_id ? {
          id: team.coach_id,
          name: coachesMap.get(team.coach_id)?.name || ''
        } : null,
        players_count: team.players[0]?.count || 0
      }));

      console.log('Transformed teams:', transformedTeams);
      setTeams(transformedTeams);
    } catch (error) {
      console.error('Error in fetchTeams:', error);
    }
  };

  const fetchCoaches = async () => {
    try {
      // Get the current user's club ID
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        return;
      }

      // IMPORTANT: Always filter by club_id to ensure proper data isolation between clubs
      // This prevents admins from seeing coaches from other clubs/academies
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select(`
          id,
          name,
          phone_number,
          created_at,
          is_active,
          user_id,
          teams (
            id,
            name
          )
        `)
        .eq('club_id', clubId);
      
      if (coachesError) throw coachesError;
      setCoaches(coachesData || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
      // Get the current user's club ID first
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        return;
      }

      // First get players data
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          created_at,
          is_active,
          team_id,
          parent_id,
          birth_date,
          payment_status,
          last_payment_date,
          medical_visa_status,
          medical_visa_issue_date,
          teams:team_id(id, name)
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');

      if (playersError) throw playersError;

      console.log('Raw players data from DB:', JSON.stringify(playersData, null, 2));
      
      // Log all players' medical visa status for debugging
      console.log("Admin - All players medical visa status:", playersData.map(p => ({
        id: p.id,
        name: p.name,
        medical_visa_status: p.medical_visa_status,
        medical_visa_issue_date: p.medical_visa_issue_date
      })));
      
      // Fetch related parent_children data for additional info
      const playerIds = playersData.map(player => player.id);
      const parentIds = playersData
        .filter(player => player.parent_id)
        .map(player => player.parent_id);

      const { data: parentChildrenData, error: parentChildrenError } = await supabase
        .from('parent_children')
        .select(`
          id,
          parent_id,
          full_name,
          medical_visa_status,
          medical_visa_issue_date,
          birth_date,
          team_id
        `)
        .in('parent_id', parentIds)
        .eq('is_active', true);

      if (parentChildrenError) throw parentChildrenError;

      console.log('Parent children data:', JSON.stringify(parentChildrenData, null, 2));

      // Create a map for quick lookup
      const childrenMap = new Map<string, ParentChild[]>();
      (parentChildrenData as ParentChild[]).forEach(child => {
        if (!childrenMap.has(child.parent_id)) {
          childrenMap.set(child.parent_id, []);
        }
        childrenMap.get(child.parent_id)!.push(child);
      });

      // Get teams data ONLY for the current club
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId) // Add club_id filter to ensure data isolation
        .eq('is_active', true); // Only get active teams
      
      if (teamsError) throw teamsError;
      
      console.log('Teams data for club:', JSON.stringify(teamsData, null, 2));
      
      // Create a map of teams for easy lookup
      const teamsMap = new Map();
      teamsData.forEach(team => {
        teamsMap.set(team.id, team);
      });

      // Transform players data with parent_children data
      const transformedPlayers = playersData.map(player => {
        // Use medical visa status directly from players table
        let medicalVisaStatus = player.medical_visa_status;
        console.log(`[DEBUG] Admin - Player ${player.name} raw medical visa status: ${medicalVisaStatus}`);
        // Don't default to 'pending' - use the actual value from the database
        let paymentStatus = player.payment_status || 'pending';
        let teamId = player.team_id;
        let teamName = null;
        let birthDate = player.birth_date;
        let matchingChild = undefined;
        
        // Check for recently joined players - set to on_trial ONLY if no status is set
        if (!player.payment_status) {
          const createdAt = new Date(player.created_at);
          const now = new Date();
          const diff = now.getTime() - createdAt.getTime();
          const isOnTrial = diff < 30 * 24 * 60 * 60 * 1000;
          if (isOnTrial) paymentStatus = 'on_trial';
        }
        
        // Still check parent_children for additional info
        if (player.parent_id && childrenMap.has(player.parent_id)) {
          const childrenForParent = childrenMap.get(player.parent_id);
          matchingChild = childrenForParent?.find(
            child => child.full_name.toLowerCase() === player.name.toLowerCase()
          );
          
          if (matchingChild) {
            // Only use birth_date and team info from parent_children if needed
            if (!player.birth_date && matchingChild.birth_date) {
              birthDate = matchingChild.birth_date;
            }
            if (!player.team_id && matchingChild.team_id && teamsMap.has(matchingChild.team_id)) {
              teamId = matchingChild.team_id;
              teamName = teamsMap.get(matchingChild.team_id).name;
            }
          }
        }
        
        if (!teamName && player.team_id && teamsMap.has(player.team_id)) {
          teamName = teamsMap.get(player.team_id).name;
        }
        
        return {
          id: player.id,
          name: player.name,
          created_at: player.created_at,
          is_active: player.is_active,
          team_id: teamId,
          team: teamName ? { name: teamName } : null,
          medicalVisaStatus: medicalVisaStatus,
          paymentStatus,
          payment_status: paymentStatus,
          parent_id: player.parent_id,
          birth_date: birthDate,
          last_payment_date: player.last_payment_date,
          medicalVisaIssueDate: player.medical_visa_issue_date,
        };
      });

      setPlayers(transformedPlayers);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchTeams(),
      fetchCoaches(),
      fetchPlayers()
    ]);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Success', 'Code copied to clipboard');
    } catch (error) {
      console.error('Error copying code:', error);
      Alert.alert('Error', 'Failed to copy code');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.horizontalTabsRow}>
        <View style={styles.horizontalTabsContainer}>
          <TouchableOpacity
            style={styles.horizontalTabButton}
            onPress={() => setActiveTab('teams')}
          >
            <Text style={[styles.horizontalTabText, activeTab === 'teams' && styles.horizontalTabTextActive]}>Teams</Text>
            {activeTab === 'teams' && <View style={styles.horizontalTabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.horizontalTabButton}
            onPress={() => setActiveTab('coaches')}
          >
            <Text style={[styles.horizontalTabText, activeTab === 'coaches' && styles.horizontalTabTextActive]}>Coaches</Text>
            {activeTab === 'coaches' && <View style={styles.horizontalTabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.horizontalTabButton}
            onPress={() => setActiveTab('players')}
          >
            <Text style={[styles.horizontalTabText, activeTab === 'players' && styles.horizontalTabTextActive]}>Players</Text>
            {activeTab === 'players' && <View style={styles.horizontalTabUnderline} />}
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'teams' && (
        <ManageTeamsScreen
          teams={teams}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onCopyAccessCode={handleCopyCode}
        />
      )}

      {activeTab === 'coaches' && (
        <ManageCoachesScreen
          coaches={coaches}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onCopyAccessCode={handleCopyCode}
        />
      )}

      {activeTab === 'players' && (
        <ManagePlayersScreen
          players={players}
          teams={teams}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  horizontalTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  horizontalTabsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
    flex: 1,
  },
  horizontalTabButton: {
    alignItems: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 4,
  },
  horizontalTabText: {
    fontSize: 16,
    color: COLORS.grey[600],
    fontWeight: '400',
  },
  horizontalTabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  horizontalTabUnderline: {
    marginTop: 2,
    height: 4,
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
}); 