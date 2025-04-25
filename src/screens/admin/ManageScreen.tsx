import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, RefreshControl, Pressable, ViewStyle, TextStyle, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Text, Button, Card, SegmentedButtons, ActivityIndicator, Snackbar, Title, Caption, IconButton, Chip } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import * as Clipboard from 'expo-clipboard';
import { RouteProp } from '@react-navigation/native';

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
  coach_name?: string;
}

interface TeamsContentProps {
  teams: Team[];
  isLoading: boolean;
  navigation: NativeStackNavigationProp<AdminStackParamList>;
  onCopyAccessCode: (code: string) => void;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

interface TeamCardProps {
  team: Team;
  onPress: () => void;
  onCopyAccessCode: (code: string) => void;
  navigation: NativeStackNavigationProp<AdminStackParamList>;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onPress, onCopyAccessCode, navigation }) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.teamCard,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.cardPressable}
      >
        <View style={styles.teamCardContent}>
          <View style={styles.nameRow}>
            <Text style={styles.teamName}>{team.name}</Text>
            <IconButton
              icon="pencil"
              size={20}
              iconColor="#0CC1EC"
              onPress={() => navigation.navigate('EditTeam', { teamId: team.id })}
            />
          </View>
          <View style={styles.infoRow}>
            {team.coach ? (
              <View style={styles.coachContainer}>
                <MaterialCommunityIcons name="account-tie" size={20} color="#0CC1EC" />
                <Text style={styles.infoText}>Coach: {team.coach.name}</Text>
              </View>
            ) : (
              <View style={styles.coachContainer}>
                <MaterialCommunityIcons name="account-off" size={20} color="#0CC1EC" />
                <Text style={styles.infoText}>No coach assigned</Text>
              </View>
            )}
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="run" size={20} color="#0CC1EC" />
            <Text style={styles.infoText}>{team.players_count || '0'} players</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="key" size={20} color="#0CC1EC" />
            <Text style={styles.infoText}>Access code: {team.access_code}</Text>
            <TouchableOpacity
              onPress={() => onCopyAccessCode(team.access_code)}
              style={styles.copyButton}
            >
              <MaterialCommunityIcons name="content-copy" size={20} color="#0CC1EC" />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const TeamsContent: React.FC<TeamsContentProps> = ({ 
  teams, 
  isLoading, 
  navigation, 
  onCopyAccessCode,
  onRefresh,
  refreshing
}) => {
  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Teams</Text>
          <Text style={styles.totalCount}>Total: {teams.length} teams</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddTeam')}
        >
          <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add Team</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search team"
          placeholderTextColor={COLORS.grey[400]}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {!teams?.length ? (
          <Text style={styles.emptyText}>No teams found</Text>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onPress={() => {}}
              onCopyAccessCode={onCopyAccessCode}
              navigation={navigation}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

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

interface CoachContentProps {
  navigation: NativeStackNavigationProp<AdminStackParamList>;
  coaches: Coach[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  onCopyAccessCode: (code: string) => void;
}

const CoachContent: React.FC<CoachContentProps> = ({ 
  navigation, 
  coaches, 
  isLoading,
  onRefresh,
  refreshing,
  onCopyAccessCode
}) => {
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handleDeleteCoach = async (coachId: string) => {
    Alert.alert(
      'Delete Coach',
      'Are you sure you want to delete this coach? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('coaches')
                .delete()
                .eq('id', coachId);

              if (error) throw error;

              setSnackbarMessage('Coach deleted successfully');
              setShowSnackbar(true);
              onRefresh(); // Refresh the coaches list
            } catch (error) {
              console.error('Error deleting coach:', error);
              setSnackbarMessage('Failed to delete coach');
              setShowSnackbar(true);
            }
          },
        },
      ]
    );
  };

  const renderCoachCard = (coach: Coach) => (
    <Card key={coach.id} style={[styles.card, { backgroundColor: '#EEFBFF' }]}>
      <Card.Content>
        <View style={styles.cardContent}>
          <View style={styles.nameRow}>
            <View style={styles.leftContent}>
              <MaterialCommunityIcons name="account-tie" size={20} color="#0CC1EC" />
              <Title style={{ color: COLORS.text, fontSize: 20, marginLeft: SPACING.sm }}>{coach.name}</Title>
            </View>
            <IconButton
              icon="account-edit"
              size={20}
              iconColor="#0CC1EC"
              onPress={() => navigation.navigate('EditCoach', { coachId: coach.id })}
            />
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone" size={20} color="#0CC1EC" />
            <Text style={styles.infoText}>{coach.phone_number}</Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="key" size={20} color="#0CC1EC" />
            <Text style={styles.infoText}>Access code: {coach.access_code}</Text>
            <TouchableOpacity
              onPress={() => onCopyAccessCode(coach.access_code)}
              style={styles.copyButton}
            >
              <MaterialCommunityIcons name="content-copy" size={20} color="#0CC1EC" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account-multiple" size={20} color="#0CC1EC" />
            <Text style={styles.infoText}>Teams:</Text>
          </View>
          {coach.teams && coach.teams.length > 0 ? (
            <View style={styles.teamsList}>
              {coach.teams.map((team) => (
                <Chip key={team.id} style={[styles.teamChip, { backgroundColor: '#0CC1EC' }]}>
                  <Text style={styles.teamChipText}>{team.name}</Text>
                </Chip>
              ))}
            </View>
          ) : (
            <Text style={styles.noTeams}>No teams assigned</Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Coaches</Text>
          <Text style={styles.totalCount}>Total: {coaches.length} coaches</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddCoach')}
        >
          <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add Coach</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search coach"
          placeholderTextColor={COLORS.grey[400]}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {!coaches?.length ? (
          <Text style={styles.emptyText}>No coaches found</Text>
        ) : (
          coaches.map(renderCoachCard)
        )}
      </ScrollView>

      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

interface Player {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  team_id: string | null;
  team: {
    name: string;
  } | null;
}

interface PlayersContentProps {
  players: Player[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

const PlayersContent: React.FC<PlayersContentProps> = ({ 
  players, 
  isLoading,
  onRefresh,
  refreshing,
}) => {
  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Players</Text>
          <Text style={styles.totalCount}>Total: {players.length} players</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search player"
          placeholderTextColor={COLORS.grey[400]}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {!players?.length ? (
          <Text style={styles.emptyText}>No players found</Text>
        ) : (
          players.map((player) => (
            <Animated.View key={player.id} style={styles.teamCard}>
              <View style={styles.teamCardContent}>
                <Text style={styles.teamName}>{player.name}</Text>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#0CC1EC" />
                  <Text style={styles.infoText}>
                    Team: {player.team ? player.team.name : 'Not assigned'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="calendar" size={20} color="#0CC1EC" />
                  <Text style={styles.infoText}>
                    Joined: {new Date(player.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

type Styles = {
  container: ViewStyle;
  content: ViewStyle;
  header: ViewStyle;
  sectionTitle: TextStyle;
  totalCount: TextStyle;
  addButton: ViewStyle;
  addButtonText: TextStyle;
  searchContainer: ViewStyle;
  searchIcon: ViewStyle;
  searchInput: TextStyle;
  scrollContent: ViewStyle;
  teamCard: ViewStyle;
  teamCardContent: ViewStyle;
  teamName: TextStyle;
  infoRow: ViewStyle;
  coachContainer: ViewStyle;
  coachAvatar: ViewStyle;
  infoText: TextStyle;
  copyButton: ViewStyle;
  emptyText: TextStyle;
  loader: ViewStyle;
  tabContainer: ViewStyle;
  tab: ViewStyle;
  activeTab: ViewStyle;
  tabText: TextStyle;
  activeTabText: TextStyle;
  cardPressable: ViewStyle;
  card: ViewStyle;
  cardHeader: ViewStyle;
  cardTitleContainer: ViewStyle;
  cardTitle: TextStyle;
  cardActions: ViewStyle;
  cardContent: ViewStyle;
  accessCodeContainer: ViewStyle;
  accessCode: TextStyle;
  teamsContainer: ViewStyle;
  teamsLabel: TextStyle;
  teamsList: ViewStyle;
  teamChip: ViewStyle;
  teamChipText: TextStyle;
  noTeams: TextStyle;
  nameRow: ViewStyle;
  leftContent: ViewStyle;
};

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  totalCount: {
    fontSize: 16,
    color: COLORS.grey[600],
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
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
  } as TextStyle,
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  teamCard: {
    backgroundColor: '#EEFBFF',
    borderRadius: 16,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardPressable: {
    overflow: 'hidden',
    backgroundColor: '#EEFBFF',
    borderRadius: 16,
  },
  teamCardContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: '#EEFBFF',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  coachContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  infoText: {
    fontSize: 14,
    color: COLORS.grey[600],
    flex: 1,
  },
  copyButton: {
    padding: SPACING.xs,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grey[100],
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.grey[400],
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  loader: {
    marginTop: SPACING.xl,
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
  card: {
    marginBottom: SPACING.md,
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardContent: {
    marginTop: 8,
  },
  accessCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accessCode: {
    fontWeight: '500',
  },
  teamsContainer: {
    marginTop: 8,
  },
  teamsLabel: {
    marginBottom: 4,
  },
  teamsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  teamChip: {
    backgroundColor: '#0CC1EC',
  },
  teamChipText: {
    color: COLORS.white,
  },
  noTeams: {
    color: COLORS.grey[600],
    marginTop: SPACING.xs,
    marginLeft: SPACING.xl + SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

type CardType = 'teams' | 'coaches' | 'players' | 'payments';

type ManageScreenParams = {
  activeTab?: CardType;
};

export const AdminManageScreen = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<CardType>('teams');
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const route = useRoute<RouteProp<{ params: ManageScreenParams }, 'params'>>();

  useEffect(() => {
    if (route.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route.params]);

  const fetchTeams = async () => {
    try {
      console.log('Starting fetchTeams...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auth check result:', { user, userError });
      
      if (userError) throw userError;
      if (!user) {
        console.error('No user found');
        throw new Error('No user found');
      }

      console.log('Attempting to fetch teams for user:', user.id);
      
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          coach:coaches (
            id,
            name
          ),
          players:players(count)
        `)
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Teams fetch result:', { data, error });

      if (error) throw error;

      // Transform the data to get the count
      const teamsWithCount = (data || []).map(team => ({
        ...team,
        players_count: team.players[0]?.count || 0
      }));

      console.log('Setting teams:', teamsWithCount);
      setTeams(teamsWithCount);
    } catch (error) {
      console.error('Error in fetchTeams:', error);
      Alert.alert(
        'Error',
        'Failed to load teams. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCoaches = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Authentication error');
      }

      const { data, error } = await supabase
        .from('coaches')
        .select(`
          *,
          teams (
            id,
            name
          )
        `)
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCoaches(data || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
      Alert.alert(
        'Error',
        'Failed to load coaches. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          created_at,
          is_active,
          team_id,
          team:teams (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(player => ({
        id: player.id,
        name: player.name,
        created_at: player.created_at,
        is_active: player.is_active,
        team_id: player.team_id,
        team: player.team && Array.isArray(player.team) && player.team[0] 
          ? { name: player.team[0].name } 
          : null
      })) as Player[];
      
      setPlayers(typedData);
    } catch (error) {
      console.error('Error fetching players:', error);
      Alert.alert('Error', 'Failed to fetch players');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTeams(), fetchCoaches(), fetchPlayers()]);
      setIsLoading(false);
    };
    loadData();

    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTeams(), fetchCoaches(), fetchPlayers()]);
    setRefreshing(false);
  };

  const copyToClipboard = async (accessCode: string) => {
    await Clipboard.setStringAsync(accessCode);
    setSnackbarVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.activeTabText]}>Teams</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'coaches' && styles.activeTab]}
          onPress={() => setActiveTab('coaches')}
        >
          <Text style={[styles.tabText, activeTab === 'coaches' && styles.activeTabText]}>Coaches</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'players' && styles.activeTab]}
          onPress={() => setActiveTab('players')}
        >
          <Text style={[styles.tabText, activeTab === 'players' && styles.activeTabText]}>Players</Text>
        </Pressable>
      </View>

      {activeTab === 'teams' && (
        <TeamsContent
          teams={teams}
          isLoading={isLoading}
          navigation={navigation}
          onCopyAccessCode={copyToClipboard}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {activeTab === 'coaches' && (
        <CoachContent
          coaches={coaches}
          isLoading={isLoading}
          navigation={navigation}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onCopyAccessCode={copyToClipboard}
        />
      )}

      {activeTab === 'players' && (
        <PlayersContent
          players={players}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        Access code copied to clipboard
      </Snackbar>
    </View>
  );
}; 