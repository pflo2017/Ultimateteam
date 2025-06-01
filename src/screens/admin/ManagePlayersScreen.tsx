import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Pressable, Alert, TouchableWithoutFeedback } from 'react-native';
import { Text, ActivityIndicator, Card, IconButton, Divider } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
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
  medicalVisaIssueDate?: string;
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
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(teams.map(t => t.id));
  const [selectedMedicalStatuses, setSelectedMedicalStatuses] = useState<string[]>([]);
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [parentDetails, setParentDetails] = useState<{ name: string; phone_number: string; email?: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = selectedTeamIds.length === 0 || (player.team_id && selectedTeamIds.includes(player.team_id));
    const matchesMedical = selectedMedicalStatuses.length === 0 || selectedMedicalStatuses.includes(player.medicalVisaStatus);
    return matchesSearch && matchesTeam && matchesMedical;
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
        
        // Use the payment_status directly - no mapping needed
        let freshStatus = freshPlayerData.payment_status;
        
        // Format the last payment date if it exists
        let formattedDate = 'No payment';
        if (freshPlayerData.last_payment_date) {
          try {
            const date = new Date(freshPlayerData.last_payment_date);
            if (!isNaN(date.getTime())) { // Check if date is valid
              formattedDate = date.toLocaleDateString('en-GB');
            }
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

  const handlePlayerMenuPress = (playerId: string | null) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  const getMedicalVisaStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return COLORS.success;
      case 'pending':
        return '#FFA500'; // Orange color for pending from PaymentsScreen
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
        return '#FFA500'; // Orange color for pending from PaymentsScreen
      case 'overdue':
      case 'missed':
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
    // Use payment_status directly - no mapping needed
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
    
    // Fetch fresh payment status when card renders
    useEffect(() => {
      const getFreshStatus = async () => {
        try {
          // Fetch fresh data without logging each attempt
          const { data, error } = await supabase
            .from('players')
            .select('payment_status, player_status')
            .eq('id', player.id)
            .single();
            
          if (!error && data) {
            // Use payment_status directly - no mapping needed
            const newStatus = data.payment_status;
            
            const oldStatus = player.paymentStatus || player.payment_status;
            
            // Only log if there's an actual difference in the status
            if (newStatus !== oldStatus) {
              console.log(`[PlayerCard] Status change for ${player.name}:`, {
                old: oldStatus,
                new: newStatus
              });
            }
            
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
    
    // Format the date if it exists
    let formattedBirthDate = 'Not available';
    if (player.birth_date) {
      try {
        const date = new Date(player.birth_date);
        if (!isNaN(date.getTime())) {
          formattedBirthDate = date.toLocaleDateString();
        }
      } catch (e) {
        console.error("Error formatting birth date:", e);
      }
    }
    
    return (
      <Card 
        key={player.id} 
        style={styles.playerCard}
        mode="outlined"
      >
        <Card.Content style={{ padding: SPACING.md }}>
          <View style={styles.playerHeader}>
            <View style={styles.nameContainer}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: COLORS.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: SPACING.md
              }}>
                <MaterialCommunityIcons 
                  name="account" 
                  size={28} 
                  color={COLORS.primary} 
                />
              </View>
              <View>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.teamName}>{player.team ? player.team.name : 'No team assigned'}</Text>
              </View>
            </View>

            <View style={styles.ageContainer}>
              <Text style={styles.ageLabel}>Birth Date</Text>
              <Text style={styles.ageValue}>
                {player.birth_date ? formattedBirthDate : 'Not available'}
              </Text>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md }}>
            <MaterialCommunityIcons name="medical-bag" size={20} color={COLORS.primary} />
            <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500' }}>
              Medical Visa
            </Text>
            <View style={{
              backgroundColor: getMedicalVisaStatusColor(player.medicalVisaStatus) + '20',
              borderRadius: 12,
              paddingHorizontal: SPACING.md,
              paddingVertical: 4,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}>
              <Text style={{
                fontSize: FONT_SIZES.xs,
                fontWeight: '600',
                color: getMedicalVisaStatusColor(player.medicalVisaStatus)
              }}>
                {player.medicalVisaStatus.charAt(0).toUpperCase() + player.medicalVisaStatus.slice(1)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: COLORS.grey[600], fontWeight: '500' }}>Until</Text>
              <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '600' }}>
                {player.medicalVisaStatus === 'valid' && player.medicalVisaIssueDate ?
                  (() => {
                    const issueDate = new Date(player.medicalVisaIssueDate);
                    if (isNaN(issueDate.getTime())) return 'N/A';
                    const expiryDate = new Date(issueDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 6);
                    return expiryDate.toLocaleDateString('en-GB');
                  })()
                  : 'N/A'}
              </Text>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => handleOpenPlayerDetails(player)}
            >
              <MaterialCommunityIcons 
                name="account-details" 
                size={16} 
                color={COLORS.white} 
              />
              <Text style={styles.buttonText}>Details</Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Players</Text>
            <Text style={styles.totalCount}>Total: {filteredPlayers.length} players</Text>
          </View>
          <TouchableOpacity style={styles.filterIconButton} onPress={() => setShowFilterModal(true)}>
            <MaterialCommunityIcons name="filter" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
                        {selectedPlayer.last_payment_date && selectedPlayer.last_payment_date !== 'Invalid Date' 
                          ? selectedPlayer.last_payment_date 
                          : 'No payment recorded'}
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
                    style={[styles.deleteButton, styles.modalDeleteButton]}
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

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.filterModalContent}>
                <ScrollView>
                  <Text style={styles.filterModalTitle}>Filter Players</Text>
                  <Text style={styles.filterModalSection}>Teams</Text>
                  <View style={styles.filterChipRow}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        selectedTeamIds.length === teams.length && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                      ]}
                      onPress={() => setSelectedTeamIds(selectedTeamIds.length === teams.length ? [] : teams.map(t => t.id))}
                    >
                      <Text style={[
                        styles.chipText,
                        selectedTeamIds.length === teams.length && { color: '#fff' }
                      ]}>All Teams</Text>
                    </TouchableOpacity>
                    {teams.map(team => {
                      const isSelected = selectedTeamIds.includes(team.id);
                      return (
                        <TouchableOpacity
                          key={team.id}
                          style={[
                            styles.chip,
                            isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                          ]}
                          onPress={() => {
                            setSelectedTeamIds(prev =>
                              prev.includes(team.id)
                                ? prev.filter(id => id !== team.id)
                                : [...prev, team.id]
                            );
                          }}
                        >
                          <Text style={[
                            styles.chipText,
                            isSelected && { color: '#fff' }
                          ]}>{team.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.filterModalSection}>Medical Status</Text>
                  <View style={styles.filterChipRow}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        selectedMedicalStatuses.length === 0 && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                      ]}
                      onPress={() => setSelectedMedicalStatuses([])}
                    >
                      <Text style={[
                        styles.chipText,
                        selectedMedicalStatuses.length === 0 && { color: '#fff' }
                      ]}>All Medical</Text>
                    </TouchableOpacity>
                    {['valid', 'pending', 'expired'].map(status => {
                      const isSelected = selectedMedicalStatuses.includes(status);
                      const statusColor = getMedicalVisaStatusColor(status);
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.chip,
                            isSelected && { 
                              backgroundColor: statusColor + '20',
                              borderColor: statusColor
                            }
                          ]}
                          onPress={() => {
                            setSelectedMedicalStatuses(prev =>
                              prev.includes(status)
                                ? prev.filter(s => s !== status)
                                : [...prev, status]
                            );
                          }}
                        >
                          <Text style={[
                            styles.chipText,
                            isSelected && { color: statusColor }
                          ]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={[styles.filterApplyButton, { backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center', padding: 12, marginTop: 16 }]}
                    onPress={() => setShowFilterModal(false)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Apply Filters</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
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
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: COLORS.text,
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    elevation: 1,
    minWidth: 0,
    maxWidth: '48%',
  },
  filterButtonText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  filterIconButton: {
    padding: SPACING.xs,
  },
  scrollContent: {
    paddingBottom: SPACING.xl * 4,
  },
  playerCard: {
    marginBottom: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    overflow: 'hidden'
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  playerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  teamName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grey[200],
    marginVertical: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[600],
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    minWidth: 70,
    alignItems: 'center',
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  additionalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: SPACING.xs,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    justifyContent: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  modalDeleteButton: {
    justifyContent: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  teamDetailName: {
    fontSize: FONT_SIZES.md,
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
    fontSize: FONT_SIZES.md,
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
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuButton: {
    padding: SPACING.xs,
  },
  menuContainer: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.sm,
    elevation: 4,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 4,
  },
  menuItemText: {
    marginLeft: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
  },
  ageContainer: {
    alignItems: 'flex-end',
  },
  ageLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[600],
  },
  ageValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    minHeight: 320,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterModalSection: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 32,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  filterApplyButton: {
    marginTop: 16,
  },
}); 