import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, TouchableOpacity, Alert } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../utils/useDataRefresh';

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  name?: string;
  team_id: string;
  team_name: string;
  medical_visa_status: string;
  payment_status: string;
  parent_id: string | null;
  created_at?: string;
  birth_date?: string;
  last_payment_date?: string;
}

interface ParentDetails {
  name: string;
  phone_number: string;
  email?: string;
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
      return '#FFA500'; // Orange
    case 'unpaid':
      return COLORS.error;
    case 'on_trial':
      return COLORS.primary;
    case 'trial_ended':
      return COLORS.grey[800];
    default:
      return COLORS.grey[600];
  }
};

const getPaymentStatusText = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'unpaid':
      return 'Unpaid';
    case 'on_trial':
      return 'On Trial';
    case 'trial_ended':
      return 'Trial Ended';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
};

const PlayerCard = ({ player, onDetailsPress, onDelete }: { 
  player: Player; 
  onDetailsPress: () => void;
  onDelete: (playerId: string) => Promise<void>;
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshedStatus, setRefreshedStatus] = useState<string | null>(null);
  
  // Fetch fresh payment status when card renders
  useEffect(() => {
    const getLatestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('payment_status, player_status')
          .eq('id', player.id)
          .single();
          
        if (!error && data) {
          // Use payment_status directly - no mapping needed
          const newStatus = data.payment_status;
          
          console.log(`[PlayerCard] Got fresh status for ${player.player_name}:`, {
            old: player.payment_status,
            new: newStatus
          });
          
          setRefreshedStatus(newStatus);
        }
      } catch (err) {
        console.error("Error fetching fresh status:", err);
      }
    };
    
    getLatestStatus();
  }, [player.id]);
  
  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };
  
  // Use refreshed status if available, otherwise fall back to passed-in status
  const displayStatus = refreshedStatus || player.payment_status;
  
  return (
    <Card style={styles.playerCard}>
      <Card.Content style={styles.playerCardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
            <Text style={styles.playerName}>{player.player_name || player.name}</Text>
          </View>
          <TouchableOpacity 
            onPress={toggleMenu}
            style={styles.actionButton}
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color={COLORS.grey[700]} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>
              Team: <Text style={styles.infoValue}>{player.team_name || 'No team assigned'}</Text>
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialCommunityIcons 
              name="medical-bag" 
              size={20} 
              color={COLORS.primary} 
            />
            <Text style={styles.infoLabel}>
              Medical Visa Status: <Text style={[styles.infoValue, { color: getMedicalVisaStatusColor(player.medical_visa_status) }]}>
                {player.medical_visa_status.charAt(0).toUpperCase() + player.medical_visa_status.slice(1)}
              </Text>
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons 
              name="credit-card-outline" 
              size={20} 
              color={COLORS.primary} 
            />
            <Text style={styles.infoLabel}>
              Payment Status: <Text style={[styles.infoValue, { color: getPaymentStatusColor(displayStatus) }]}>
                {getPaymentStatusText(displayStatus)}
              </Text>
            </Text>
          </View>
          
          {menuVisible && (
            <View style={styles.menuContainer}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={onDetailsPress}
              >
                <MaterialCommunityIcons name="account-details" size={20} color={COLORS.primary} />
                <Text style={styles.menuItemText}>View player details</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  Alert.alert(
                    "Delete Player",
                    "Are you sure you want to delete this player? This action cannot be undone.",
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            setIsDeleting(true);
                            await onDelete(player.id);
                            // Close the menu
                            setMenuVisible(false);
                          } catch (error) {
                            console.error('Error deleting player:', error);
                            Alert.alert("Error", "Failed to delete player");
                          } finally {
                            setIsDeleting(false);
                          }
                        }
                      }
                    ]
                  );
                }}
                disabled={isDeleting}
              >
                <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
                <Text style={[styles.menuItemText, { color: COLORS.error }]}>
                  {isDeleting ? "Deleting..." : "Delete player"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

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
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);

  const filteredPlayers = players.filter(player => {
    const playerName = player.player_name || player.name || '';
    const matchesSearch = playerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  const handleOpenPlayerDetails = async (player: Player) => {
    try {
      console.log("Opening player details for:", {
        id: player.id, 
        player_id: player.player_id,
        last_payment_date: player.last_payment_date
      });
      
      // Fetch fresh player data to ensure we have the latest information
      const { data: freshPlayerData, error: freshPlayerError } = await supabase
        .from('players')
        .select('last_payment_date')
        .eq('id', player.id)
        .single();
        
      if (!freshPlayerError && freshPlayerData?.last_payment_date) {
        console.log("Retrieved fresh last_payment_date:", freshPlayerData.last_payment_date);
        const formattedDate = typeof freshPlayerData.last_payment_date === 'string'
          ? new Date(freshPlayerData.last_payment_date).toLocaleDateString('en-GB')
          : freshPlayerData.last_payment_date || null;
          
        // Create a new player object with updated information
        const updatedPlayer = {
          ...player,
          last_payment_date: formattedDate
        };
        
        console.log("Using formatted date:", formattedDate);
        setSelectedPlayer(updatedPlayer);
      } else {
        // Use existing player data if fetch fails
        console.log("Using existing player data with last_payment_date:", player.last_payment_date);
        setSelectedPlayer(player);
      }
      
      // Fetch parent details if player has parent_id
      if (player.parent_id) {
        const { data, error } = await supabase
          .from('parents')
          .select('name, phone_number, email')
          .eq('id', player.parent_id)
          .single();
        if (error) throw error;
        setParentDetails(data);
      } else {
        setParentDetails(null);
      }
      
      // Now show the modal
      setIsPlayerDetailsModalVisible(true);
    } catch (error) {
      console.error('Error fetching player details:', error);
      Alert.alert('Error', 'Could not fetch player details.');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);
        
      if (error) throw error;
      
      Alert.alert("Success", "Player deleted successfully");
      onRefresh();
    } catch (error) {
      console.error('Error deleting player:', error);
      Alert.alert("Error", "Failed to delete player");
    }
  };

  const handlePlayerMenuPress = (playerId: string) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  useEffect(() => {
    onRefresh();
  }, []);
  
  // Use data refresh hook to refresh player data when payment status changes
  useDataRefresh('players', () => {
    console.log("[CoachManagePlayersScreen] Payment status change detected - refreshing player data");
    onRefresh();
  });

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
              key={player.id} 
              player={player} 
              onDetailsPress={() => handleOpenPlayerDetails(player)}
              onDelete={handleDeletePlayer}
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
                    selectedTeamId === null && styles.teamOptionSelected
                  ]}
                  onPress={() => {
                    onTeamSelect(null);
                    setIsTeamModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.teamItemText}>All Teams</Text>
                  </View>
                  {selectedTeamId === null && (
                    <MaterialCommunityIcons
                      name="check"
                      size={24}
                      color={COLORS.primary}
                    />
                  )}
                </Pressable>

                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamItem, selectedTeamId === team.id && styles.teamOptionSelected]}
                    onPress={() => {
                      onTeamSelect(team.id);
                      setIsTeamModalVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.teamItemText}>{team.name}</Text>
                    </View>
                    {selectedTeamId === team.id && (
                      <MaterialCommunityIcons
                        name="check"
                        size={24}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
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
                <ScrollView>
                  <View style={styles.detailsContainer}>
                    <View style={styles.avatarContainer}>
                      <MaterialCommunityIcons name="account-circle" size={80} color={COLORS.primary} />
                      <Text style={styles.playerDetailName}>{selectedPlayer.player_name || selectedPlayer.name}</Text>
                      <Text style={styles.teamDetailName}>{selectedPlayer.team_name}</Text>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.modalSectionTitle}>Player Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Join Date:</Text>
                        <Text style={styles.detailValue}>
                          {selectedPlayer.created_at 
                            ? new Date(selectedPlayer.created_at).toLocaleDateString('en-GB')
                            : 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Birthdate:</Text>
                        <Text style={styles.detailValue}>
                          {selectedPlayer.birth_date 
                            ? new Date(selectedPlayer.birth_date).toLocaleDateString('en-GB')
                            : 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.modalSectionTitle}>Payment Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status:</Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: getPaymentStatusColor(selectedPlayer.payment_status) + '20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: getPaymentStatusColor(selectedPlayer.payment_status) }
                          ]}>
                            {getPaymentStatusText(selectedPlayer.payment_status)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Last Payment:</Text>
                        <Text style={styles.detailValue}>
                          {selectedPlayer?.last_payment_date || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.modalSectionTitle}>Medical Visa Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status:</Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: getMedicalVisaStatusColor(selectedPlayer.medical_visa_status) + '20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: getMedicalVisaStatusColor(selectedPlayer.medical_visa_status) }
                          ]}>
                            {selectedPlayer.medical_visa_status.charAt(0).toUpperCase() + selectedPlayer.medical_visa_status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    {parentDetails && (
                      <View style={styles.detailsSection}>
                        <Text style={styles.modalSectionTitle}>Parent Information</Text>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Name:</Text>
                          <Text style={styles.detailValue}>{parentDetails.name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Phone:</Text>
                          <Text style={styles.detailValue}>{parentDetails.phone_number}</Text>
                        </View>
                        {parentDetails.email && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Email:</Text>
                            <Text style={styles.detailValue}>{parentDetails.email}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    <TouchableOpacity 
                      onPress={() => {
                        setIsPlayerDetailsModalVisible(false);
                        setTimeout(() => {
                          if (selectedPlayer) {
                            handleDeletePlayer(selectedPlayer.id);
                          }
                        }, 300);
                      }}
                      style={styles.deleteButton}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons 
                          name="delete" 
                          size={20} 
                          color={COLORS.white}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.deleteButtonText}>Delete Player</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
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
    backgroundColor: COLORS.white,
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
    flex: 1,
  },
  teamSelectorText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
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
  cardContent: {
    marginTop: SPACING.md,
  },
  playerCard: {
    marginBottom: SPACING.md,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  cardPressable: {
    width: '100%',
  },
  playerCardContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuButton: {
    padding: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
  menuContainer: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  menuItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.grey[500],
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  teamsList: {
    maxHeight: 300,
  },
  teamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  teamOptionSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  teamItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  detailsContainer: {
    padding: SPACING.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  playerDetailName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  teamDetailName: {
    fontSize: 16,
    color: COLORS.grey[600],
  },
  detailsSection: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 2,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: '#00BDF2', // Turquoise color
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    padding: SPACING.xs,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
}); 