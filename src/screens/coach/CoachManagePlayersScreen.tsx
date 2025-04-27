import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal } from 'react-native';
import { Text, Card, SegmentedButtons, Menu, Button } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  name: string;
  team_id: string;
  team_name: string;
}

interface CoachManagePlayersScreenProps {
  players: Player[];
  teams: Team[];
  isLoading: boolean;
  refreshing: boolean;
  searchQuery: string;
  selectedTeamId: string | null;
  onRefresh: () => Promise<void>;
  onSearchChange: (query: string) => void;
  onTeamSelect: (teamId: string | null) => void;
}

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

export const CoachManagePlayersScreen: React.FC<CoachManagePlayersScreenProps> = ({
  players,
  teams,
  isLoading,
  refreshing,
  searchQuery,
  selectedTeamId,
  onRefresh,
  onSearchChange,
  onTeamSelect,
}) => {
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  return (
    <View style={styles.playersContainer}>
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search player"
          placeholderTextColor={COLORS.grey[400]}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      <View style={styles.filtersRow}>
        <Pressable
          style={styles.teamSelector}
          onPress={() => setIsTeamModalVisible(true)}
        >
          <MaterialCommunityIcons 
            name="account-multiple" 
            size={20} 
            color={COLORS.primary}
          />
          <Text style={styles.teamSelectorText} numberOfLines={1}>
            {selectedTeam ? selectedTeam.name : 'All Teams'}
          </Text>
          <MaterialCommunityIcons 
            name="chevron-down" 
            size={20} 
            color={COLORS.grey[400]}
          />
        </Pressable>
        {/* Space reserved for additional filters */}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredPlayers.map(player => (
          <PlayerCard key={player.id} player={player} />
        ))}
        {filteredPlayers.length === 0 && !isLoading && (
          <Text style={styles.emptyText}>No players found</Text>
        )}
      </ScrollView>

      <Modal
        visible={isTeamModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTeamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <Pressable 
                onPress={() => setIsTeamModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </Pressable>
            </View>

            <ScrollView style={styles.teamsList}>
              <Pressable
                style={[
                  styles.teamItem,
                  selectedTeamId === null && styles.selectedTeamItem
                ]}
                onPress={() => {
                  onTeamSelect(null);
                  setIsTeamModalVisible(false);
                }}
              >
                <View style={styles.teamItemContent}>
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={24}
                    color={COLORS.primary}
                  />
                  <Text style={styles.teamName}>All Teams</Text>
                </View>
                {selectedTeamId === null && (
                  <MaterialCommunityIcons
                    name="check"
                    size={24}
                    color={COLORS.primary}
                  />
                )}
              </Pressable>

              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.teamItem,
                    selectedTeamId === team.id && styles.selectedTeamItem
                  ]}
                  onPress={() => {
                    onTeamSelect(team.id);
                    setIsTeamModalVisible(false);
                  }}
                >
                  <View style={styles.teamItemContent}>
                    <MaterialCommunityIcons
                      name="account-multiple"
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.teamName}>{team.name}</Text>
                  </View>
                  {selectedTeamId === team.id && (
                    <MaterialCommunityIcons
                      name="check"
                      size={24}
                      color={COLORS.primary}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  playersContainer: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 4,
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
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  segmentedButtons: {
    backgroundColor: COLORS.white,
    elevation: 0,
    shadowColor: 'transparent',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  teamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    gap: SPACING.xs,
    maxWidth: 200,
    minWidth: 180,
  },
  teamSelectorText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
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
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SPACING.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  teamsList: {
    paddingTop: SPACING.sm,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.grey[100],
  },
  selectedTeamItem: {
    backgroundColor: COLORS.primary + '10',
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
}); 