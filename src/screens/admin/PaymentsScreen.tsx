import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Platform, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Text, Card, ActivityIndicator, SegmentedButtons, Button, Divider } from 'react-native-paper';
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

  // State for info text visibility
  const [showInfoText, setShowInfoText] = useState(false);

  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  // Add this to the PlayerCard component
  const [showManageOptions, setShowManageOptions] = useState<string | null>(null);

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
          ? (typeof player.last_payment_date === 'string' && player.last_payment_date.length > 10
            ? new Date(player.last_payment_date).toLocaleDateString('en-GB')
            : player.last_payment_date)
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
    // Prevent multiple simultaneous calls that could cause freezing
    if (!selectedPlayer || isUpdatingPayment) return;
    
    // Set flag to indicate update in progress
    setIsUpdatingPayment(true);
    
    try {
      const today = new Date().toISOString();
      
      // Update with consistent status value - no mapping needed
      const updateData: any = { 
        payment_status: status,    // Use status directly
        player_status: status,     // Use the same status value for both fields
        status_changed_by: 'admin' // This should now be accepted as TEXT type
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
      
      // Update player record
      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', selectedPlayer.id);
      
      if (error) {
        console.error("Error updating player:", error);
        throw error;
      }
      
      // Update May 2025 payment record
      try {
        const { error: paymentError } = await supabase
          .from('player_payments')
          .upsert({
            player_id: selectedPlayer.id,
            year: 2025,
            month: 5, // May 2025
            status: status as any,
            updated_at: today
          }, { onConflict: 'player_id,year,month' });
          
        if (paymentError) {
          console.error("Error updating payment history:", paymentError);
        } else {
          console.log("Successfully updated May 2025 payment record to:", status);
          
          // Update local payment history state
          const updatedPaymentHistory = [...paymentHistory];
          const mayRecordIndex = updatedPaymentHistory.findIndex(p => 
            p.year === 2025 && p.month === 5
          );
          
          if (mayRecordIndex >= 0) {
            updatedPaymentHistory[mayRecordIndex].status = status as any;
          } else {
            updatedPaymentHistory.push({
              year: 2025,
              month: 5,
              status: status as any
            });
          }
          
          setPaymentHistory(updatedPaymentHistory);
        }
      } catch (paymentError) {
        console.error("Error updating payment history:", paymentError);
        // Continue even if this fails - don't block the UI
      }
      
      // Trigger event to notify other screens
      try {
        triggerEvent('payment_status_changed', selectedPlayer.id, status, 
          status === 'paid' ? today : null);
      } catch (eventError) {
        console.error("Error triggering event:", eventError);
      }
      
      // Close modal before refreshing data to prevent UI freeze
      setIsStatusChangeModalVisible(false);
      
      // Update the selected player with the new status and properly formatted payment date
      const formattedDate = status === 'paid' ? new Date().toLocaleDateString('en-GB') : selectedPlayer.last_payment_date;
      
      setSelectedPlayer({
        ...selectedPlayer,
        payment_status: status as 'select_status' | 'on_trial' | 'pending' | 'paid' | 'unpaid' | 'trial_ended',
        last_payment_date: formattedDate
      });
      
      // Reload data with a slight delay to prevent UI freezing
      setTimeout(() => {
        fetchData().catch(err => console.error("Error refreshing data:", err));
      }, 300);
      
      // Show success message
      Alert.alert('Success', `Payment status updated to ${getPaymentStatusText(status)}.`);
        
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status. Please try again.');
    } finally {
      // Always reset the updating flag, even if there's an error
      setIsUpdatingPayment(false);
    }
  };

  // When opening payment history modal, call fetchPaymentHistory(selectedPlayer)
  useEffect(() => {
    if (isPaymentHistoryModalVisible && selectedPlayer) {
      // Only fetch once when the modal opens
      console.log("Payment history modal opened - fetching history once");
      fetchPaymentHistory(selectedPlayer);
    }
  }, [isPaymentHistoryModalVisible]);

  const fetchPaymentHistory = async (player: any) => {
    setHistoryLoading(true);
    setHistoryPlayer(player);
    
    console.log('Fetching payment history for player:', player.name, 'ID:', player.id);
    
    try {
      // First, get the latest player data to ensure we have the current status
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('payment_status, last_payment_date')
        .eq('id', player.id)
        .single();
        
      if (playerError) {
        console.error('Error fetching player data:', playerError);
      } else if (playerData) {
        console.log("Latest player status from database:", playerData.payment_status);
        
        // Format last payment date properly if it exists
        let formattedLastPayment = player.last_payment_date;
        if (playerData.last_payment_date) {
          try {
            const paymentDate = new Date(playerData.last_payment_date);
            formattedLastPayment = paymentDate.toLocaleDateString('en-GB');
          } catch (error) {
            console.error('Error formatting payment date:', error);
          }
        }
        
        // Update player with latest data and properly formatted date
        player.payment_status = playerData.payment_status;
        player.last_payment_date = formattedLastPayment;
        
        // Make sure selected player is updated too, without triggering another refresh
        setSelectedPlayer(prevPlayer => {
          if (prevPlayer && prevPlayer.id === player.id) {
            return {...prevPlayer, payment_status: playerData.payment_status, last_payment_date: formattedLastPayment};
          }
          return prevPlayer;
        });
      }
    
      // Create array of all months in 2025
      const months = [
        { year: 2025, month: 5, date: new Date(2025, 4, 1) }, // May
        { year: 2025, month: 4, date: new Date(2025, 3, 1) }, // April
        { year: 2025, month: 3, date: new Date(2025, 2, 1) }, // March
        { year: 2025, month: 2, date: new Date(2025, 1, 1) }, // February
        { year: 2025, month: 1, date: new Date(2025, 0, 1) }  // January
      ];
      
      setHistoryMonths(months);
      setAvailableYears([2025]); // Just 2025 for now
      
      // Fetch all payment history records for this player in 2025
      const { data, error } = await supabase
        .from('player_payments')
        .select('year, month, status')
        .eq('player_id', player.id)
        .eq('year', 2025);
      
      if (error) {
        console.error('Error fetching payment history:', error);
        throw error;
      }
      
      console.log('Payment history data received:', data);
      
      // Check if there's a mismatch between May's payment record and player's current status
      const mayRecord = data?.find(p => p.year === 2025 && p.month === 5);
      const playerStatus = playerData?.payment_status || player.payment_status;
      
      if (mayRecord && mayRecord.status !== playerStatus) {
        console.log(`MISMATCH DETECTED: May record status "${mayRecord.status}" doesn't match player status "${playerStatus}"`);
        
        // Force update the May record to match the player's current status
        try {
          console.log("Updating May payment record to match player's current status:", playerStatus);
          
          const { error: updateError } = await supabase
            .from('player_payments')
            .upsert({
              player_id: player.id,
              year: 2025,
              month: 5,
              status: playerStatus as any,
              updated_at: new Date().toISOString()
            }, { onConflict: 'player_id,year,month' });
            
          if (updateError) {
            console.error("Error fixing payment status mismatch:", updateError);
          } else {
            console.log("Successfully fixed payment status mismatch");
            
            // Update the local data with the correct status
            if (mayRecord) {
              mayRecord.status = playerStatus as any;
            } else {
              data?.push({
                year: 2025,
                month: 5,
                status: playerStatus as any
              });
            }
          }
        } catch (updateError) {
          console.error("Error fixing payment status mismatch:", updateError);
        }
      }
      
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error in fetchPaymentHistory:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedHistoryYear(year);
  };

  // When admin changes status for a month:
  const handleChangePaymentStatusForMonth = async (
    player: any,
    year: number,
    month: number,
    newStatus: 'paid' | 'pending' | 'unpaid' | 'on_trial' | 'trial_ended' | 'select_status'
  ) => {
    try {
      console.log(`Changing payment status for ${player.name} - ${month}/${year} to ${newStatus}`);
      
      // Update the player_payments record
      await supabase
        .from('player_payments')
        .upsert({
          player_id: player.id,
          year,
          month,
          status: newStatus, // Use status directly without any mapping
          updated_at: new Date().toISOString()
        });
      
      // If this is the current month/year, also update the player's status
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // 1-12 format
      const currentYear = 2025; // Hardcoded for now
      
      if (month === currentMonth && year === currentYear) {
        // Update with consistent status values - no mapping needed
        const updateData: any = { 
          payment_status: newStatus,    // Use status directly
          player_status: newStatus,     // Use the same status value for both fields
          status_changed_by: 'admin'    // Track who made the change
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
    } catch (error) {
      console.error('Error updating payment status for month:', error);
      Alert.alert('Error', 'Failed to update payment status. Please try again.');
    }
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

  // Helper function to ensure consistent payment status values
  const getValidPaymentHistoryStatus = (status: string): string => {
    // No mapping needed - return status as is
    return status;
  };

  // Helper function to display consistent payment status values
  const getDisplayPaymentStatus = (dbStatus: string): string => {
    // No mapping needed - return status as is
    return dbStatus;
  };

  // Add handleRefresh function for the collections screen
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Create a PlayerCard component for a cleaner design
  const PlayerCard = ({ player }: { player: Player }) => {
    // Format the birth date if it exists
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
    
    // Inline styles to avoid TypeScript errors
    const cardStyles = {
      playerCard: {
        marginBottom: SPACING.md,
        borderRadius: 12,
        backgroundColor: COLORS.white,
        elevation: 1,
      },
      header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: SPACING.sm,
      },
      nameContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      },
      icon: {
        marginRight: SPACING.sm,
      },
      playerName: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: COLORS.text,
      },
      teamName: {
        fontSize: 14,
        color: COLORS.grey[600],
      },
      ageContainer: {
        alignItems: 'flex-end' as const,
      },
      ageLabel: {
        fontSize: 12,
        color: COLORS.grey[600],
      },
      ageValue: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: COLORS.text,
      },
      divider: {
        height: 1,
        backgroundColor: COLORS.grey[200],
        marginVertical: SPACING.md,
      },
      infoRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: SPACING.md,
      },
      infoItem: {
        alignItems: 'center' as const,
      },
      infoLabel: {
        fontSize: 12,
        color: COLORS.grey[600],
        marginBottom: 4,
      },
      infoValue: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '500' as const,
      },
      statusBadge: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start' as const,
        minWidth: 70,
        alignItems: 'center' as const,
      },
      actionButtons: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        gap: SPACING.sm,
        marginTop: SPACING.md,
      },
      actionButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: 8,
        justifyContent: 'center' as const,
      },
      buttonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '500' as const,
        marginLeft: 4,
      },
      statusText: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: COLORS.text
      }
    };
    
  return (
      <Card 
        key={player.id} 
        style={cardStyles.playerCard}
        mode="outlined"
      >
        <Card.Content>
          <View style={cardStyles.header}>
            <View style={cardStyles.nameContainer}>
              <MaterialCommunityIcons 
                name="account" 
                size={28} 
                color={COLORS.primary} 
                style={cardStyles.icon}
              />
              <View>
                <Text style={cardStyles.playerName}>{player.name}</Text>
                <Text style={cardStyles.teamName}>{player.team.name}</Text>
              </View>
            </View>

            <View style={cardStyles.ageContainer}>
              <Text style={cardStyles.ageLabel}>Birth Date</Text>
              <Text style={cardStyles.ageValue}>
                {player.birth_date ? formattedBirthDate : 'Not available'}
              </Text>
            </View>
          </View>
          
          <Divider style={cardStyles.divider} />
          
          <View style={cardStyles.infoRow}>
            <View style={cardStyles.infoItem}>
              <Text style={cardStyles.infoLabel}>Last Payment</Text>
              <Text style={cardStyles.infoValue}>{player.last_payment_date}</Text>
            </View>

            <View style={cardStyles.infoItem}>
              <Text style={cardStyles.infoLabel}>Payment Status</Text>
              <View style={[
                cardStyles.statusBadge, 
                { backgroundColor: getPaymentStatusColor(player.payment_status) + '20' }
              ]}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: getPaymentStatusColor(player.payment_status)
                }}>
                  {getPaymentStatusText(player.payment_status)}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={cardStyles.actionButtons}>
            <TouchableOpacity 
              style={cardStyles.actionButton}
              onPress={() => handlePlayerAction('history', player)}
            >
              <MaterialCommunityIcons 
                name="history" 
                size={16} 
                color={COLORS.white} 
              />
              <Text style={cardStyles.buttonText}>History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={cardStyles.actionButton}
              onPress={() => setShowManageOptions(player.id)}
            >
              <MaterialCommunityIcons 
                name="cog" 
                size={16} 
                color={COLORS.white} 
              />
              <Text style={cardStyles.buttonText}>Manage</Text>
            </TouchableOpacity>
          </View>
          
          {/* Manage Options Modal */}
          {showManageOptions === player.id && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999,
              }}
              activeOpacity={1}
              onPress={() => setShowManageOptions(null)}
            >
              <View 
                style={{
                  backgroundColor: COLORS.white,
                  borderRadius: 12,
                  padding: SPACING.md,
                  width: '80%',
                  maxWidth: 300,
                  elevation: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                }}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: SPACING.md,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.grey[200],
                  }}
                  onPress={() => {
                    setShowManageOptions(null);
                    handlePlayerAction('status', player);
                  }}
                >
                  <MaterialCommunityIcons 
                    name="cash" 
                    size={24} 
                    color="#00BCD4" 
                    style={{ marginRight: 16 }}
                  />
                  <Text style={{ color: COLORS.text, fontSize: 16 }}>Change Status</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: SPACING.md,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.grey[200],
                  }}
                  onPress={() => {
                    setShowManageOptions(null);
                    handlePlayerAction('reminder', player);
                  }}
                >
                  <MaterialCommunityIcons 
                    name="bell" 
                    size={24} 
                    color="#00BCD4" 
                    style={{ marginRight: 16 }}
                  />
                  <Text style={{ color: COLORS.text, fontSize: 16 }}>Send Reminder</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: SPACING.md,
                  }}
                  onPress={() => {
                    setShowManageOptions(null);
                    handlePlayerAction('details', player);
                  }}
                >
                  <MaterialCommunityIcons 
                    name="account-details" 
                    size={24} 
                    color="#00BCD4" 
                    style={{ marginRight: 16 }}
                  />
                  <Text style={{ color: COLORS.text, fontSize: 16 }}>View Details</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
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
          
          {/* Toggle between Payments and Collected */}
          <View style={styles.toggleRow}>
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
                Collected
              </Button>
            </View>
            {/* Single Info icon outside tabs */}
            <TouchableOpacity onPress={() => setShowInfoText(!showInfoText)} style={styles.infoIconContainer}>
              <MaterialCommunityIcons 
                name="information-outline" 
                size={24}
                color={COLORS.grey[600]} 
              />
            </TouchableOpacity>
          </View>

           {/* Info Text Label */}
          {showInfoText && (
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTextTitle}>Information:</Text>
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>Payments View:</Text> General view of current payment statuses for all players
              </Text>
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>Collected View:</Text> Coach-collected payments waiting for admin action
              </Text>
            </View>
          )}

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
                    <PlayerCard key={player.id} player={player} />
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
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: getPaymentStatusColor(selectedPlayer.payment_status)
                          }}>
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
                    
                    <View style={{ 
                      width: '100%', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginTop: SPACING.md 
                    }}>
                      <View style={{
                        paddingHorizontal: SPACING.md,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: getPaymentStatusColor(selectedPlayer.payment_status) + '20',
                      }}>
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: getPaymentStatusColor(selectedPlayer.payment_status)
                        }}>
                          {getPaymentStatusText(selectedPlayer.payment_status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={[styles.detailsSection, { marginTop: SPACING.lg }]}>
                    <Text style={{ 
                      fontSize: 18, 
                      color: '#00BCD4', 
                      fontWeight: '600',
                      marginBottom: SPACING.md 
                    }}>
                      Monthly Status
                    </Text>
                    
                    {historyMonths.map(({ year, month, date }) => {
                      // Get payment record for this month/year if it exists
                      const payment = paymentHistory.find(p => 
                        p.year === year && p.month === month
                      );
                      
                      // Get current month
                      const currentDate = new Date();
                      const currentMonth = currentDate.getMonth() + 1; // 1-12 format
                      
                      // Determine status to display
                      let displayStatus;
                      
                      if (month === 5) {
                        // For May (current month), ALWAYS use player's current status, regardless of payment history
                        displayStatus = selectedPlayer.payment_status;
                      } else if (payment) {
                        // For other months with payment records, use the record
                        displayStatus = payment.status;
                      } else {
                        // For months with no record - show No data
                        displayStatus = null;
                      }
                      
                      // Format month name
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const monthName = monthNames[month - 1];
                      
                      return (
                        <View 
                          key={`${year}-${month}`}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#F5F9FF',
                            padding: SPACING.md,
                            borderRadius: 8,
                            marginBottom: SPACING.sm
                          }}
                        >
                          {/* Month and year */}
                          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={{ 
                              fontSize: 18, 
                              fontWeight: 'bold', 
                              color: COLORS.text 
                            }}>
                              {monthName}
                            </Text>
                            <Text style={{ 
                              fontSize: 16, 
                              color: COLORS.grey[500], 
                              marginLeft: 8 
                            }}>
                              {year}
                            </Text>
                          </View>
                          
                          {/* Status display */}
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {displayStatus === null ? (
                              <View style={{
                                paddingHorizontal: SPACING.md,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: COLORS.grey[200]
                              }}>
                                <Text style={{ color: COLORS.grey[600] }}>
                                  No data
                                </Text>
                              </View>
                            ) : (
                              <View style={{
                                paddingHorizontal: SPACING.md,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: getPaymentStatusColor(displayStatus) + '20'
                              }}>
                                <Text style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: getPaymentStatusColor(displayStatus)
                                }}>
                                  {getPaymentStatusText(displayStatus)}
                                </Text>
                              </View>
                            )}
                            
                            <TouchableOpacity
                              onPress={() => {
                                setOpenDropdownMonth(openDropdownMonth === `${year}-${month}` ? null : `${year}-${month}`);
                              }}
                            >
                              <MaterialCommunityIcons 
                                name="chevron-down" 
                                size={24} 
                                color={COLORS.grey[600]} 
                                style={{ marginLeft: 8 }}
                              />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Dropdown menu */}
                          {openDropdownMonth === `${year}-${month}` && (
                            <View style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              backgroundColor: COLORS.white,
                              borderRadius: 8,
                              padding: SPACING.sm,
                              marginTop: 5,
                              elevation: 5,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.1,
                              shadowRadius: 2,
                              zIndex: 100,
                              width: 150,
                            }}>
                              {/* Paid option */}
                              <TouchableOpacity 
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingVertical: SPACING.sm,
                                  paddingHorizontal: SPACING.xs,
                                }}
                                onPress={() => {
                                  // Close dropdown
                                  setOpenDropdownMonth(null);
                                  
                                  // Update UI first for immediate feedback
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
                                      } else {
                                        // If this is May (current month), also update player status
                                        if (month === 5) {
                                          handleChangePaymentStatus('paid');
                                        } else {
                                          // Just refresh the history
                                          fetchPaymentHistory(selectedPlayer);
                                        }
                                      }
                                    });
                                }}
                              >
                                <View style={{
                                  backgroundColor: getPaymentStatusColor('paid') + '20',
                                  paddingHorizontal: SPACING.sm,
                                  paddingVertical: 4,
                                  borderRadius: 12,
                                  marginRight: 10
                                }}>
                                  <Text style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: getPaymentStatusColor('paid')
                                  }}>
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
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingVertical: SPACING.sm,
                                  paddingHorizontal: SPACING.xs,
                                }}
                                onPress={() => {
                                  // Close dropdown
                                  setOpenDropdownMonth(null);
                                  
                                  // Update UI first for immediate feedback
                                  const updatedHistory = [...paymentHistory];
                                  const existingIndex = updatedHistory.findIndex(p => 
                                    p.year === year && p.month === month
                                  );
                                  
                                  if (existingIndex >= 0) {
                                    updatedHistory[existingIndex].status = 'unpaid';
                                  } else {
                                    updatedHistory.push({
                                      year, month, status: 'unpaid'
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
                                      status: 'unpaid',
                                    }], { onConflict: 'player_id,year,month' })
                                    .then(({ error }) => {
                                      if (error) {
                                        console.error('Error:', error);
                                      } else {
                                        // If this is May (current month), also update player status
                                        if (month === 5) {
                                          handleChangePaymentStatus('unpaid');
                                        } else {
                                          // Just refresh the history
                                          fetchPaymentHistory(selectedPlayer);
                                        }
                                      }
                                    });
                                }}
                              >
                                <View style={{
                                  backgroundColor: getPaymentStatusColor('unpaid') + '20',
                                  paddingHorizontal: SPACING.sm,
                                  paddingVertical: 4,
                                  borderRadius: 12,
                                  marginRight: 10
                                }}>
                                  <Text style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: getPaymentStatusColor('unpaid')
                                  }}>
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

                              {/* On Trial option */}
                              <TouchableOpacity 
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingVertical: SPACING.sm,
                                  paddingHorizontal: SPACING.xs,
                                }}
                                onPress={() => {
                                  // Close dropdown
                                  setOpenDropdownMonth(null);
                                  
                                  // Update UI first for immediate feedback
                                  const updatedHistory = [...paymentHistory];
                                  const existingIndex = updatedHistory.findIndex(p => 
                                    p.year === year && p.month === month
                                  );
                                  
                                  if (existingIndex >= 0) {
                                    updatedHistory[existingIndex].status = 'on_trial';
                                  } else {
                                    updatedHistory.push({
                                      year, month, status: 'on_trial'
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
                                      status: 'on_trial',
                                    }], { onConflict: 'player_id,year,month' })
                                    .then(({ error }) => {
                                      if (error) {
                                        console.error('Error:', error);
                                      } else {
                                        // If this is May (current month), also update player status
                                        if (month === 5) {
                                          handleChangePaymentStatus('on_trial');
                                        } else {
                                          // Just refresh the history
                                          fetchPaymentHistory(selectedPlayer);
                                        }
                                      }
                                    });
                                }}
                              >
                                <View style={{
                                  backgroundColor: getPaymentStatusColor('on_trial') + '20',
                                  paddingHorizontal: SPACING.sm,
                                  paddingVertical: 4,
                                  borderRadius: 12,
                                  marginRight: 10
                                }}>
                                  <Text style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: getPaymentStatusColor('on_trial')
                                  }}>
                                    On Trial
                                  </Text>
                                </View>
                                {displayStatus === 'on_trial' && (
                                  <MaterialCommunityIcons 
                                    name="check" 
                                    size={20} 
                                    color={getPaymentStatusColor('on_trial')} 
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
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
    borderRadius: 12,
    backgroundColor: COLORS.white,
    elevation: 1,
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
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  teamName: {
    fontSize: 14,
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
    fontSize: 12,
    color: COLORS.grey[600],
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  ageContainer: {
    alignItems: 'flex-end',
  },
  ageLabel: {
    fontSize: 12,
    color: COLORS.grey[600],
  },
  ageValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
    padding: 0,
    backgroundColor: COLORS.white,
    borderRadius: 100,
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
  infoIconContainer: {
    marginLeft: SPACING.md,
    padding: SPACING.sm,
  },
  infoTextContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  infoTextTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: SPACING.xs,
  },
}); 