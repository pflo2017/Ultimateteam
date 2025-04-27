import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachManageTeamsScreen } from './CoachManageTeamsScreen';
import { CoachManagePlayersScreen } from './CoachManagePlayersScreen';

interface Team {
  id: string;
  name: string;
  players_count: number;
}

interface Player {
  id: string;
  name: string;
  team_id: string;
  team_name: string;
}

export const CoachManageScreen = () => {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      console.log('Stored coach data:', storedCoachData);
      
      if (!storedCoachData) {
        console.log('No stored coach data found');
        return;
      }

      const coachData = JSON.parse(storedCoachData);
      console.log('Loading data for coach:', coachData);

      // Verify coach access
      const { data: verifyData, error: verifyError } = await supabase
        .rpc('verify_coach_access', { p_access_code: coachData.access_code });

      if (verifyError) {
        console.error('Error verifying coach access:', verifyError);
        Alert.alert('Error', 'Failed to verify coach access. Please try logging in again.');
        return;
      }

      if (!verifyData?.is_valid) {
        console.error('Invalid coach access');
        Alert.alert('Error', 'Invalid coach access. Please try logging in again.');
        return;
      }

      // Load teams using the get_coach_teams function
      console.log('Fetching teams for coach ID:', coachData.id);
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        Alert.alert('Error', 'Failed to load teams. Please try again.');
        return;
      }

      console.log('Teams fetched:', teamsData);

      // Transform teams data
      const transformedTeams = (teamsData || []).map((team: { team_id: string; team_name: string; player_count?: number }) => ({
        id: team.team_id,
        name: team.team_name,
        players_count: team.player_count || 0
      }));

      console.log('Transformed teams:', transformedTeams);
      setTeams(transformedTeams);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={value => setActiveTab(value as 'teams' | 'players')}
          buttons={[
            { value: 'teams', label: 'My Teams' },
            { value: 'players', label: 'My Players' }
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

      {activeTab === 'teams' ? (
        <CoachManageTeamsScreen
          teams={teams}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      ) : (
        <CoachManagePlayersScreen
          players={players}
          teams={teams}
          isLoading={isLoading}
          refreshing={refreshing}
          searchQuery={searchQuery}
          selectedTeamId={selectedTeamId}
          onRefresh={handleRefresh}
          onSearchChange={setSearchQuery}
          onTeamSelect={setSelectedTeamId}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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