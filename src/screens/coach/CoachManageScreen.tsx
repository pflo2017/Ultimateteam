import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Alert } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface RawTeam {
  id: string;
  name: string;
  coach_id: string;
  is_active: boolean;
}

interface RawPlayer {
  id: string;
  name: string;
  team_id: string;
  teams: { name: string };
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

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  const TeamCard = ({ team }: { team: Team }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{team.name}</Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account-multiple" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{team.players_count} players</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const PlayerCard = ({ player }: { player: Player }) => (
    <Card style={styles.playerCard}>
      <Card.Content>
        <View style={styles.playerCardContent}>
          <View style={styles.playerInfo}>
            <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
            <View>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.teamName}>{player.team_name}</Text>
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const TeamsContent = () => (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {teams.map(team => (
        <TeamCard key={team.id} team={team} />
      ))}
      {teams.length === 0 && !isLoading && (
        <Text style={styles.emptyText}>No teams assigned yet</Text>
      )}
    </ScrollView>
  );

  const PlayersContent = () => (
    <View style={styles.playersContainer}>
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search player"
          placeholderTextColor={COLORS.grey[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View style={styles.filterContainer}>
        <Pressable
          style={[styles.filterButton, !selectedTeamId && styles.activeFilterButton]}
          onPress={() => setSelectedTeamId(null)}
        >
          <Text style={[styles.filterButtonText, !selectedTeamId && styles.activeFilterButtonText]}>
            All Teams
          </Text>
        </Pressable>
        {teams.map(team => (
          <Pressable
            key={team.id}
            style={[styles.filterButton, selectedTeamId === team.id && styles.activeFilterButton]}
            onPress={() => setSelectedTeamId(team.id)}
          >
            <Text style={[styles.filterButtonText, selectedTeamId === team.id && styles.activeFilterButtonText]}>
              {team.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredPlayers.map(player => (
          <PlayerCard key={player.id} player={player} />
        ))}
        {filteredPlayers.length === 0 && !isLoading && (
          <Text style={styles.emptyText}>No players found</Text>
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.activeTabText]}>
            My Teams
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'players' && styles.activeTab]}
          onPress={() => setActiveTab('players')}
        >
          <Text style={[styles.tabText, activeTab === 'players' && styles.activeTabText]}>
            My Players
          </Text>
        </Pressable>
      </View>

      {activeTab === 'teams' ? <TeamsContent /> : <PlayersContent />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
    gap: SPACING.xl * 2,
  },
  tab: {
    paddingBottom: SPACING.sm,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 20,
    color: COLORS.grey[400],
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 4,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: '#EEFBFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardContent: {
    marginTop: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  playersContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: COLORS.text,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.grey[100],
    borderRadius: 100,
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: COLORS.grey[600],
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: COLORS.white,
  },
  playerCard: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  playerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
}); 