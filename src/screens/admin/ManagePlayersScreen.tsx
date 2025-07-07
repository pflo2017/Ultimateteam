import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Pressable, Alert } from 'react-native';
import { Text, ActivityIndicator, Card, IconButton, Divider } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/AdminTabNavigator';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { registerEventListener } from '../../utils/events';
import { getUserClubId } from '../../services/activitiesService';

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
  medical_visa_issue_date?: string;
  paymentMethod?: string;
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
  const [selectedMedicalStatus, setSelectedMedicalStatus] = useState<string | null>(null);
  const [isMedicalModalVisible, setIsMedicalModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const medicalStatusOptions = [
    { value: null, label: 'All Medical' },
    { value: 'valid', label: 'Valid' },
    { value: 'pending', label: 'Pending' },
    { value: 'expired', label: 'Expired' },
  ];

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    const matchesMedical = !selectedMedicalStatus || player.medicalVisaStatus === selectedMedicalStatus;
    return matchesSearch && matchesTeam && matchesMedical;
  });

  const handleOpenPlayerDetails = async (player: Player) => {
    try {
      console.log("Opening player details for:", player.id);
      
      // Navigate to the player details screen
      navigation.navigate('PlayerDetails', {
        playerId: player.id,
        role: 'admin'
      });
    } catch (error) {
      console.error('Error opening player details:', error);
      Alert.alert('Error', 'Could not open player details');
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
    switch (status.toLowerCase()) {
      case 'valid':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'expired':
        return COLORS.error;
      case 'no_status':
        return COLORS.grey[600];
      default:
        return COLORS.grey[600];
    }
  };

  const getPaymentStatusColor = (status: string) => {
    return status?.toLowerCase() === 'paid' ? COLORS.success : COLORS.error;
  };

  const getPaymentStatusText = (status: string) => {
    return status?.toLowerCase() === 'paid' ? 'Paid' : 'Not Paid';
  };

  const getPlayerPaymentStatus = (player: Player): string => {
    // Use payment_status directly - no mapping needed
    return player.paymentStatus || player.payment_status || 'pending';
  };

  useEffect(() => {
    onRefresh();
  }, []);
  
  // Listen for medical visa status changes
  useEffect(() => {
    console.log("[AdminManagePlayersScreen] Setting up medical visa status change listener");
    
    const handleMedicalVisaStatusChange = () => {
      console.log("[AdminManagePlayersScreen] Medical visa status change detected - refreshing player data");
      onRefresh();
    };
    
    const unregister = registerEventListener('medical_visa_status_changed', handleMedicalVisaStatusChange);
    
    return () => {
      unregister();
    };
  }, [onRefresh]);
  
  // Use data refresh hook to refresh player data when status changes
  useDataRefresh('players', () => {
    console.log("[ManagePlayersScreen] Payment status change detected - refreshing player data");
    onRefresh();
  });

  // Listen for payment status changes from PaymentsScreen
  useEffect(() => {
    const handlePaymentStatusChange = () => {
      console.log('[ManagePlayersScreen] Payment status changed, refreshing player data');
      onRefresh();
    };
    const unregister = registerEventListener('payment_status_changed', handlePaymentStatusChange);
    return () => unregister();
  }, [onRefresh]);

  // Create a PlayerCard component that fetches fresh status data
  const PlayerCardWithFreshStatus = ({ player }: { player: Player }) => {
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
                {player.medicalVisaStatus === 'no_status' 
                  ? 'No Status' 
                  : player.medicalVisaStatus.charAt(0).toUpperCase() + player.medicalVisaStatus.slice(1)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: COLORS.grey[600], fontWeight: '500' }}>Until</Text>
              <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '600' }}>
                {'N/A'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md }}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color={COLORS.primary} />
            {player.paymentStatus === 'paid' && player.last_payment_date ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500', marginRight: 8 }}>
                    Payment Status
                  </Text>
                  <View style={{
                    backgroundColor: getPaymentStatusColor(player.paymentStatus || '') + '20',
                    borderRadius: 12,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZES.xs,
                      fontWeight: '600',
                      color: getPaymentStatusColor(player.paymentStatus || '')
                    }}>
                      {getPaymentStatusText(player.paymentStatus || '')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500' }}>
                  {new Date(player.last_payment_date).toLocaleDateString('en-GB')}
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500', marginRight: 8 }}>
                    Payment Status
                  </Text>
                  <View style={{
                    backgroundColor: getPaymentStatusColor(player.paymentStatus || '') + '20',
                    borderRadius: 12,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZES.xs,
                      fontWeight: '600',
                      color: getPaymentStatusColor(player.paymentStatus || '')
                    }}>
                      {getPaymentStatusText(player.paymentStatus || '')}
                    </Text>
                  </View>
                </View>
                {/* Details below, left-aligned with label */}
                {player.paymentStatus !== 'paid' && player.last_payment_date && (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8, marginLeft: 0 }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.text }}>
                      {new Date(player.last_payment_date).toLocaleDateString('en-GB', { month: 'long' })}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.grey[600], fontWeight: '500', marginLeft: 6 }}>
                      Paid on {new Date(player.last_payment_date).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {/* Payment method badge */}
            {player.paymentStatus === 'paid' && player.paymentMethod && (
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: COLORS.primary + '15',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
                marginTop: 2,
                marginBottom: 2,
              }}>
                <Text style={{ fontSize: 13, color: COLORS.primary }}>
                  {player.paymentMethod === 'cash' && 'Cash'}
                  {player.paymentMethod === 'voucher_cash' && 'Voucher & cash'}
                  {player.paymentMethod === 'bank_transfer' && 'Bank transfer'}
                  {!['cash','voucher_cash','bank_transfer'].includes(player.paymentMethod) && player.paymentMethod}
                </Text>
              </View>
            )}
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
        <View>
          <Text style={styles.headerTitle}>Players</Text>
          <Text style={styles.totalCount}>Total: {filteredPlayers.length} players</Text>
        </View>
        <TouchableOpacity onPress={() => setIsFilterModalVisible(true)}>
          <MaterialCommunityIcons name="filter" size={24} color={COLORS.primary} />
        </TouchableOpacity>
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
        visible={isMedicalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMedicalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Medical Status</Text>
              <Pressable 
                onPress={() => setIsMedicalModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </Pressable>
            </View>
            <ScrollView>
              {medicalStatusOptions.map(option => (
                <Pressable
                  key={option.value ?? 'all'}
                  style={[
                    styles.teamItem,
                    selectedMedicalStatus === option.value && styles.selectedTeamItem
                  ]}
                  onPress={() => {
                    setSelectedMedicalStatus(option.value);
                    setIsMedicalModalVisible(false);
                  }}
                >
                  <View style={styles.teamItemContent}>
                    <MaterialCommunityIcons
                      name="medical-bag"
                      size={20}
                      color={option.value === 'valid' ? COLORS.success : option.value === 'pending' ? '#FFA500' : option.value === 'expired' ? COLORS.error : COLORS.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.teamItemText}>{option.label}</Text>
                  </View>
                  {selectedMedicalStatus === option.value && (
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
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderRadius: 16, padding: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Filter Players</Text>
              <Pressable 
                onPress={() => setIsFilterModalVisible(false)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#000"
                />
              </Pressable>
            </View>
            
            <ScrollView style={{ maxHeight: '80%' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 16 }}>Teams</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: selectedTeamId === null ? COLORS.primary : 'transparent',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selectedTeamId === null ? COLORS.primary : COLORS.grey[300],
                    marginBottom: 8
                  }}
                  onPress={() => setSelectedTeamId(null)}
                >
                  <Text style={{ 
                    color: selectedTeamId === null ? COLORS.white : COLORS.text,
                    fontWeight: '500',
                    fontSize: 14
                  }}>
                    All Teams
                  </Text>
                </TouchableOpacity>
                
                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={{
                      backgroundColor: selectedTeamId === team.id ? COLORS.primary : 'transparent',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: selectedTeamId === team.id ? COLORS.primary : COLORS.grey[300],
                      marginBottom: 8
                    }}
                    onPress={() => setSelectedTeamId(team.id)}
                  >
                    <Text style={{ 
                      color: selectedTeamId === team.id ? COLORS.white : COLORS.text,
                      fontWeight: '500',
                      fontSize: 14
                    }}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 16 }}>Medical Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {medicalStatusOptions.map(option => (
                  <TouchableOpacity
                    key={option.value ?? 'all'}
                    style={{
                      backgroundColor: selectedMedicalStatus === option.value ? 
                        (option.value === 'valid' ? COLORS.success : 
                         option.value === 'pending' ? COLORS.warning : 
                         option.value === 'expired' ? COLORS.error : COLORS.primary) : 'transparent',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: option.value === 'valid' ? COLORS.success : 
                                   option.value === 'pending' ? COLORS.warning : 
                                   option.value === 'expired' ? COLORS.error : COLORS.primary,
                      marginBottom: 8
                    }}
                    onPress={() => setSelectedMedicalStatus(option.value)}
                  >
                    <Text style={{ 
                      color: selectedMedicalStatus === option.value ? COLORS.white : 
                            (option.value === 'valid' ? COLORS.success : 
                             option.value === 'pending' ? COLORS.warning : 
                             option.value === 'expired' ? COLORS.error : COLORS.primary),
                      fontWeight: '500',
                      fontSize: 14
                    }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 16
              }}
              onPress={() => {
                setIsFilterModalVisible(false);
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 16 }}>Apply Filters</Text>
            </TouchableOpacity>
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
    backgroundColor: COLORS.background,
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
  filterIcon: {
    marginRight: SPACING.xs,
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
  infoValueText: {
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
}); 