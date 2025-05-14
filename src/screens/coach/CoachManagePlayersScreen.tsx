import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, TouchableOpacity, Alert } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

interface Team {
  id: string;
  name: string;
}

interface Player {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  medical_visa_status: string;
  payment_status: string;
  parent_id: string | null;
}

interface ParentDetails {
  name: string;
  phone_number: string;
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

const getMedicalVisaStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'valid':
      return COLORS.success;
    case 'pending':
      return COLORS.warning;
    case 'expired':
      return COLORS.error;
    default:
      return COLORS.grey[600];
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return COLORS.success;
    case 'pending':
      return COLORS.warning;
    case 'overdue':
      return COLORS.error;
    default:
      return COLORS.grey[600];
  }
};

const PlayerCard = ({ player, onDetailsPress }: { player: Player; onDetailsPress: () => void }) => (
  <Card style={styles.playerCard}>
    <Card.Content>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
          <Text style={styles.playerName}>{player.player_name}</Text>
        </View>
        <TouchableOpacity
          onPress={onDetailsPress}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Team: {player.team_name || 'No team assigned'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <MaterialCommunityIcons 
            name="medical-bag" 
            size={20} 
            color={getMedicalVisaStatusColor(player.medical_visa_status)} 
          />
          <Text style={[styles.infoText, { color: getMedicalVisaStatusColor(player.medical_visa_status) }]}>
            Visa Status: {player.medical_visa_status.charAt(0).toUpperCase() + player.medical_visa_status.slice(1)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons 
            name="cash" 
            size={20} 
            color={getPaymentStatusColor(player.payment_status)} 
          />
          <Text style={[styles.infoText, { color: getPaymentStatusColor(player.payment_status) }]}>
            Payment Status: {player.payment_status.charAt(0).toUpperCase() + player.payment_status.slice(1)}
          </Text>
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
  
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [parentDetails, setParentDetails] = useState<ParentDetails | null>(null);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.player_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  const handleOpenPlayerDetails = async (player: Player) => {
    setSelectedPlayer(player);
    
    if (player.parent_id) {
      try {
        const { data, error } = await supabase
          .from('parents')
          .select('name, phone_number')
          .eq('id', player.parent_id)
          .single();
          
        if (error) throw error;
        setParentDetails(data);
      } catch (error) {
        console.error('Error fetching parent details:', error);
        setParentDetails(null);
      }
    } else {
      setParentDetails(null);
    }
    
    setIsPlayerDetailsModalVisible(true);
  };

  return (
    <View style={styles.container}>
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
              name="account-group" 
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
            <PlayerCard 
              key={player.player_id} 
              player={player} 
              onDetailsPress={() => handleOpenPlayerDetails(player)}
            />
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
                      name="account-group"
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
                        name="account-group"
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

        <Modal
          visible={isPlayerDetailsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPlayerDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Player Details</Text>
                <Pressable 
                  onPress={() => setIsPlayerDetailsModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </Pressable>
              </View>

              {selectedPlayer && (
                <View style={styles.detailsContainer}>
                  {parentDetails ? (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Parent Information</Text>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
                        <Text style={styles.detailText}>{parentDetails.name}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="phone" size={24} color={COLORS.primary} />
                        <Text style={styles.detailText}>{parentDetails.phone_number}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noParentText}>No parent information available</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    marginBottom: SPACING.md,
    borderRadius: 10,
    backgroundColor: '#EEFBFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
  cardContent: {
    marginTop: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  infoText: {
    fontSize: 14,
    marginLeft: SPACING.sm,
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
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  actionButton: {
    padding: SPACING.xs,
  },
  detailsContainer: {
    paddingVertical: SPACING.lg,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  detailText: {
    fontSize: 16,
    marginLeft: SPACING.sm,
    color: COLORS.text,
  },
  noParentText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.grey[500],
    marginVertical: SPACING.xl,
  },
}); 