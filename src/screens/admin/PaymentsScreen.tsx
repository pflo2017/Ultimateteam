import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Platform, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Text, Card, ActivityIndicator, SegmentedButtons, Button } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { triggerEvent } from '../../utils/events';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { PaymentCollectionsScreen } from './PaymentCollectionsScreen';

interface Player {
  id: string;
  name: string;
  team_id: string;
  team: {
    name: string;
  };
  payment_status: 'select_status' | 'on_trial' | 'pending' | 'paid' | 'unpaid' | 'trial_ended';
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
  unpaidPlayers: number;
  onTrialPlayers: number;
  trialEndedPlayers: number;
  pendingPlayers: number;
  selectStatusPlayers: number;
}

interface PlayerPayment {
  year: number;
  month: number;
  status: 'select_status' | 'on_trial' | 'pending' | 'paid' | 'unpaid' | 'trial_ended';
}

interface HistoryMonth { year: number; month: number; date: Date; }

const PaymentsScreenComponent = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPlayers: 0,
    paidPlayers: 0,
    unpaidPlayers: 0,
    onTrialPlayers: 0,
    trialEndedPlayers: 0,
    pendingPlayers: 0,
    selectStatusPlayers: 0
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
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number>(2025);
  const [availableYears, setAvailableYears] = useState<number[]>([2025]);
  const [isUpdateMonthModalVisible, setIsUpdateMonthModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{year: number, month: number, date: Date} | null>(null);
  const [openDropdownMonth, setOpenDropdownMonth] = useState<string | null>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
    console.log('[AdminPaymentsScreen] Initial data fetch complete');
  }, []);

  // Use data refresh hook to refresh when payment status changes
  useDataRefresh('payments', () => {
    console.log("[AdminPaymentsScreen] Payment status change detected - refreshing payment data");
    fetchData();
  });

  // Also listen for player refresh events
  useDataRefresh('players', () => {
    console.log("[AdminPaymentsScreen] Player data change detected - refreshing payment data");
    fetchData();
  });

  // Listen for collection events
  useDataRefresh('payment_collection_added', () => {
    console.log("[AdminPaymentsScreen] Payment collection detected - refreshing data");
    fetchData();
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log("Admin payments screen - fetching fresh data");
      
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (teamsError) throw teamsError;
      
      // Fetch players with basic info - force fresh data with no caching
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          parent_id,
          is_active,
          payment_status,
          player_status,
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
        // Default for new players is 'select_status' unless specifically set
        let paymentStatus = player.payment_status || 'select_status';
        
        // Calculate player age (time since created)
        const createdAt = new Date(player.created_at);
        const now = new Date();
        const diff = now.getTime() - createdAt.getTime();
        const daysSinceCreated = diff / (24 * 60 * 60 * 1000);
        
        // Auto-status logic based on user requirements
        // 1. If no status is set and player is new, default to 'select_status'
        // 2. If player is on trial and 30 days have passed, switch to 'trial_ended'
        // 3. If player status is 'on_trial' and < 30 days, keep as 'on_trial'
        
        if (paymentStatus === 'on_trial' && daysSinceCreated >= 30) {
          paymentStatus = 'trial_ended';
        }
        
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
      const unpaidPlayers = transformedPlayers.filter(p => p.payment_status === 'unpaid').length;
      const onTrialPlayers = transformedPlayers.filter(p => p.payment_status === 'on_trial').length;
      const trialEndedPlayers = transformedPlayers.filter(p => p.payment_status === 'trial_ended').length;
      const pendingPlayers = transformedPlayers.filter(p => p.payment_status === 'pending').length;
      const selectStatusPlayers = transformedPlayers.filter(p => p.payment_status === 'select_status').length;

      setTeams(teamsData || []);
      setPlayers(transformedPlayers);
      setStats({
        totalPlayers,
        paidPlayers,
        unpaidPlayers,
        onTrialPlayers,
        trialEndedPlayers,
        pendingPlayers,
        selectStatusPlayers
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
    }
  };

  const handleChangePaymentStatus = async (status: string) => {
    if (!selectedPlayer) return;
    try {
      const today = new Date().toISOString();
      const updateData: any = { 
        payment_status: status,
        player_status: status // Update the ENUM field directly
      };
      
      // If status is paid, update the last_payment_date
      if (status === 'paid') {
        updateData.last_payment_date = today;
      }
      
      console.log("Admin changing payment status:", {
        playerId: selectedPlayer.id,
        newStatus: status,
        updateData
      });
      
      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', selectedPlayer.id);
        
      if (error) throw error;
      
      // Also update the payment history for the current month
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = 2025;
      const paymentRecordStatus = getValidPaymentHistoryStatus(status);
      const { error: historyError } = await supabase
        .from('player_payments')
        .upsert([
          {
            player_id: selectedPlayer.id,
            year: currentYear,
            month: currentMonth,
            status: paymentRecordStatus,
          }
        ], { onConflict: 'player_id,year,month' });
      if (historyError) {
        console.error('Error updating payment history:', historyError);
      }
      
      // Trigger event to notify other screens of the status change
      triggerEvent('payment_status_changed', selectedPlayer.id, status, 
        status === 'paid' ? today : null);
      console.log("Admin triggered payment_status_changed event", {
        playerId: selectedPlayer.id,
        status
      });
      
      // Always reload data from the database after update
      await fetchData();
      setIsStatusChangeModalVisible(false);
      Alert.alert('Success', `Payment status updated to ${status}.`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status.');
    }
  };

  const fetchPaymentHistory = async (player: any) => {
    setHistoryLoading(true);
    setHistoryPlayer(player);
    
    // Get current date info
    const currentDate = new Date();
    const currentYear = 2025; // Hardcode to 2025 as requested
    const currentMonth = currentDate.getMonth(); // 0-11
    
    // Create months only for past and current months in 2025
    const months = [];
    // Start from current month and go backwards (most recent first)
    for (let i = currentMonth; i >= 0; i--) {
      months.push({
        year: 2025,
        month: i + 1,
        date: new Date(2025, i, 1)
      });
    }
    
    setHistoryMonths(months);
    setAvailableYears([2025]); // Just 2025 for now
    
    // Fetch payment history data
    try {
      const { data } = await supabase
        .from('player_payments')
        .select('year, month, status')
        .eq('player_id', player.id)
        .eq('year', 2025);
      
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedHistoryYear(year);
  };

  // When opening payment history modal, call fetchPaymentHistory(selectedPlayer)
  useEffect(() => {
    if (isPaymentHistoryModalVisible && selectedPlayer) {
      fetchPaymentHistory(selectedPlayer);
    }
  }, [isPaymentHistoryModalVisible, selectedPlayer]);

  // When admin changes status for a month:
  const handleChangePaymentStatusForMonth = async (
    player: Player,
    year: number,
    month: number,
    newStatus: 'select_status' | 'on_trial' | 'pending' | 'paid' | 'unpaid' | 'trial_ended'
  ) => {
    // First update the payment history record
    await supabase
      .from('player_payments')
      .upsert([
        {
          player_id: player.id,
          year,
          month,
          status: getValidPaymentHistoryStatus(newStatus),
        }
      ], { onConflict: 'player_id,year,month' });
    
    // Get current date info
    const currentDate = new Date();
    const currentYear = 2025; // Hardcoded to 2025 as requested
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    // If this is the current month, also update the player's status
    if (year === currentYear && month === currentMonth) {
      // Create update data with all necessary status fields
      const updateData: any = { 
        payment_status: newStatus,
        player_status: newStatus,
      };
      
      // If paid, also update last payment date
      if (newStatus === 'paid') {
        updateData.last_payment_date = new Date().toISOString();
      }
      
      // Update the player record
      await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);
      
      // Trigger event to notify other screens that payment status has changed
      triggerEvent('payment_status_changed', player.id, newStatus, 
        newStatus === 'paid' ? new Date().toISOString() : null);
    }
    
    // Refresh payment history
    const { data } = await supabase
      .from('player_payments')
      .select('year, month, status')
      .eq('player_id', player.id)
      .eq('year', selectedHistoryYear);
    
    setPaymentHistory(data || []);
  };

  // Replace the activeTab-based filtering with selectedStatus-based filtering
  const getFilteredPlayers = () => {
    let filtered = [...players];
    
    // First apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (player.team && player.team.name && player.team.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Then apply team filter
    if (selectedTeamId) {
      filtered = filtered.filter(player => player.team_id === selectedTeamId);
    }
    
    // Then apply status filter
    if (selectedStatus) {
      filtered = filtered.filter(player => player.payment_status === selectedStatus);
    }
    
    return filtered;
  };

  // Helpers for UI
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLORS.success;
      case 'pending': return '#FFA500'; // Orange
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

  const selectedTeam = teams.find(team => team.id === selectedTeamId);
  const statusOptions = [
    { value: 'select_status', label: 'Select Status' },
    { value: 'on_trial', label: 'On Trial' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'trial_ended', label: 'Trial Ended' },
  ];
  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus);

  // Let's add a helper function to ensure status values match database constraints
  // And fix the issue with "unpaid" status in payment history updates

  // Add this helper function near the top of the component
  const getValidPaymentHistoryStatus = (status: string): string => {
    // Based on the error message, it seems only certain values are allowed
    // Let's map all our status values to ones we know work
    switch(status) {
      case 'paid':
        return 'paid';
      case 'unpaid':
        // Try the alternative format that might be expected by the database
        return 'pending'; // Use 'pending' instead of 'unpaid' which is causing issues
      case 'on_trial':
        return 'on_trial';
      case 'pending':
        return 'pending';
      case 'trial_ended':
        return 'on_trial'; // Map to a valid value
      case 'select_status':
        return 'on_trial'; // Map to a valid value
      default:
        return 'on_trial'; // Default to a safe value
    }
  };

  // First, add a helper function to map database status values back to display values
  const getDisplayPaymentStatus = (dbStatus: string): string => {
    // Map database status values back to display values
    switch(dbStatus) {
      // Payment status values
      case 'paid':
        return 'paid';
      case 'pending':
        return 'pending';
      case 'unpaid':
        return 'unpaid';
      case 'on_trial':
        return 'on_trial';
      case 'trial_ended':
        return 'trial_ended';
      default:
        return dbStatus;
    }
  };

  // Add handleRefresh function for the collections screen
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

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
          {/* Stats Cards */}
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
              <Text style={styles.statsValue}>{stats.unpaidPlayers}</Text>
            </View>
          </View>
          
          {/* Toggle between Payments and Collections */}
          <View style={styles.toggleContainer}>
            <Button 
              mode="text"
              onPress={() => setShowCollections(false)}
              style={[
                styles.toggleButton,
                !showCollections && styles.activeSegmentButton,
                showCollections && styles.inactiveSegmentButton,
                styles.leftSegmentButton,
              ]}
              contentStyle={styles.toggleButtonContent}
              labelStyle={!showCollections ? styles.activeSegmentText : styles.inactiveSegmentText}
            >
              Payments
            </Button>
            <Button
              mode="text"
              onPress={() => setShowCollections(true)}
              style={[
                styles.toggleButton,
                showCollections ? styles.activeSegmentButton : styles.inactiveSegmentButton,
                styles.rightSegmentButton,
              ]}
              contentStyle={styles.toggleButtonContent}
              labelStyle={showCollections ? styles.activeSegmentText : styles.inactiveSegmentText}
            >
              Collections
            </Button>
          </View>

          {/* Conditionally render collections or payments */}
          {showCollections ? (
            <PaymentCollectionsScreen 
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : (
            <View style={styles.contentContainer}>
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
                {getFilteredPlayers().length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No players match your filters</Text>
                  </View>
                ) : (
                  getFilteredPlayers().map(player => (
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
                                { 
                                  color: getPaymentStatusColor(player.payment_status),
                                  fontWeight: player.payment_status === 'select_status' ? 'bold' : '500' 
                                }
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
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          )}
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
              
              <TouchableOpacity
                style={[styles.teamOption, !selectedStatus && styles.teamOptionSelected]}
                onPress={() => handleStatusSelect(null)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.teamOptionText, !selectedStatus && styles.teamOptionTextSelected]}>All Status</Text>
                </View>
                {!selectedStatus && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              
              {statusOptions.filter(option => option.value !== 'select_status').map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.teamOption, selectedStatus === option.value && styles.teamOptionSelected]}
                  onPress={() => handleStatusSelect(option.value)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons 
                      name={
                        option.value === 'paid' ? 'check-circle' :
                        option.value === 'pending' ? 'clock' :
                        option.value === 'unpaid' ? 'alert-circle' :
                        option.value === 'on_trial' ? 'ticket-percent' :
                        option.value === 'trial_ended' ? 'ticket-confirmation' : 'cash'
                      } 
                      size={20} 
                      color={getPaymentStatusColor(option.value)} 
                      style={{ marginRight: 8 }} 
                    />
                    <Text style={[styles.teamOptionText, selectedStatus === option.value && styles.teamOptionTextSelected]}>
                      {option.label}
                    </Text>
                  </View>
                  {selectedStatus === option.value && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
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
                    <Text style={styles.sectionTitle}>Monthly Status</Text>
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
                        displayStatus = 'select_status';
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
                            
                            {/* Dropdown menu */}
                            {openDropdownMonth === monthKey && (
                              <View style={styles.dropdownMenu}>
                                {/* Paid option */}
                                <TouchableOpacity 
                                  style={styles.dropdownItem}
                                  onPress={() => {
                                    // Close dropdown
                                    setOpenDropdownMonth(null);
                                    
                                    // Update UI first
                                    const updatedHistory = [...paymentHistory];
                                    const existingIndex = updatedHistory.findIndex(p => 
                                      p.year === year && p.month === month
                                    );
                                    
                                    if (existingIndex >= 0) {
                                      updatedHistory[existingIndex].status = 'paid' as 'paid';
                                    } else {
                                      updatedHistory.push({
                                        year, month, status: 'paid' as 'paid'
                                      });
                                    }
                                    setPaymentHistory(updatedHistory);
                                    
                                    // Then update DB
                                    supabase
                                      .from('player_payments')
                                      .upsert([{
                                        player_id: selectedPlayer.id,
                                        year,
                                        month,
                                        status: 'paid',
                                      }], { onConflict: 'player_id,year,month' })
                                      .then(({ error }) => {
                                        if (error) {
                                          console.error('Error:', error);
                                        } else if (month === currentMonth) {
                                          handleChangePaymentStatus('paid');
                                        }
                                      });
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
                                  onPress={() => {
                                    // Close dropdown
                                    setOpenDropdownMonth(null);
                                    
                                    // Map to valid DB status
                                    const dbStatus = getValidPaymentHistoryStatus('unpaid');
                                    
                                    // Update UI first
                                    const updatedHistory = [...paymentHistory];
                                    const existingIndex = updatedHistory.findIndex(p => 
                                      p.year === year && p.month === month
                                    );
                                    
                                    if (existingIndex >= 0) {
                                      updatedHistory[existingIndex].status = dbStatus as any;
                                    } else {
                                      updatedHistory.push({
                                        year, month, status: dbStatus as any
                                      });
                                    }
                                    setPaymentHistory(updatedHistory);
                                    
                                    // Then update DB
                                    supabase
                                      .from('player_payments')
                                      .upsert([{
                                        player_id: selectedPlayer.id,
                                        year,
                                        month,
                                        status: dbStatus,
                                      }], { onConflict: 'player_id,year,month' })
                                      .then(({ error }) => {
                                        if (error) {
                                          console.error('Error:', error);
                                        } else if (month === currentMonth) {
                                          handleChangePaymentStatus('unpaid');
                                        }
                                      });
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
                    onPress={() => handleChangePaymentStatus('unpaid')}
                  >
                    <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.error} />
                    <Text style={[styles.statusButtonText, { color: COLORS.error }]}>Unpaid</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.primary + '20' }]}
                    onPress={() => handleChangePaymentStatus('on_trial')}
                  >
                    <MaterialCommunityIcons name="ticket-percent" size={24} color={COLORS.primary} />
                    <Text style={[styles.statusButtonText, { color: COLORS.primary }]}>On Trial</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.grey[800] + '20' }]}
                    onPress={() => handleChangePaymentStatus('trial_ended')}
                  >
                    <MaterialCommunityIcons name="ticket-confirmation" size={24} color={COLORS.grey[800]} />
                    <Text style={[styles.statusButtonText, { color: COLORS.grey[800] }]}>Trial Ended</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Custom Month Update Modal */}
        <Modal
          visible={isUpdateMonthModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsUpdateMonthModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '50%', width: '85%', borderRadius: 16 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { textAlign: 'center', width: '100%' }]}>
                  {selectedMonth ? `Update ${selectedMonth.date.toLocaleString('default', { month: 'long', year: 'numeric' })}` : 'Update Payment'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setIsUpdateMonthModalVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {selectedPlayer && selectedMonth && (
                <View style={{ padding: SPACING.lg }}>
                  <Text style={{ textAlign: 'center', fontSize: 16, marginBottom: SPACING.lg }}>
                    Set payment status for {selectedPlayer.name}
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.customButton, { backgroundColor: COLORS.success + '20', marginBottom: SPACING.md }]}
                    onPress={() => {
                      console.log('DEBUG: Paid button pressed', selectedMonth);
                      
                      // Map status to a valid value for player_payments table
                      const paymentRecordStatus = getValidPaymentHistoryStatus('paid');
                      
                      // Update the local state first for immediate feedback
                      const updatedHistory = [...paymentHistory];
                      const existingIndex = updatedHistory.findIndex(p => 
                        p.year === selectedMonth.year && p.month === selectedMonth.month
                      );
                      
                      if (existingIndex >= 0) {
                        updatedHistory[existingIndex].status = paymentRecordStatus as any;
                      } else {
                        updatedHistory.push({
                          year: selectedMonth.year,
                          month: selectedMonth.month,
                          status: paymentRecordStatus as any
                        });
                      }
                      
                      setPaymentHistory(updatedHistory);
                      
                      // Update the database
                      supabase
                        .from('player_payments')
                        .upsert([
                          {
                            player_id: selectedPlayer.id,
                            year: selectedMonth.year,
                            month: selectedMonth.month,
                            status: paymentRecordStatus,
                          }
                        ], { onConflict: 'player_id,year,month' })
                        .then(({error}) => {
                          if (error) {
                            console.error('Error updating payment history:', error);
                            Alert.alert('Error', 'Failed to update payment status.');
                          } else {
                            console.log('Payment status updated successfully');
                            
                            // If this is the current month, also update the player's status
                            const currentMonth = new Date().getMonth() + 1;
                            if (selectedMonth.month === currentMonth) {
                              handleChangePaymentStatus('paid');
                            }
                          }
                        });
                      
                      // Close the modal immediately for better UX
                      setIsUpdateMonthModalVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} style={{ marginRight: 10 }} />
                      <Text style={{ color: COLORS.success, fontSize: 18, fontWeight: '500' }}>Paid</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.customButton, { backgroundColor: COLORS.error + '20', marginBottom: SPACING.md }]}
                    onPress={() => {
                      console.log('DEBUG: Unpaid button pressed', selectedMonth);
                      
                      // Map status to a valid value for player_payments table
                      const paymentRecordStatus = getValidPaymentHistoryStatus('unpaid');
                      
                      // Update the local state first for immediate feedback
                      const updatedHistory = [...paymentHistory];
                      const existingIndex = updatedHistory.findIndex(p => 
                        p.year === selectedMonth.year && p.month === selectedMonth.month
                      );
                      
                      if (existingIndex >= 0) {
                        updatedHistory[existingIndex].status = paymentRecordStatus as any;
                      } else {
                        updatedHistory.push({
                          year: selectedMonth.year,
                          month: selectedMonth.month,
                          status: paymentRecordStatus as any
                        });
                      }
                      
                      setPaymentHistory(updatedHistory);
                      
                      // Update the database
                      supabase
                        .from('player_payments')
                        .upsert([
                          {
                            player_id: selectedPlayer.id,
                            year: selectedMonth.year,
                            month: selectedMonth.month,
                            status: paymentRecordStatus,
                          }
                        ], { onConflict: 'player_id,year,month' })
                        .then(({error}) => {
                          if (error) {
                            console.error('Error updating payment history:', error);
                            Alert.alert('Error', 'Failed to update payment status.');
                          } else {
                            console.log('Payment status updated successfully');
                            
                            // If this is the current month, also update the player's status
                            const currentMonth = new Date().getMonth() + 1;
                            if (selectedMonth.month === currentMonth) {
                              handleChangePaymentStatus('unpaid');
                            }
                          }
                        });
                      
                      // Close the modal immediately for better UX
                      setIsUpdateMonthModalVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} style={{ marginRight: 10 }} />
                      <Text style={{ color: COLORS.error, fontSize: 18, fontWeight: '500' }}>Unpaid</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.customButton, { backgroundColor: COLORS.grey[300], marginBottom: SPACING.md }]}
                    onPress={() => setIsUpdateMonthModalVisible(false)}
                  >
                    <Text style={{ color: COLORS.text, fontSize: 16 }}>Cancel</Text>
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
  debugButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  debugButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ddd',
    borderRadius: 4,
  },
  debugButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  customButton: {
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  monthYearContainer: {
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
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
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIcon: {
    marginLeft: 5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.xs,
    marginTop: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 100,
    width: 150,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
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
  closeMonthButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xs,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 0,
    backgroundColor: COLORS.white,
    borderRadius: 100,
    margin: SPACING.lg,
    elevation: 2,
    shadowColor: '#000000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.grey[300],
  },
  toggleButton: {
    flex: 1,
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  leftSegmentButton: {
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
  },
  rightSegmentButton: {
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
  },
  activeSegmentButton: {
    backgroundColor: '#EEFBFF',
  },
  inactiveSegmentButton: {
    backgroundColor: COLORS.white,
  },
  activeSegmentText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  inactiveSegmentText: {
    color: COLORS.text,
    fontWeight: 'normal',
  },
  toggleButtonContent: {
    height: 40,
  },
  contentContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 