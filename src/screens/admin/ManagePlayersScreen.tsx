import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Pressable, Alert } from 'react-native';
import { Text, ActivityIndicator, Card, IconButton } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../utils/useDataRefresh';

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  team_id: string | null;
  team: {
    name: string;
  } | null;
  medicalVisaStatus: string;
  paymentStatus: string;
  payment_status?: string;
  last_payment_date?: string;
  birth_date?: string | null;
  parent_id?: string;
}

interface ManagePlayersScreenProps {
  players: Player[];
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ManagePlayersScreen: React.FC<ManagePlayersScreenProps> = ({
  players,
  teams,
  isLoading,
  onRefresh,
  refreshing,
  searchQuery,
  onSearchChange,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [parentDetails, setParentDetails] = useState<{ name: string; phone_number: string; email?: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  const handleOpenPlayerDetails = async (player: Player) => {
    try {
      console.log("Opening player details for:", player.id);
      
      // Fetch fresh player data to ensure we have the latest information
      const { data: freshPlayerData, error: freshPlayerError } = await supabase
        .from('players')
        .select('payment_status, player_status, last_payment_date')
        .eq('id', player.id)
        .single();
        
      if (!freshPlayerError && freshPlayerData) {
        console.log("[AdminManagePlayersScreen] Got fresh data for player:", {
          id: player.id,
          name: player.name,
          oldStatus: player.paymentStatus || player.payment_status,
          newStatus: freshPlayerData.player_status || freshPlayerData.payment_status,
          lastPaymentDate: freshPlayerData.last_payment_date
        });
        
        // Use the freshest payment status (prefer player_status ENUM)
        const freshStatus = freshPlayerData.player_status || freshPlayerData.payment_status;
        
        // Format the last payment date if it exists
        let formattedDate = player.last_payment_date;
        if (freshPlayerData.last_payment_date) {
          try {
            formattedDate = new Date(freshPlayerData.last_payment_date).toLocaleDateString('en-GB');
          } catch (e) {
            console.error("Error formatting date:", e);
          }
        }
        
        // Create updated player object with fresh data
        const updatedPlayer = {
          ...player,
          paymentStatus: freshStatus,
          payment_status: freshStatus,
          last_payment_date: formattedDate
        };
        
        setSelectedPlayer(updatedPlayer);
      } else {
        // Use existing player data if fetch fails
        console.log("Using existing player data");
        setSelectedPlayer(player);
      }
      
      setPaymentStatus(player.paymentStatus || player.payment_status || 'pending');
      
      // Fetch parent details if player has parent_id
      if (player.parent_id) {
        try {
          const { data, error } = await supabase
            .from('parents')
            .select('name, phone_number, email')
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
    } catch (error) {
      console.error('Error opening player details:', error);
      setSelectedPlayer(player);
      setIsPlayerDetailsModalVisible(true);
    }
  };
  
  const handleUpdatePaymentStatus = async () => {
    if (!selectedPlayer) return;
    
    setIsUpdatingPayment(true);
    try {
      // In a real implementation, you would update this in your database
      // For now, we'll just simulate the update in the local state
      
      // TODO: Add actual API call to update payment status
      // Example:
      // const { error } = await supabase
      //   .from('players')
      //   .update({ payment_status: paymentStatus })
      //   .eq('id', selectedPlayer.id);
      
      // if (error) throw error;
      
      // Update the local state
      const updatedPlayers = players.map(p => 
        p.id === selectedPlayer.id ? {...p, paymentStatus} : p
      );
      
      // Refresh the data (this would be handled by the parent component)
      await onRefresh();
      
      setIsPlayerDetailsModalVisible(false);
      Alert.alert('Success', 'Payment status updated successfully');
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleDeletePlayer = (playerId: string) => {
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
              const { error } = await supabase
                .from('players')
                .delete()
                .eq('id', playerId);
                
              if (error) throw error;
              
              // If we're deleting from the modal, close it
              if (isPlayerDetailsModalVisible) {
                setIsPlayerDetailsModalVisible(false);
              }
              
              Alert.alert("Success", "Player deleted successfully");
              onRefresh();
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
  };

  const handlePlayerMenuPress = (playerId: string) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  const getMedicalVisaStatusColor = (status: string) => {
    switch (status) {
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
    switch (status?.toLowerCase()) {
      case 'paid':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'overdue':
      case 'missed':
      case 'unpaid':
        return COLORS.error;
      case 'on_trial':
        return COLORS.primary;
      default:
        return COLORS.grey[600];
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'overdue':
      case 'missed':
        return 'Overdue';
      case 'on_trial':
        return 'On Trial';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    }
  };

  const getPlayerPaymentStatus = (player: Player): string => {
    return player.paymentStatus || player.payment_status || 'pending';
  };

  useEffect(() => {
    onRefresh();
  }, []);
  
  // Use data refresh hook to refresh player data when status changes
  useDataRefresh('players', () => {
    console.log("[ManagePlayersScreen] Payment status change detected - refreshing player data");
    onRefresh();
  });

  // Create a PlayerCard component that fetches fresh status data
  const PlayerCardWithFreshStatus = ({ player }: { player: Player }) => {
    const [freshStatus, setFreshStatus] = useState<string | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    
    // Fetch fresh payment status when card renders
    useEffect(() => {
      const getFreshStatus = async () => {
        try {
          console.log(`[PlayerCard] Fetching fresh status for player ${player.id}`);
          const { data, error } = await supabase
            .from('players')
            .select('payment_status, player_status')
            .eq('id', player.id)
            .single();
            
          if (!error && data) {
            // Prefer player_status ENUM over payment_status
            const newStatus = data.player_status || data.payment_status;
            console.log(`[PlayerCard] Got fresh status for ${player.name}:`, {
              old: player.paymentStatus || player.payment_status,
              new: newStatus
            });
            setFreshStatus(newStatus);
          }
        } catch (err) {
          console.error("Error fetching fresh status:", err);
        }
      };
      
      getFreshStatus();
    }, [player.id]);
    
    // Use refreshed status if available, otherwise fall back to passed-in status
    const displayStatus = freshStatus || player.paymentStatus || player.payment_status || 'pending';
    
    return (
      <View key={player.id} style={styles.playerCard}>
        <View style={styles.cardPressable}>
          <View style={styles.playerCardContent}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{player.name}</Text>
              <TouchableOpacity 
                onPress={() => handlePlayerMenuPress(player.id)}
                style={styles.menuButton}
              >
                <MaterialCommunityIcons name="dots-vertical" size={20} color={COLORS.grey[600]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-group" size={20} color="#0CC1EC" />
              <Text style={styles.infoLabel}>
                Team: <Text style={styles.infoValue}>{player.team ? player.team.name : 'No team assigned'}</Text>
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialCommunityIcons 
                name="medical-bag" 
                size={20} 
                color={COLORS.primary} 
              />
              <Text style={styles.infoLabel}>
                Medical Visa Status: <Text style={[styles.infoValue, { color: getMedicalVisaStatusColor(player.medicalVisaStatus) }]}>
                  {player.medicalVisaStatus.charAt(0).toUpperCase() + player.medicalVisaStatus.slice(1)}
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
            
            {playerMenuVisible === player.id && (
              <View style={styles.menuContainer}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleOpenPlayerDetails(player)}
                >
                  <MaterialCommunityIcons name="account-details" size={20} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>View player details</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleDeletePlayer(player.id)}
                >
                  <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
                  <Text style={[styles.menuItemText, { color: COLORS.error }]}>Delete player</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Players</Text>
          <Text style={styles.totalCount}>Total: {filteredPlayers.length} players</Text>
        </View>
      </View>

      <View style={styles.filtersContainer}>
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
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {!filteredPlayers?.length ? (
          <Text style={styles.emptyText}>No players found</Text>
        ) : (
          filteredPlayers.map(player => (
            <PlayerCardWithFreshStatus key={player.id} player={player} />
          ))
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
                  setSelectedTeamId(null);
                  setIsTeamModalVisible(false);
                }}
              >
                <View style={styles.teamItemContent}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={24}
                    color={COLORS.primary}
                  />
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

              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.teamItem,
                    selectedTeamId === team.id && styles.selectedTeamItem
                  ]}
                  onPress={() => {
                    setSelectedTeamId(team.id);
                    setIsTeamModalVisible(false);
                  }}
                >
                  <View style={styles.teamItemContent}>
                    <MaterialCommunityIcons
                      name="account-group"
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.teamItemText}>{team.name}</Text>
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
              <TouchableOpacity 
                onPress={() => setIsPlayerDetailsModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>
            
            {selectedPlayer && (
              <ScrollView>
                <View style={styles.detailsContainer}>
                  <View style={styles.avatarContainer}>
                    <MaterialCommunityIcons name="account-circle" size={80} color={COLORS.primary} />
                    <Text style={styles.playerDetailName}>{selectedPlayer.name}</Text>
                    <Text style={styles.teamDetailName}>{selectedPlayer.team ? selectedPlayer.team.name : 'No team assigned'}</Text>
                  </View>
                  
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Player Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Join Date:</Text>
                      <Text style={styles.detailValue}>{selectedPlayer.created_at ? new Date(selectedPlayer.created_at).toLocaleDateString('en-GB') : 'Unknown'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Birthdate:</Text>
                      <Text style={styles.detailValue}>{selectedPlayer.birth_date ? new Date(selectedPlayer.birth_date).toLocaleDateString('en-GB') : 'Unknown'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Payment Information</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getPaymentStatusColor(getPlayerPaymentStatus(selectedPlayer)) + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: getPaymentStatusColor(getPlayerPaymentStatus(selectedPlayer)) }
                        ]}>
                          {getPaymentStatusText(getPlayerPaymentStatus(selectedPlayer))}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Last Payment:</Text>
                      <Text style={styles.detailValue}>
                        {selectedPlayer.last_payment_date 
                          ? new Date(selectedPlayer.last_payment_date).toLocaleDateString('en-GB') 
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>
                  
                  {parentDetails && (
                    <View style={styles.detailsSection}>
                      <Text style={styles.sectionTitle}>Parent Information</Text>
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
                    onPress={() => handleDeletePlayer(selectedPlayer.id)}
                    style={styles.deleteButton}
                    disabled={isDeleting}
                  >
                    <MaterialCommunityIcons 
                      name="delete" 
                      size={20} 
                      color={COLORS.white}
                    />
                    <Text style={styles.deleteButtonText}>
                      {isDeleting ? "Deleting..." : "Delete Player"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: SPACING.xs,
  },
  filtersContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
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
  scrollContent: {
    paddingBottom: SPACING.xl * 4,
  },
  playerCard: {
    marginBottom: SPACING.md,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressable: {
    padding: SPACING.md,
  },
  playerCardContent: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  teamsList: {
    padding: SPACING.lg,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  selectedTeamItem: {
    backgroundColor: COLORS.grey[100],
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: COLORS.primary,
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
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: 8,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  menuButton: {
    padding: SPACING.xs,
  },
  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    elevation: 2,
    padding: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  menuItemText: {
    marginLeft: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
  },
}); 