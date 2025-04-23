import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, RefreshControl, Pressable, ViewStyle, TextStyle, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Text, Button, Card, SegmentedButtons, ActivityIndicator, Snackbar } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import * as Clipboard from 'expo-clipboard';

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
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onPress, onCopyAccessCode }) => {
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
          <Text style={styles.teamName}>{team.name}</Text>
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
              onPress={() => navigation.navigate('TeamDetails', { teamId: team.id })}
              onCopyAccessCode={onCopyAccessCode}
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
          coaches.map((coach) => (
            <View key={coach.id} style={styles.teamCard}>
              <View style={styles.teamCardContent}>
                <Text style={styles.teamName}>{coach.name}</Text>
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
              </View>
            </View>
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
});

export const AdminManageScreen = () => {
  const [activeTab, setActiveTab] = useState('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

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
        .select('*')
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

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'teams') {
      await fetchTeams();
    } else {
      await fetchCoaches();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (activeTab === 'teams') {
        fetchTeams();
      } else {
        fetchCoaches();
      }
    });

    return unsubscribe;
  }, [navigation, activeTab]);

  useEffect(() => {
    if (activeTab === 'teams') {
      fetchTeams();
    } else {
      fetchCoaches();
    }
  }, [activeTab]);

  const copyToClipboard = async (accessCode: string) => {
    await Clipboard.setStringAsync(accessCode);
    setSnackbarMessage('Access code copied to clipboard!');
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
          style={[styles.tab, activeTab === 'coach' && styles.activeTab]}
          onPress={() => setActiveTab('coach')}
        >
          <Text style={[styles.tabText, activeTab === 'coach' && styles.activeTabText]}>Coaches</Text>
        </Pressable>
      </View>
      {activeTab === 'teams' ? (
        <TeamsContent 
          teams={teams}
          isLoading={isLoading}
          navigation={navigation}
          onCopyAccessCode={copyToClipboard}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      ) : (
        <CoachContent 
          navigation={navigation}
          coaches={coaches}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onCopyAccessCode={copyToClipboard}
        />
      )}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}; 