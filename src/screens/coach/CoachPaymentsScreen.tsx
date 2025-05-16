import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Platform, SafeAreaView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Player {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  medical_visa_status: string;
  payment_status: string;
  parent_id: string | null;
  last_payment_date?: string;
  created_at?: string;
  birth_date?: string;
}

interface Team {
  id: string;
  name: string;
}

interface PaymentStats {
  totalPlayers: number;
  paidPlayers: number;
  unpaidPlayers: number;
  onTrialPlayers: number;
  pendingPlayers: number;
}

interface PlayerPayment {
  year: number;
  month: number;
  status: 'on_trial' | 'pending' | 'paid' | 'unpaid' | 'trial_ended';
}

interface HistoryMonth { 
  year: number; 
  month: number; 
  date: Date; 
}

export const CoachPaymentsScreen = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPlayers: 0,
    paidPlayers: 0,
    unpaidPlayers: 0,
    onTrialPlayers: 0,
    pendingPlayers: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [isPaymentHistoryModalVisible, setIsPaymentHistoryModalVisible] = useState(false);
  const [parentDetails, setParentDetails] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<PlayerPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState<any>(null);
  const [historyMonths, setHistoryMonths] = useState<HistoryMonth[]>([]);
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([
    { value: 'select_status', label: 'Select Status' },
    { value: 'on_trial', label: 'On Trial' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'trial_ended', label: 'Trial Ended' },
  ]);
  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus);
  const [isStatusChangeModalVisible, setIsStatusChangeModalVisible] = useState(false);
  const [openDropdownMonth, setOpenDropdownMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Get coach data from AsyncStorage
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        Alert.alert('Error', 'Coach data not found. Please log in again.');
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      
      // Fetch teams assigned to this coach
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });
      
      if (teamsError) throw teamsError;
      
      // Transform teams data
      const transformedTeams = (teamsData || []).map((team: any) => ({
        id: team.team_id,
        name: team.team_name
      }));
      
      setTeams(transformedTeams);
      
      // Fetch players assigned to this coach's teams
      const { data: playersData, error: playersError } = await supabase
        .rpc('get_coach_players', { p_coach_id: coachData.id });
      
      if (playersError) throw playersError;
      
      // Fetch player birthdates from parent_children table
      const { data: parentChildrenData, error: parentChildrenError } = await supabase
        .from('parent_children')
        .select('parent_id, full_name, birth_date')
        .eq('is_active', true);
        
      if (parentChildrenError) {
        console.error('Error fetching parent children data:', parentChildrenError);
      }
      
      // Fetch team creation dates for join date fallback
      const { data: teamsCreateDates, error: teamsCreateDatesError } = await supabase
        .from('teams')
        .select('id, created_at');
        
      if (teamsCreateDatesError) {
        console.error('Error fetching teams creation dates:', teamsCreateDatesError);
      }
      
      // Enhance player data with team creation dates and birthdates
      const enhancedPlayersData = (playersData || []).map((player: Player) => {
        // Find team creation date as fallback for player join date
        const teamCreationDate = teamsCreateDates?.find(t => t.id === player.team_id)?.created_at;
        
        // Find matching child record for birthdate
        const childRecord = parentChildrenData?.find(
          child => child.parent_id === player.parent_id && 
                  child.full_name.toLowerCase() === player.player_name.toLowerCase()
        );
        
        return {
          ...player,
          // Use team creation date as fallback if player has no creation date
          created_at: player.created_at || teamCreationDate,
          // Use birthdate from parent_children if available
          birth_date: childRecord?.birth_date || player.birth_date
        };
      });
      
      setPlayers(enhancedPlayersData || []);
      
      // Calculate stats
      const totalPlayers = enhancedPlayersData.length;
      const paidPlayers = enhancedPlayersData.filter((p: Player) => p.payment_status === 'paid').length;
      const unpaidPlayers = enhancedPlayersData.filter((p: Player) => p.payment_status === 'unpaid').length;
      const onTrialPlayers = enhancedPlayersData.filter((p: Player) => p.payment_status === 'on_trial').length;
      const pendingPlayers = enhancedPlayersData.filter((p: Player) => p.payment_status === 'pending').length;
      
      setStats({
        totalPlayers,
        paidPlayers,
        unpaidPlayers,
        onTrialPlayers,
        pendingPlayers
      });
      
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
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

  const handleOpenPlayerDetails = async (player: Player) => {
    setSelectedPlayer(player);
    
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
  };

  const fetchPaymentHistory = async (player: any) => {
    setHistoryLoading(true);
    setHistoryPlayer(player);
    
    // Get current date info
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    // Create array of months for the current year only (January to current month)
    const months = [];
    // Start from January (month 0) and go up to the current month
    for (let i = 0; i <= currentMonth; i++) {
      months.push({
        year: currentYear,
        month: i + 1, // Convert to 1-12 format
        date: new Date(currentYear, i, 1)
      });
    }
    
    // Reverse the order to show most recent month first
    months.reverse();
    
    setHistoryMonths(months);
    
    // Fetch payment history data for the current year only
    try {
      const { data } = await supabase
        .from('player_payments')
        .select('year, month, status')
        .eq('player_id', player.player_id)
        .eq('year', currentYear); // Only get current year
      
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // When opening payment history modal, call fetchPaymentHistory(selectedPlayer)
  useEffect(() => {
    if (isPaymentHistoryModalVisible && selectedPlayer) {
      fetchPaymentHistory(selectedPlayer);
    }
  }, [isPaymentHistoryModalVisible, selectedPlayer]);

  // Helper functions for UI
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLORS.success;
      case 'pending': return '#FFA500';
      case 'unpaid': return COLORS.error;
      case 'on_trial': return COLORS.primary;
      case 'trial_ended': return COLORS.grey[800];
      case 'select_status': return COLORS.text;
      default: return COLORS.grey[600];
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'unpaid': return 'Unpaid';
      case 'on_trial': return 'On Trial';
      case 'trial_ended': return 'Trial Ended';
      case 'select_status': return 'Select Status';
      default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    }
  };

  // First, add a helper function to map database status values back to display values
  const getDisplayPaymentStatus = (dbStatus: string): string => {
    // Map database status values back to display values
    switch(dbStatus) {
      case 'paid':
        return 'paid';
      case 'pending':
        return 'unpaid'; // Display 'pending' database values as 'unpaid' in the UI
      case 'on_trial':
        return 'on_trial';
      case 'trial_ended':
        return 'trial_ended';
      default:
        return dbStatus;
    }
  };

  // Add this helper function near the getDisplayPaymentStatus function
  const getValidDatabaseStatus = (status: string): string => {
    // Map UI status values to valid database values
    switch(status) {
      case 'paid':
        return 'paid';
      case 'unpaid': 
        // The database uses 'pending' instead of 'unpaid'
        return 'pending'; 
      case 'on_trial':
        return 'on_trial';
      case 'pending':
        return 'pending';
      case 'trial_ended':
        return 'trial_ended';
      default:
        return 'on_trial'; // Default to a safe value
    }
  };

  // Handle player menu visibility
  const handlePlayerMenuPress = (playerId: string) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  // Filter players based on search and team
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.player_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  // Then add the medical visa status color function
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

  const handlePlayerAction = async (action: string, player: Player) => {
    setPlayerMenuVisible(null);
    setSelectedPlayer(player);
    switch (action) {
      case 'status':
        setIsStatusChangeModalVisible(true);
        break;
      case 'reminder':
        Alert.alert('Payment Reminder', `Payment reminder sent to ${player.player_name}'s parent.`);
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
            setParentDetails(null);
          }
        } else {
          setParentDetails(null);
        }
        setIsPlayerDetailsModalVisible(true);
        break;
    }
  };

  const handleChangePaymentStatus = async (newStatus: string) => {
    if (selectedPlayer) {
      try {
        // First update the player record (direct status)
        const { error: playerError } = await supabase
          .from('players')
          .update({ payment_status: newStatus })
          .eq('id', selectedPlayer.player_id);
        
        if (playerError) throw playerError;
        
        // Then insert/update the payment history for current month if needed
        const currentYear = 2025;
        const currentMonth = new Date().getMonth() + 1;
        
        // Map UI status to database-compatible status
        const dbStatus = getValidDatabaseStatus(newStatus);
        
        const { error: historyError } = await supabase
          .from('player_payments')
          .upsert({
            player_id: selectedPlayer.player_id,
            year: currentYear,
            month: currentMonth,
            status: dbStatus // Use the mapped status value
          }, {
            onConflict: 'player_id,year,month'
          });
        
        if (historyError) {
          console.error('Error updating payment history:', historyError);
          // Continue even if history update fails - we still updated the player
        }
        
        // Update UI
        const updatedPlayer = { ...selectedPlayer, payment_status: newStatus };
        const updatedPlayers = players.map(p => 
          p.player_id === selectedPlayer.player_id ? updatedPlayer : p
        );
        setPlayers(updatedPlayers);
        
        // Update stats
        const updatedStats = { ...stats };
        if (selectedPlayer.payment_status !== newStatus) {
          // Decrement the old status count
          if (selectedPlayer.payment_status === 'paid') updatedStats.paidPlayers--;
          else if (selectedPlayer.payment_status === 'unpaid') updatedStats.unpaidPlayers--;
          else if (selectedPlayer.payment_status === 'on_trial') updatedStats.onTrialPlayers--;
          else if (selectedPlayer.payment_status === 'pending') updatedStats.pendingPlayers--;
          
          // Increment the new status count
          if (newStatus === 'paid') updatedStats.paidPlayers++;
          else if (newStatus === 'unpaid') updatedStats.unpaidPlayers++;
          else if (newStatus === 'on_trial') updatedStats.onTrialPlayers++;
          else if (newStatus === 'pending') updatedStats.pendingPlayers++;
        }
        setStats(updatedStats);
        
        // Update selected player
        setSelectedPlayer(updatedPlayer);
        
        // Close modal and show success message
        setIsStatusChangeModalVisible(false);
        Alert.alert('Success', `Payment status updated to ${getPaymentStatusText(newStatus).toLowerCase()}.`);
        
      } catch (error) {
        console.error('Error changing payment status:', error);
        Alert.alert('Error', 'Failed to change payment status. Please try again.');
      }
    }
  };

  const handleStatusSelect = (status: string | null) => {
    setSelectedStatus(status);
    setIsStatusModalVisible(false);
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
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
            <Text style={styles.statsLabel}>Unpaid</Text>
            <Text style={styles.statsValue}>{stats.unpaidPlayers + stats.pendingPlayers}</Text>
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
        
        {/* Player List */}
        <ScrollView style={styles.playersContainer} contentContainerStyle={styles.playersList}>
          {filteredPlayers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-off" size={48} color={COLORS.grey[400]} />
              <Text style={styles.emptyStateText}>No players found</Text>
            </View>
          ) : (
            filteredPlayers.map(player => (
              <View key={player.player_id} style={styles.playerCard}>
                <View style={styles.cardPressable}>
                  <View style={styles.playerCardContent}>
                    <View style={styles.nameRow}>
                      <Text style={styles.playerName}>{player.player_name}</Text>
                      <Text style={styles.teamName}>{player.team_name}</Text>
                      <TouchableOpacity 
                        onPress={() => handlePlayerMenuPress(player.player_id)}
                      >
                        <MaterialCommunityIcons name="dots-vertical" size={20} color={COLORS.grey[600]} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.paymentInfo}>
                      <View>
                        <Text style={styles.paymentLabel}>Last Payment</Text>
                        <Text style={styles.paymentDate}>{player.last_payment_date || 'No payment'}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getPaymentStatusColor(player.payment_status) + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: getPaymentStatusColor(player.payment_status), fontWeight: player.payment_status === 'select_status' ? 'bold' : '500' }
                        ]}>
                          {getPaymentStatusText(player.payment_status)}
                        </Text>
                      </View>
                    </View>
                    {playerMenuVisible === player.player_id && (
                      <View style={styles.menuContainer}>
                        <TouchableOpacity 
                          style={styles.menuItem}
                          onPress={() => handlePlayerAction('status', player)}
                        >
                          <MaterialCommunityIcons name="pencil" size={20} color={COLORS.primary} />
                          <Text style={styles.menuItemText}>Change Payment Status</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.menuItem}
                          onPress={() => handlePlayerAction('reminder', player)}
                        >
                          <MaterialCommunityIcons name="bell" size={20} color={COLORS.primary} />
                          <Text style={styles.menuItemText}>Send Reminder</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.menuItem}
                          onPress={() => handlePlayerAction('history', player)}
                        >
                          <MaterialCommunityIcons name="history" size={20} color={COLORS.primary} />
                          <Text style={styles.menuItemText}>View Payment History</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.menuItem}
                          onPress={() => handlePlayerAction('details', player)}
                        >
                          <MaterialCommunityIcons name="account" size={20} color={COLORS.primary} />
                          <Text style={styles.menuItemText}>View Player Details</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        
        {/* Team Filter Modal */}
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
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[styles.teamOption, !selectedTeamId && styles.teamOptionSelected]}
                onPress={() => handleTeamSelect(null)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.teamOptionText, !selectedTeamId && styles.teamOptionTextSelected]}>All Teams</Text>
                </View>
                {!selectedTeamId && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.teamOption, selectedTeamId === team.id && styles.teamOptionSelected]}
                  onPress={() => handleTeamSelect(team.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.teamOptionText, selectedTeamId === team.id && styles.teamOptionTextSelected]}>
                      {team.name}
                    </Text>
                  </View>
                  {selectedTeamId === team.id && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
        
        {/* Status Change Modal */}
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
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              {selectedPlayer && (
                <View>
                  <Text style={styles.statusChangeText}>
                    Change payment status for {selectedPlayer.player_name}
                  </Text>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.success + '20' }]}
                    onPress={() => handleChangePaymentStatus('paid')}
                  >
                    <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                    <Text style={[styles.statusButtonText, { color: COLORS.success }]}>Paid</Text>
                    {selectedPlayer.payment_status === 'paid' && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.success} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#FFA500' + '20' }]}
                    onPress={() => handleChangePaymentStatus('pending')}
                  >
                    <MaterialCommunityIcons name="clock" size={24} color={'#FFA500'} />
                    <Text style={[styles.statusButtonText, { color: '#FFA500' }]}>Pending</Text>
                    {selectedPlayer.payment_status === 'pending' && (
                      <MaterialCommunityIcons name="check" size={20} color={'#FFA500'} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.error + '20' }]}
                    onPress={() => handleChangePaymentStatus('unpaid')}
                  >
                    <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.error} />
                    <Text style={[styles.statusButtonText, { color: COLORS.error }]}>Unpaid</Text>
                    {selectedPlayer.payment_status === 'unpaid' && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.error} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.primary + '20' }]}
                    onPress={() => handleChangePaymentStatus('on_trial')}
                  >
                    <MaterialCommunityIcons name="ticket-percent" size={24} color={COLORS.primary} />
                    <Text style={[styles.statusButtonText, { color: COLORS.primary }]}>On Trial</Text>
                    {selectedPlayer.payment_status === 'on_trial' && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.grey[800] + '20' }]}
                    onPress={() => handleChangePaymentStatus('trial_ended')}
                  >
                    <MaterialCommunityIcons name="ticket-confirmation" size={24} color={COLORS.grey[800]} />
                    <Text style={[styles.statusButtonText, { color: COLORS.grey[800] }]}>Trial Ended</Text>
                    {selectedPlayer.payment_status === 'trial_ended' && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.grey[800]} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                </View>
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
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {selectedPlayer && (
                <ScrollView>
                  <View style={styles.detailsContainer}>
                    <View style={styles.paymentHistoryHeader}>
                      <Text style={styles.playerDetailName}>{selectedPlayer.player_name}</Text>
                      <Text style={styles.teamDetailName}>{selectedPlayer.team_name}</Text>
                      
                      <View style={[styles.statusBadge, { 
                        backgroundColor: getPaymentStatusColor(selectedPlayer.payment_status) + '20',
                        marginTop: SPACING.md
                      }]}>
                        <Text style={[styles.statusText, { 
                          color: getPaymentStatusColor(selectedPlayer.payment_status),
                          fontSize: 14
                        }]}>
                          {getPaymentStatusText(selectedPlayer.payment_status)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.modalSectionTitle}>Monthly Status</Text>
                      {historyMonths.map(({ year, month, date }, i) => {
                        const payment = paymentHistory.find(p => p.year === year && p.month === month);
                        const currentMonth = new Date().getMonth() + 1;
                        const monthKey = `${year}-${month}`;
                        
                        // Determine status to display
                        let displayStatus;
                        
                        if (payment) {
                          // We have a specific record - map it to display value
                          displayStatus = getDisplayPaymentStatus(payment.status);
                        } else if (month === currentMonth) {
                          // Current month - use player's current status
                          displayStatus = selectedPlayer.payment_status;
                        } else {
                          // No specific status
                          displayStatus = null; // No data
                        }

                        // Format month name shorter
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const shortMonth = monthNames[date.getMonth()];
                        
                        return (
                          <View key={monthKey} style={styles.paymentHistoryRow}>
                            {/* Month and year */}
                            <View style={styles.monthYearContainer}>
                              <Text style={styles.monthText}>{shortMonth}</Text>
                              <Text style={styles.yearText}>{year}</Text>
                            </View>
                            
                            {/* Status dropdown */}
                            <View style={styles.dropdownContainer}>
                              {displayStatus ? (
                                <TouchableOpacity 
                                  style={styles.statusContainer}
                                  onPress={() => {
                                    if (openDropdownMonth === monthKey) {
                                      setOpenDropdownMonth(null);
                                    } else {
                                      setOpenDropdownMonth(monthKey);
                                    }
                                  }}
                                >
                                  <View style={[
                                    styles.statusPill, 
                                    { backgroundColor: getPaymentStatusColor(displayStatus) + '20' }
                                  ]}>
                                    <Text style={[
                                      styles.statusText, 
                                      { color: getPaymentStatusColor(displayStatus) }
                                    ]}>
                                      {getPaymentStatusText(displayStatus)}
                                    </Text>
                                  </View>
                                  <MaterialCommunityIcons 
                                    name="chevron-down" 
                                    size={20} 
                                    color={COLORS.grey[600]}
                                    style={styles.dropdownIcon}
                                  />
                                </TouchableOpacity>
                              ) : (
                                <View style={[styles.statusPill, { backgroundColor: COLORS.grey[200] }]}> 
                                  <Text style={[styles.statusText, { color: COLORS.grey[600] }]}>No data</Text>
                                </View>
                              )}
                              
                              {/* Dropdown menu */}
                              {openDropdownMonth === monthKey && displayStatus && (
                                <View style={styles.dropdownMenu}>
                                  {/* Paid option */}
                                  <TouchableOpacity 
                                    style={styles.dropdownItem}
                                    onPress={async () => {
                                      // Close dropdown
                                      setOpenDropdownMonth(null);
                                      
                                      // Map UI status to database-compatible status
                                      const dbStatus = getValidDatabaseStatus('paid');
                                      
                                      // Update UI first
                                      const updatedHistory = [...paymentHistory];
                                      const existingIndex = updatedHistory.findIndex(p => 
                                        p.year === year && p.month === month
                                      );
                                      
                                      if (existingIndex >= 0) {
                                        updatedHistory[existingIndex].status = 'paid';
                                      } else {
                                        updatedHistory.push({
                                          year, month, status: 'paid'
                                        });
                                      }
                                      setPaymentHistory(updatedHistory);
                                      
                                      // Then update DB with mapped status
                                      await supabase
                                        .from('player_payments')
                                        .upsert([{
                                          player_id: selectedPlayer.player_id,
                                          year,
                                          month,
                                          status: dbStatus, // Use mapped status
                                        }], { onConflict: 'player_id,year,month' });
                                          
                                      // Update current player status if this is current month
                                      if (month === currentMonth) {
                                        const updatedPlayers = players.map(p => 
                                          p.player_id === selectedPlayer.player_id 
                                            ? {...p, payment_status: 'paid'} 
                                            : p
                                        );
                                        setPlayers(updatedPlayers);
                                        setSelectedPlayer({...selectedPlayer, payment_status: 'paid'});
                                      }
                                    }}
                                  >
                                    <View style={[
                                      styles.statusPill, 
                                      { 
                                        backgroundColor: getPaymentStatusColor('paid') + '20',
                                        marginRight: 10
                                      }
                                    ]}>
                                      <Text style={[
                                        styles.statusText, 
                                        { color: getPaymentStatusColor('paid') }
                                      ]}>
                                        Paid
                                      </Text>
                                    </View>
                                    {displayStatus === 'paid' && (
                                      <MaterialCommunityIcons 
                                        name="check" 
                                        size={20} 
                                        color={getPaymentStatusColor('paid')} 
                                      />
                                    )}
                                  </TouchableOpacity>
                                  
                                  {/* Unpaid option */}
                                  <TouchableOpacity 
                                    style={styles.dropdownItem}
                                    onPress={async () => {
                                      // Close dropdown
                                      setOpenDropdownMonth(null);
                                      
                                      // Map UI status to database-compatible status
                                      const dbStatus = getValidDatabaseStatus('unpaid');
                                      
                                      // Update UI first
                                      const updatedHistory = [...paymentHistory];
                                      const existingIndex = updatedHistory.findIndex(p => 
                                        p.year === year && p.month === month
                                      );
                                      
                                      if (existingIndex >= 0) {
                                        updatedHistory[existingIndex].status = 'pending'; // Use 'pending' for database storage
                                      } else {
                                        updatedHistory.push({
                                          year, month, status: 'pending' // Use 'pending' for database storage
                                        });
                                      }
                                      setPaymentHistory(updatedHistory);
                                      
                                      // Then update DB with mapped status
                                      await supabase
                                        .from('player_payments')
                                        .upsert([{
                                          player_id: selectedPlayer.player_id,
                                          year,
                                          month,
                                          status: dbStatus, // Use mapped status
                                        }], { onConflict: 'player_id,year,month' });
                                        
                                      // Update current player status if this is current month
                                      if (month === currentMonth) {
                                        const updatedPlayers = players.map(p => 
                                          p.player_id === selectedPlayer.player_id 
                                            ? {...p, payment_status: 'unpaid'} 
                                            : p
                                        );
                                        setPlayers(updatedPlayers);
                                        setSelectedPlayer({...selectedPlayer, payment_status: 'unpaid'});
                                      }
                                    }}
                                  >
                                    <View style={[
                                      styles.statusPill, 
                                      { 
                                        backgroundColor: getPaymentStatusColor('unpaid') + '20',
                                        marginRight: 10
                                      }
                                    ]}>
                                      <Text style={[
                                        styles.statusText, 
                                        { color: getPaymentStatusColor('unpaid') }
                                      ]}>
                                        Unpaid
                                      </Text>
                                    </View>
                                    {displayStatus === 'unpaid' && (
                                      <MaterialCommunityIcons 
                                        name="check" 
                                        size={20} 
                                        color={getPaymentStatusColor('unpaid')} 
                                      />
                                    )}
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              )}
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
                      <Text style={styles.playerDetailName}>{selectedPlayer.player_name}</Text>
                      <Text style={styles.teamDetailName}>{selectedPlayer.team_name}</Text>
                    </View>
                    
                    <View style={styles.detailsSection}>
                      <Text style={styles.modalSectionTitle}>Player Information</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Join Date:</Text>
                        <Text style={styles.detailValue}>
                          {selectedPlayer.created_at && selectedPlayer.created_at !== 'null' 
                            ? new Date(selectedPlayer.created_at).toLocaleDateString('en-GB') 
                            : 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Birthdate:</Text>
                        <Text style={styles.detailValue}>
                          {selectedPlayer.birth_date && selectedPlayer.birth_date !== 'null' 
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
                        <Text style={styles.detailValue}>{selectedPlayer.last_payment_date || 'N/A'}</Text>
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
                            {selectedPlayer.medical_visa_status}
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
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.primary,
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
    color: COLORS.text,
    fontSize: 16,
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
  },
  playersList: {
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100, // Extra padding at bottom
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyStateText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  teamOptionSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  teamOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  teamOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  paymentHistoryHeader: {
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
    color: '#00BDF2', // Turquoise color matching the reference design
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#F5FBFF',
    padding: SPACING.md,
    borderRadius: 8,
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginRight: 4,
  },
  yearText: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  dropdownContainer: {
    position: 'relative',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIcon: {
    marginLeft: SPACING.sm,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: SPACING.sm,
    elevation: 4,
    padding: SPACING.sm,
    zIndex: 1000,
    width: 150,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  statusChangeText: {
    fontSize: 16,
    fontWeight: 'normal',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'left',
    marginHorizontal: SPACING.lg,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 8,
    backgroundColor: undefined, // Only set in JSX
    borderWidth: 0,
    borderColor: undefined,
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: SPACING.md,
  },
  detailsContainer: {
    padding: SPACING.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
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
}); 