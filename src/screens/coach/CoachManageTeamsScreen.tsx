import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachTabParamList } from '../../navigation/CoachNavigator';

interface Team {
  id: string;
  name: string;
  players_count: number;
}

interface CoachManageTeamsScreenProps {
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

const TeamCard = ({ team, onPress }: { team: Team; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress}>
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
            <MaterialCommunityIcons name="run" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>Players: <Text style={styles.infoValue}>{team.players_count}</Text></Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  </TouchableOpacity>
);

export const CoachManageTeamsScreen: React.FC<CoachManageTeamsScreenProps> = ({
  teams,
  isLoading,
  onRefresh,
  refreshing
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<CoachTabParamList>>();

  const handleTeamPress = (team: Team) => {
    // Navigate to the Manage screen with players tab and filter by team
    navigation.navigate('Manage', { 
      activeTab: 'players',
      teamId: team.id  // Pass the team ID to filter players
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {teams.map(team => (
          <TeamCard 
            key={team.id} 
            team={team} 
            onPress={() => handleTeamPress(team)}
          />
        ))}
        {teams.length === 0 && !isLoading && (
          <Text style={styles.emptyText}>No teams assigned yet</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  infoLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
}); 