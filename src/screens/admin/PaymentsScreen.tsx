import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Platform, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

interface Player {
  id: string;
  name: string;
  team_id: string;
  team: {
    name: string;
  };
  payment_status: 'paid' | 'pending' | 'missed' | 'on_trial';
  last_payment_date: string;
  parent_id: string | null;
  created_at: string;
  birth_date?: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface PaymentStats {
  totalPlayers: number;
  paidPlayers: number;
  missingPayments: number;
}

interface PlayerPayment {
  year: number;
  month: number;
  status: 'paid' | 'pending' | 'missed' | 'on_trial';
}

interface HistoryMonth { year: number; month: number; date: Date; }

const PaymentsScreenComponent = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPlayers: 0,
    paidPlayers: 0,
    missingPayments: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [isPaymentHistoryModalVisible, setIsPaymentHistoryModalVisible] = useState(false);
  const [isStatusChangeModalVisible, setIsStatusChangeModalVisible] = useState(false);
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);
  const [parentDetails, setParentDetails] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<PlayerPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState<any>(null);
  const [historyMonths, setHistoryMonths] = useState<HistoryMonth[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (teamsError) throw teamsError;
      
      // Fetch players with basic info
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          parent_id,
          is_active,
          payment_status,
          last_payment_date,
          created_at,
          birth_date,
          teams:team_id(id, name)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (playersError) throw playersError;

      // Fetch related parent_children data for birth dates
      const parentIds = playersData
        .filter((player: any) => player.parent_id)
        .map((player: any) => player.parent_id);

      const { data: parentChildrenData, error: parentChildrenError } = await supabase
        .from('parent_children')
        .select(`
          id,
          parent_id,
          full_name,
          birth_date,
          team_id
        `)
        .in('parent_id', parentIds)
        .eq('is_active', true);

      if (parentChildrenError) throw parentChildrenError;

      // Create a map for quick lookup
      const childrenMap = new Map<string, any[]>();
      (parentChildrenData || []).forEach((child: any) => {
        if (!childrenMap.has(child.parent_id)) {
          childrenMap.set(child.parent_id, []);
        }
        childrenMap.get(child.parent_id)!.push(child);
      });

      // Transform player data to include payment info
      const transformedPlayers = playersData.map((player: any) => {
        // Use stored payment status or default to pending
        let paymentStatus = player.payment_status || 'pending';
        // If player is on trial (joined < 1 month ago), override status
        const createdAt = new Date(player.created_at);
        const now = new Date();
        const diff = now.getTime() - createdAt.getTime();
        const isOnTrial = diff < 30 * 24 * 60 * 60 * 1000;
        if (isOnTrial) paymentStatus = 'on_trial';
        // Use stored last payment date or set to 'No payment'
        const lastPaymentDate = player.last_payment_date 
          ? new Date(player.last_payment_date).toLocaleDateString('en-GB')
          : 'No payment';
        
        // Look for birth date in parent_children
        let birthDate = player.birth_date;
        if (player.parent_id && childrenMap.has(player.parent_id)) {
          const childrenForParent = childrenMap.get(player.parent_id);
          // Find child with matching name
          const matchingChild = childrenForParent?.find(
            (child: any) => child.full_name.toLowerCase() === player.name.toLowerCase()
          );
          if (matchingChild && matchingChild.birth_date) {
            birthDate = matchingChild.birth_date;
          }
        }
        
        return {
          id: player.id,
          name: player.name,
          team_id: player.team_id,
          team: {
            name: player.teams?.name || 'No Team'
          },
          payment_status: paymentStatus,
          paymentStatus: paymentStatus, // Duplicate for consistency with ManagePlayersScreen
          last_payment_date: lastPaymentDate,
          parent_id: player.parent_id,
          created_at: player.created_at,
          birth_date: birthDate || null,
        };
      });

      // Calculate stats
      const totalPlayers = transformedPlayers.length;
      const paidPlayers = transformedPlayers.filter(p => p.payment_status === 'paid').length;
      const missingPayments = transformedPlayers.filter(p => p.payment_status === 'missed').length;

      setTeams(teamsData || []);
      setPlayers(transformedPlayers);
      setStats({
        totalPlayers,
        paidPlayers,
        missingPayments
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleTeamSelect = (teamId: string | null) => {
    setSelectedTeamId(teamId);
    setIsTeamModalVisible(false);
  };

  const handleStatusSelect = (status: string | null) => {
    setSelectedStatus(status);
    setIsStatusModalVisible(false);
  };

  const handlePlayerMenuPress = (playerId: string) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  const handlePlayerAction = async (action: string, player: Player) => {
    setPlayerMenuVisible(null);
    setSelectedPlayer(player);
    
    switch (action) {
      case 'status':
        setIsStatusChangeModalVisible(true);
        break;
      case 'reminder':
        Alert.alert('Payment Reminder', `Payment reminder sent to ${player.name}'s parent.`);
        break;
      case 'history':
        setIsPaymentHistoryModalVisible(true);
        break;
      case 'details':
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
        break;
      case 'delete':
        Alert.alert(
          'Delete Player',
          `Are you sure you want to delete ${player.name}?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                // In a real app, you would call an API to delete the player
                Alert.alert('Success', `${player.name} has been deleted.`);
              }
            }
          ]
        );
        break;
    }
  };

  const handleChangePaymentStatus = async (status: string) => {
    if (!selectedPlayer) return;
    
    try {
      // Update the payment status in the database
      const today = new Date().toISOString();
      
      const { error } = await supabase
        .from('players')
        .update({ 
          payment_status: status,
          last_payment_date: status === 'paid' ? today : selectedPlayer.last_payment_date
        })
        .eq('id', selectedPlayer.id);
        
      if (error) throw error;
      
      // Update the local state
      const updatedPlayers = players.map(player => 
        player.id === selectedPlayer.id 
          ? {
              ...player, 
              payment_status: status as 'paid' | 'pending' | 'missed' | 'on_trial',
              last_payment_date: status === 'paid' ? new Date().toLocaleDateString('en-GB') : player.last_payment_date
            }
          : player
      );
      
      setPlayers(updatedPlayers);
      
      // Recalculate stats
      const totalPlayers = updatedPlayers.length;
      const paidPlayers = updatedPlayers.filter(p => p.payment_status === 'paid').length;
      const missingPayments = updatedPlayers.filter(p => p.payment_status === 'missed').length;
      
      setStats({
        totalPlayers,
        paidPlayers,
        missingPayments
      });
      
      setIsStatusChangeModalVisible(false);
      Alert.alert('Success', `Payment status updated to ${status}.`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status.');
    }
  };

  // Fetch payment history when opening modal
  const fetchPaymentHistory = async (player: any) => {
    setHistoryLoading(true);
    setHistoryPlayer(player);
    // Get last 12 months
    const months: HistoryMonth[] = [...Array(12)].map((_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return { year: date.getFullYear(), month: date.getMonth() + 1, date };
    });
    setHistoryMonths(months);
    const { data } = await supabase
      .from('player_payments')
      .select('year, month, status')
      .eq('player_id', player.id);
    setPaymentHistory((data as PlayerPayment[]) || []);
    setHistoryLoading(false);
  };

  // When opening payment history modal, call fetchPaymentHistory(selectedPlayer)
  useEffect(() => {
    if (isPaymentHistoryModalVisible && selectedPlayer) {
      fetchPaymentHistory(selectedPlayer);
    }
  }, [isPaymentHistoryModalVisible, selectedPlayer]);

  // When admin changes status for a month:
  const handleChangePaymentStatusForMonth = async (
    player: any,
    year: number,
    month: number,
    newStatus: 'paid' | 'pending' | 'missed' | 'on_trial'
  ) => {
    await supabase
      .from('player_payments')
      .upsert([
        {
          player_id: player.id,
          year,
          month,
          status: newStatus,
        }
      ], { onConflict: 'player_id,year,month' });
    // Refresh payment history
    fetchPaymentHistory(player);
  };

  // Filter players based on search, team, and status
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    const matchesStatus = !selectedStatus || player.payment_status === selectedStatus;
    return matchesSearch && matchesTeam && matchesStatus;
  });

  // Helpers for UI
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLORS.success;
      case 'pending': return '#FFA500'; // Orange
      case 'missed': return COLORS.error;
      case 'on_trial': return COLORS.primary;
      default: return COLORS.grey[600];
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'missed': return 'Missed';
      case 'on_trial': return 'On Trial';
      default: return 'Unknown';
    }
  };

  const selectedTeam = teams.find(team => team.id === selectedTeamId);
  const statusOptions = [
    { value: null, label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'missed', label: 'Missed' },
    { value: 'on_trial', label: 'On Trial' }
  ];
  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus);

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
          {/* Stats Cards - fixed position at top */}
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Total Players</Text>
              <Text style={styles.statsValue}>{stats.totalPlayers}</Text>
            </View>
            
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Paid</Text>
              <Text style={styles.statsValue}>{stats.paidPlayers}</Text>
            </View>
            
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Missing</Text>
              <Text style={styles.statsValue}>{stats.missingPayments}</Text>
            </View>
          </View>

          {/* Filter Section */}
          <View style={styles.filtersContainer}>
            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search player"
                placeholderTextColor={COLORS.grey[400]}
                value={searchQuery}
                onChangeText={handleSearchChange}
              />
            </View>

            <View style={styles.filtersRow}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setIsTeamModalVisible(true)}
              >
                <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={styles.filterIcon} />
                <Text style={styles.filterButtonText} numberOfLines={1}>
                  {selectedTeam ? selectedTeam.name : 'All Teams'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setIsStatusModalVisible(true)}
              >
                <MaterialCommunityIcons name="cash-multiple" size={20} color={COLORS.primary} style={styles.filterIcon} />
                <Text style={styles.filterButtonText} numberOfLines={1}>
                  {selectedStatusOption?.label || 'All Status'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Players List */}
          <ScrollView style={styles.playersContainer}>
            {filteredPlayers.length === 0 ? (
              <Text style={styles.emptyText}>No players found</Text>
            ) : (
              filteredPlayers.map(player => (
                <View key={player.id} style={styles.playerCard}>
                  <View style={styles.cardPressable}>
                    <View style={styles.playerCardContent}>
                      <View style={styles.nameRow}>
                        <Text style={styles.playerName}>{player.name}</Text>
                        <Text style={styles.teamName}>{player.team.name}</Text>
                        <TouchableOpacity 
                          onPress={() => handlePlayerMenuPress(player.id)}
                          style={styles.menuButton}
                        >
                          <MaterialCommunityIcons name="dots-vertical" size={20} color={COLORS.grey[600]} />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.paymentInfo}>
                        <View>
                          <Text style={styles.paymentLabel}>Last Payment</Text>
                          <Text style={styles.paymentDate}>{player.last_payment_date}</Text>
                        </View>
                        
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: getPaymentStatusColor(player.payment_status) + '20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: getPaymentStatusColor(player.payment_status) }
                          ]}>
                            {getPaymentStatusText(player.payment_status)}
                          </Text>
                        </View>
                      </View>

                      {playerMenuVisible === player.id && (
                        <View style={styles.menuContainer}>
                          <TouchableOpacity 
                            style={styles.menuItem}
                            onPress={() => handlePlayerAction('status', player)}
                          >
                            <MaterialCommunityIcons name="cash" size={20} color={COLORS.primary} />
                            <Text style={styles.menuItemText}>Change payment status</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.menuItem}
                            onPress={() => handlePlayerAction('reminder', player)}
                          >
                            <MaterialCommunityIcons name="bell" size={20} color={COLORS.primary} />
                            <Text style={styles.menuItemText}>Send payment reminder</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.menuItem}
                            onPress={() => handlePlayerAction('history', player)}
                          >
                            <MaterialCommunityIcons name="history" size={20} color={COLORS.primary} />
                            <Text style={styles.menuItemText}>View payment history</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.menuItem}
                            onPress={() => handlePlayerAction('details', player)}
                          >
                            <MaterialCommunityIcons name="account-details" size={20} color={COLORS.primary} />
                            <Text style={styles.menuItemText}>View player details</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.menuItem}
                            onPress={() => handlePlayerAction('delete', player)}
                          >
                            <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
                            <Text style={[styles.menuItemText, { color: COLORS.error }]}>Delete player</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
        
        {/* Team Selection Modal */}
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
                <TouchableOpacity 
                  onPress={() => setIsTeamModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView>
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedTeamId === null && styles.selectedModalItem
                  ]}
                  onPress={() => handleTeamSelect(null)}
                >
                  <Text style={styles.modalItemText}>All Teams</Text>
                  {selectedTeamId === null && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
                
                {teams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.modalItem,
                      selectedTeamId === team.id && styles.selectedModalItem
                    ]}
                    onPress={() => handleTeamSelect(team.id)}
                  >
                    <Text style={styles.modalItemText}>{team.name}</Text>
                    {selectedTeamId === team.id && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Status Selection Modal */}
        <Modal
          visible={isStatusModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsStatusModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Status</Text>
                <TouchableOpacity 
                  onPress={() => setIsStatusModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView>
                {statusOptions.map(option => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.modalItem,
                      selectedStatus === option.value && styles.selectedModalItem
                    ]}
                    onPress={() => handleStatusSelect(option.value)}
                  >
                    <Text style={styles.modalItemText}>{option.label}</Text>
                    {selectedStatus === option.value && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Player Details Modal */}
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
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {selectedPlayer && (
                <ScrollView>
                  <View style={styles.detailsContainer}>
                    <View style={styles.avatarContainer}>
                      <MaterialCommunityIcons name="account-circle" size={80} color={COLORS.primary} />
                      <Text style={styles.playerDetailName}>{selectedPlayer.name}</Text>
                      <Text style={styles.teamDetailName}>{selectedPlayer.team.name}</Text>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.sectionTitle}>Player Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Join Date:</Text>
                        <Text style={styles.detailValue}>{selectedPlayer.created_at ? new Date(selectedPlayer.created_at).toLocaleDateString('en-GB') : 'Unknown'}</Text>
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
                      <Text style={styles.sectionTitle}>Payment Information</Text>
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
                        <Text style={styles.detailValue}>{selectedPlayer.last_payment_date}</Text>
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
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Payment History Modal */}
        <Modal
          visible={isPaymentHistoryModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPaymentHistoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment History</Text>
                <TouchableOpacity 
                  onPress={() => setIsPaymentHistoryModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {selectedPlayer && (
                <ScrollView>
                  <View style={styles.paymentHistoryHeader}>
                    <Text style={styles.playerDetailName}>{selectedPlayer.name}</Text>
                    <Text style={styles.teamDetailName}>{selectedPlayer.team.name}</Text>
                  </View>
                  <View style={styles.paymentGrid}>
                    {historyLoading ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      historyMonths.map(({ year, month, date }, i) => {
                        const joinDate = new Date(selectedPlayer.created_at);
                        if (date < joinDate) {
                          return (
                            <View key={i} style={[styles.paymentGridItem, { backgroundColor: '#F5F5F5' }] }>
                              <Text style={styles.paymentGridMonth}>{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: '#eee' }] }>
                                <Text style={[styles.statusText, { color: '#aaa' }]}>No data</Text>
                              </View>
                            </View>
                          );
                        }
                        const payment = paymentHistory.find(p => p.year === year && p.month === month);
                        let status: 'paid' | 'pending' | 'missed' | 'on_trial';
                        if (payment) {
                          status = payment.status;
                        } else if (date.getTime() - joinDate.getTime() < 30 * 24 * 60 * 60 * 1000) {
                          status = 'on_trial';
                        } else {
                          status = 'pending';
                        }
                        return (
                          <View key={i} style={[styles.paymentGridItem, { backgroundColor: status === 'paid' ? '#E8F5E9' : status === 'missed' ? '#FFEBEE' : '#F5F5F5' }] }>
                            <Text style={styles.paymentGridMonth}>{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(status) + '20' }] }>
                              <Text style={[styles.statusText, { color: getPaymentStatusColor(status) }]}>{getPaymentStatusText(status)}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Change Status Modal */}
        <Modal
          visible={isStatusChangeModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsStatusChangeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Payment Status</Text>
                <TouchableOpacity 
                  onPress={() => setIsStatusChangeModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {selectedPlayer && (
                <View>
                  <Text style={styles.statusChangeText}>
                    Change payment status for {selectedPlayer.name}
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.success + '20' }]}
                    onPress={() => handleChangePaymentStatus('paid')}
                  >
                    <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                    <Text style={[styles.statusButtonText, { color: COLORS.success }]}>Paid</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#FFA500' + '20' }]}
                    onPress={() => handleChangePaymentStatus('pending')}
                  >
                    <MaterialCommunityIcons name="clock" size={24} color={'#FFA500'} />
                    <Text style={[styles.statusButtonText, { color: '#FFA500' }]}>Pending</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.error + '20' }]}
                    onPress={() => handleChangePaymentStatus('missed')}
                  >
                    <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.error} />
                    <Text style={[styles.statusButtonText, { color: COLORS.error }]}>Missed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
    </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

// Export the component both ways for cross-platform compatibility
export const PaymentsScreen = () => {
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <PaymentsScreenComponent />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#0CC1EC',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.xs,
  },
  statsLabel: {
    color: COLORS.white,
    fontSize: 14,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  statsValue: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: 'bold',
  },
  filtersContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
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
    fontSize: 16,
    color: COLORS.text,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    elevation: 1,
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
  playersContainer: {
    flex: 1,
    padding: SPACING.lg,
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
    fontWeight: 'bold',
    color: COLORS.text,
  },
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  menuButton: {
    padding: 4,
  },
  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: SPACING.sm,
    elevation: 4,
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
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 12,
    color: COLORS.grey[600],
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
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
  emptyText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    fontSize: 16,
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
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  selectedModalItem: {
    backgroundColor: COLORS.primary + '10',
  },
  modalItemText: {
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
  paymentHistoryHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  paymentGrid: {
    padding: SPACING.lg,
  },
  paymentGridItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 8,
  },
  paymentGridMonth: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusChangeText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 8,
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: SPACING.md,
  },
}); 