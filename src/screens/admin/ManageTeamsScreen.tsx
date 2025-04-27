import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, TouchableOpacity, TextInput, Animated, ViewStyle, TextStyle, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

interface TeamCardProps {
  team: Team;
  onPress: () => void;
  onCopyAccessCode: (code: string) => void;
  navigation: NativeStackNavigationProp<AdminStackParamList>;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onPress, onCopyAccessCode, navigation }) => {
  const [scaleAnim] = React.useState(new Animated.Value(1));

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

interface ManageTeamsScreenProps {
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  onCopyAccessCode: (code: string) => void;
}

export const ManageTeamsScreen: React.FC<ManageTeamsScreenProps> = ({
  teams,
  isLoading,
  onRefresh,
  refreshing,
  onCopyAccessCode
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

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

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: SPACING.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  addButtonText: {
    color: COLORS.white,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
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
  scrollContent: {
    paddingBottom: SPACING.xl * 4,
  },
  teamCard: {
    marginBottom: SPACING.md,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressable: {
    padding: SPACING.md,
  },
  teamCardContent: {
    gap: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  coachContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  copyButton: {
    marginLeft: 'auto',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 