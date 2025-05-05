import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
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
  access_code: string;
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
}

interface ParentChild {
  id: string;
  parent_id: string;
  full_name: string;
  medical_visa_status: string;
  medical_visa_issue_date: string | null;
  team_id: string;
}

type ManageScreenParams = {
  activeTab?: CardType;
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

  const fetchTeams = async () => {
    try {
      console.log('Fetching teams...');
      
      // Get the current user's club ID first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();

      if (!club) {
        console.error('No club found for user');
        return;
      }

      console.log('Fetching teams for club:', club.id);
      
      // First get the teams with basic info
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          access_code,
          created_at,
          is_active,
          coach_id,
          players(count)
        `)
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('name');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return;
      }

      // Then get all coaches
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('club_id', club.id)
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
      const { data, error } = await supabase
        .from('coaches')
        .select(`
          id,
          name,
          phone_number,
          access_code,
          created_at,
          is_active,
          teams:teams(id, name)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const transformedCoaches: Coach[] = data.map(coach => ({
        id: coach.id,
        name: coach.name,
        phone_number: coach.phone_number,
        access_code: coach.access_code,
        created_at: coach.created_at,
        is_active: coach.is_active,
        teams: coach.teams || []
      }));

      setCoaches(transformedCoaches);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
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
          teams:team_id(id, name)
        `)
        .eq('is_active', true)
        .order('name');

      if (playersError) throw playersError;

      console.log('Raw players data from DB:', JSON.stringify(playersData, null, 2));
      
      // Fetch related parent_children data for medical visa status
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

      // Get all team data
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name');
      
      if (teamsError) throw teamsError;
      
      console.log('Teams data:', JSON.stringify(teamsData, null, 2));
      
      // Create a map of teams for easy lookup
      const teamsMap = new Map();
      teamsData.forEach(team => {
        teamsMap.set(team.id, team);
      });

      // Transform players data with parent_children data
      const transformedPlayers = playersData.map(player => {
        // Find matching child record
        let medicalVisaStatus = 'unknown';
        let paymentStatus = 'pending'; // Default value until implemented
        let teamId = player.team_id;
        let teamName = null;
        
        // Check if player has team_id directly
        if (player.team_id && teamsMap.has(player.team_id)) {
          teamName = teamsMap.get(player.team_id).name;
        }
        
        if (player.parent_id && childrenMap.has(player.parent_id)) {
          const childrenForParent = childrenMap.get(player.parent_id);
          // Find child with matching name
          const matchingChild = childrenForParent?.find(
            child => child.full_name.toLowerCase() === player.name.toLowerCase()
          );
          
          if (matchingChild) {
            medicalVisaStatus = matchingChild.medical_visa_status;
            
            // If no team from player record, try to get it from parent_children
            if (!teamName && matchingChild.team_id && teamsMap.has(matchingChild.team_id)) {
              teamId = matchingChild.team_id;
              teamName = teamsMap.get(matchingChild.team_id).name;
            }
          }
        }

        console.log(`Player ${player.name} team details:`, {
          player_team_id: player.team_id,
          teams_field: player.teams,
          final_team_name: teamName
        });

        return {
          id: player.id,
          name: player.name,
          created_at: player.created_at,
          is_active: player.is_active,
          team_id: teamId,
          team: teamName ? { name: teamName } : null,
          medicalVisaStatus,
          paymentStatus,
          parent_id: player.parent_id
        };
      });

      setPlayers(transformedPlayers);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

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
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CardType)}
          buttons={[
            { value: 'teams', label: 'Teams' },
            { value: 'coaches', label: 'Coaches' },
            { value: 'players', label: 'Players' },
          ]}
          style={styles.segmentedButtons}
          theme={{
            colors: {
              primary: '#212121',
              secondaryContainer: '#F5F5F5',
              onSecondaryContainer: '#212121',
              outline: '#E0E0E0',
            }
          }}
        />
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
  tabContainer: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  segmentedButtons: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    elevation: 0,
    shadowColor: 'transparent',
  },
}); 