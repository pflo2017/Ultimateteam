import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

const TeamCard = ({ team }: { team: Team }) => (
  <Card style={styles.card}>
    <Card.Content>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <MaterialCommunityIcons name="account-multiple" size={24} color={COLORS.primary} />
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

export const CoachManageTeamsScreen: React.FC<CoachManageTeamsScreenProps> = ({
  teams,
  isLoading,
  onRefresh,
  refreshing
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
};

const styles = StyleSheet.create({
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
}); 