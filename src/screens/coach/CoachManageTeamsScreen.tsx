import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachTabParamList } from '../../navigation/CoachNavigator';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

interface Team {
  id: string;
  name: string;
  players_count: number;
  access_code: string;
}

interface CoachManageTeamsScreenProps {
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

const TeamCard = ({ team, onPress }: { team: Team; onPress: () => void }) => {
  const { t } = useTranslation();
  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(team.access_code);
      Alert.alert('Success', 'Team code copied to clipboard!');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy team code');
    }
  };

  return (
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
              <Text style={styles.infoLabel}>{t('coach.manage.teams.players')}: <Text style={styles.infoValue}>{team.players_count}</Text></Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="key" size={20} color={COLORS.primary} />
              <Text style={styles.infoLabel}>{t('coach.manage.teams.team_code')}: <Text style={styles.infoValue}>{team.access_code ? team.access_code : '\u2014'}</Text></Text>
              {team.access_code ? (
                <IconButton
                  icon="content-copy"
                  size={18}
                  iconColor={COLORS.primary}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCopyCode();
                  }}
                  style={styles.copyButton}
                />
              ) : null}
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

export const CoachManageTeamsScreen: React.FC<CoachManageTeamsScreenProps> = ({
  teams,
  isLoading,
  onRefresh,
  refreshing
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<CoachTabParamList>>();
  const { t } = useTranslation();

  const handleTeamPress = (team: Team) => {
    navigation.navigate('Manage', { 
      activeTab: 'players',
      teamId: team.id
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
          <Text style={styles.emptyText}>{t('coach.manage.teams.no_teams_assigned')}</Text>
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
  copyButton: {
    margin: 0,
    backgroundColor: COLORS.primary + '15',
  },
}); 