import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Platform, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Text, Card, ActivityIndicator, Button } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerEvent, forceRefresh } from '../../utils/events';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { RouteProp, useRoute } from '@react-navigation/native';
import { CoachTabParamList } from '../../navigation/CoachNavigator';
import { CoachCollectionsScreen } from './CoachCollectionsScreen';

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

interface PaymentCollection {
  id: string;
  player_id: string;
  coach_id: string;
  collected_date: string;
  is_processed: boolean;
  processed_date: string | null;
  notes: string | null;
  player_name?: string;
  team_name?: string;
}

export const CoachPaymentsScreen = () => {
  const route = useRoute<RouteProp<CoachTabParamList, 'Payments'>>();
  const [showCollections, setShowCollections] = useState(route.params?.showCollections === true);
  
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
    { value: 'trial_ended', label: 'Trial Ended' },
    { value: 'pending', label: 'Pending' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' },
  ]);
  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus);
  const [isStatusChangeModalVisible, setIsStatusChangeModalVisible] = useState(false);
  const [openDropdownMonth, setOpenDropdownMonth] = useState<string | null>(null);
  const [isMarkAsCollectedModalVisible, setIsMarkAsCollectedModalVisible] = useState(false);
  const [collectionNote, setCollectionNote] = useState('');
  const [collections, setCollections] = useState<PaymentCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // State for info text visibility
  const [showInfoText, setShowInfoText] = useState(false);

  useEffect(() => {
    fetchData();
    if (showCollections) {
      fetchCollections();
    }
  }, [showCollections]);

  // Use data refresh hook to refresh when payment status changes
  useDataRefresh('payments', () => {
    console.log("Payment status change detected in coach screen - refreshing payment data");
    fetchData();
  });

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

      console.log('Raw players data from RPC:', playersData?.map((p: { 
        player_id: string; 
        player_name: string; 
        last_payment_date: string | null; 
      }) => ({
        player_id: p.player_id,
        player_name: p.player_name,
        last_payment_date: p.last_payment_date
      })));

      // Also fetch player_status ENUM values directly from the database
      console.log('Player IDs to fetch:', playersData?.map((p: { player_id: string }) => p.player_id));
      
      // Get complete player data directly from the database
      const { data: playerStatusData, error: playerStatusError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          player_status,
          payment_status,
          last_payment_date
        `)
        .in('id', (playersData || []).map((p: any) => p.player_id))
        .eq('is_active', true);
      
      if (playerStatusError) {
        console.error('Error fetching player_status values:', playerStatusError);
      }

      console.log('Direct query SQL error:', playerStatusError);
      console.log('Direct query response:', playerStatusData);

      // Create a map for quick lookup of player data
      const playerDataMap = new Map();
      (playerStatusData || []).forEach((item: any) => {
        playerDataMap.set(item.id, {
          player_status: item.player_status,
          last_payment_date: item.last_payment_date
        });
        console.log(`Player ${item.id} data:`, {
          player_status: item.player_status,
          last_payment_date: item.last_payment_date
        });
      });

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
      
      // Enhance player data using data from the RPC and other sources
      const enhancedPlayersData = await Promise.all((playersData || []).map(async (player: any) => {
        // Get additional data from the direct query
        const playerData = playerDataMap.get(player.player_id);
        
        console.log('Processing player:', {
          player_id: player.player_id,
          player_name: player.player_name,
          rpc_last_payment_date: player.last_payment_date,
          direct_query_last_payment_date: playerData?.last_payment_date
        });
        
        // Format the last payment date properly - try both sources
        let formattedLastPaymentDate = 'No payment';
        const lastPaymentDate = player.last_payment_date || playerData?.last_payment_date;
        
        if (lastPaymentDate) {
          try {
            const date = new Date(lastPaymentDate);
            if (!isNaN(date.getTime())) { // Check if date is valid
              formattedLastPaymentDate = date.toLocaleDateString('en-GB');
              console.log('Formatted last payment date:', {
                original: lastPaymentDate,
                formatted: formattedLastPaymentDate,
                player_name: player.player_name
              });
            } else {
              console.error("Invalid date format:", lastPaymentDate);
              formattedLastPaymentDate = 'No payment';
            }
          } catch (e) {
            console.error("Error formatting last_payment_date:", e);
            formattedLastPaymentDate = 'No payment';
          }
        }

        // Determine payment status (prioritize stored UI status > playerStatusMap > RPC data)
        const dbPlayerStatus = playerData?.player_status || player.payment_status;

        // Try to get the stored UI payment status (for UI display)
        const playerStatusKey = `player_status_${player.player_id}`;
        let uiPaymentStatus = dbPlayerStatus;

        // If AsyncStorage has a value, it overrides other sources (for this particular session)
        try {
          const storedStatus = await AsyncStorage.getItem(playerStatusKey);
          if (storedStatus) {
            console.log(`Found stored UI status for player ${player.player_id}:`, storedStatus);
            uiPaymentStatus = storedStatus;
          }
        } catch (e) {
          console.error("Error reading stored payment status:", e);
        }

        console.log("Final payment status for player", player.player_name, ":", {
          raw_payment_status: player.payment_status, // Original from RPC
          db_player_status: dbPlayerStatus, // Status from database (playerStatusMap or RPC)
          ui_payment_status: uiPaymentStatus // Final status used in UI
        });

        return {
          ...player,
          id: player.player_id, // Use player_id as id for compatibility
          // Use team creation date as fallback if player has no creation date
          created_at: player.created_at || player.created_at,
          // Use birthdate from parent_children if available
          birth_date: parentChildrenData?.find(
            child => child.parent_id === player.parent_id && 
                    child.full_name.toLowerCase() === player.player_name.toLowerCase()
          )?.birth_date || player.birth_date,
          // Use our properly formatted last_payment_date
          last_payment_date: formattedLastPaymentDate,
          // Use the UI payment status for display
          payment_status: uiPaymentStatus,
          // Also include the raw player_status from database for reference
          player_status: dbPlayerStatus,
        };
      }));
      
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

  const fetchCollections = async () => {
    try {
      setCollectionsLoading(true);
      
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        Alert.alert('Error', 'Coach data not found. Please log in again.');
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      console.log('Fetching collections for coach ID:', coachData.id);
      
      // Fetch collections for this coach, with the correct field name structure
      const { data, error } = await supabase
        .from('payment_collections')
        .select(`
          id,
          player_id,
          coach_id,
          collected_date,
          is_processed,
          processed_date,
          notes
        `)
        .eq('coach_id', coachData.id)
        .order('collected_date', { ascending: false });
      
      if (error) {
        console.error('Error in initial collections fetch:', error);
        throw error;
      }
      
      console.log('Collections data fetched:', data?.length, 'records');
      
      if (!data || data.length === 0) {
        setCollections([]);
        setCollectionsLoading(false);
        return;
      }
      
      // Get player and team names
      const playerIds = data.map(collection => collection.player_id);
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`id, name, team_id, teams:team_id(id, name)`)
        .in('id', playerIds);
        
      if (playersError) {
        console.error('Error fetching players for collections:', playersError);
        throw playersError;
      }
      
      console.log('Players data fetched for collections:', playersData?.length, 'players');
      
      // Create a map for quick lookup
      const playerMap = new Map();
      playersData?.forEach(player => {
        // Safely extract team name
        let teamName = 'No Team';
        if (player.teams) {
          // Handle the case where teams could be an object or potentially an array
          const teamsObj = player.teams as any;
          if (teamsObj.name) { // Direct property
            teamName = teamsObj.name;
          } else if (Array.isArray(teamsObj) && teamsObj.length > 0 && teamsObj[0].name) {
            // If it's an array, take the first item's name
            teamName = teamsObj[0].name;
          }
        }
        
        playerMap.set(player.id, {
          name: player.name || 'Unknown Player',
          team_name: teamName
        });
      });
      
      // Combine data
      const enhancedCollections = data.map(collection => {
        const playerInfo = playerMap.get(collection.player_id);
        return {
          ...collection,
          player_name: playerInfo?.name || 'Unknown Player',
          team_name: playerInfo?.team_name || 'Unknown Team'
        };
      });
      
      console.log('Enhanced collections prepared:', enhancedCollections.length, 'collections');
      setCollections(enhancedCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      Alert.alert('Error', 'Failed to load collections data');
    } finally {
      setCollectionsLoading(false);
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
    
    // First get the latest player status directly from the database
    try {
      const { data, error } = await supabase
        .from('players')
        .select('payment_status, player_status, last_payment_date')
        .eq('id', player.id)
        .single();
        
      if (error) throw error;
      
      // Get the most appropriate status to display
      let displayStatus = player.payment_status; // Default to current status
      
      if (data.player_status) {
        // If player_status ENUM exists, prefer it
        displayStatus = data.player_status;
      } else if (data.payment_status) {
        // Otherwise fall back to payment_status
        displayStatus = getDisplayPaymentStatus(data.payment_status);
      }
      
      console.log("Most recent status for player details:", {
        id: player.id,
        original_status: player.payment_status,
        db_payment_status: data.payment_status,
        db_player_status: data.player_status,
        final_display_status: displayStatus,
        last_payment_date: data.last_payment_date
      });
      
      // Create updated player with the latest status
      const updatedPlayer = {
        ...player,
        payment_status: displayStatus,
        last_payment_date: data.last_payment_date ? new Date(data.last_payment_date).toLocaleDateString('en-GB') : player.last_payment_date
      };
      
      // Update the selected player with latest data
      setSelectedPlayer(updatedPlayer);
    } catch (error) {
      console.error("Error fetching latest player status:", error);
      // Continue with existing player data if fetch fails
    }
    
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
    
    // Make sure we're using the correct player ID field
    const playerId = player.id;
    console.log("Fetching payment history for player:", { 
      id: player.id, 
      player_id: player.player_id,
      using_id: playerId
    });
    
    // Fetch payment history data for the current year only
    try {
      const { data } = await supabase
        .from('player_payments')
        .select('year, month, status')
        .eq('player_id', playerId)
        .eq('year', currentYear); // Only get current year
      
      console.log("Fetched payment history:", data);
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

  // First, add a helper function to map database status values back to display values
  const getDisplayPaymentStatus = (dbStatus: string, uiStatus?: string): string => {
    console.log("Converting database status to UI status:", { dbStatus, uiStatus });
    
    // If we have the original UI status, prefer it
    if (uiStatus && uiStatus !== 'select_status') {
      return uiStatus;
    }
    
    // Map database status to UI status
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
      // Remove incorrect mappings that change payment statuses
      default:
        return dbStatus;
    }
  };

  // Add this helper function near the getDisplayPaymentStatus function
  const getValidDatabaseStatus = (status: string): string => {
    console.log("Converting UI status to database status for legacy column:", status);
    
    // This function now only used for backward compatibility with the old TEXT payment_status column
    // The player_status ENUM column will get the exact status value directly
    
    // Map UI status values to valid database values for the old column
    // Legacy column accepts: 'paid', 'pending', 'on_trial', 'trial_ended' but NOT 'unpaid'
    switch(status) {
      case 'paid':
        return 'paid';
      case 'unpaid': 
        return 'pending'; // Map 'unpaid' to 'pending' for database compatibility
      case 'pending':
        return 'pending';
      case 'on_trial':
        return 'on_trial';
      case 'trial_ended':
        return 'trial_ended';
      case 'select_status':
        return 'pending'; 
      default:
        console.log("Using default status 'pending' for unknown status:", status);
        return 'pending';
    }
  };

  // Handle player menu visibility
  const handlePlayerMenuPress = (playerId: string) => {
    console.log("Player menu press:", playerId, "current:", playerMenuVisible);
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  // Filter players based on search and team
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.player_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    const matchesStatus = !selectedStatus || player.payment_status === selectedStatus;
    return matchesSearch && matchesTeam && matchesStatus;
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
      // TEMPORARILY DISABLED: Coach payment status direct change 
      // Commented out for cash collection workflow implementation
      // case 'status':
      //   setIsStatusChangeModalVisible(true);
      //   break;
      case 'collected':
        // Only allow marking as collected for unpaid or pending players
        if (player.payment_status === 'unpaid' || player.payment_status === 'pending') {
          setCollectionNote('');
          setIsMarkAsCollectedModalVisible(true);
        } else {
          Alert.alert('Cannot Collect', 'Only unpaid or pending payments can be marked as collected.');
        }
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

  // Add this function near the handleChangePaymentStatus function
  const triggerPaymentStatusChange = (playerId: string, status: string, paymentDate: string | null) => {
    console.log("[CoachPaymentsScreen] Broadcasting payment status change", {
      playerId,
      status,
      paymentDate
    });
    
    // Trigger the event to notify other screens
    triggerEvent('payment_status_changed', playerId, status, paymentDate);
  };

  const handleChangePaymentStatus = async (newStatus: string) => {
    if (selectedPlayer) {
      try {
        // First update the player record (direct status)
        console.log("Updating payment status for player:", {
          id: selectedPlayer.id,
          player_id: selectedPlayer.player_id,
          current_status: selectedPlayer.payment_status,
          new_status: newStatus,
          is_same: selectedPlayer.id === selectedPlayer.player_id
        });
        
        // Update both fields - don't do any status conversion, use the exact payment status values
        const updateData: any = { 
          payment_status: newStatus,  // Use exact status, no mapping
          player_status: newStatus    // Use exact status, no mapping
        };
        
        // If status is paid, update the last_payment_date
        if (newStatus === 'paid') {
          const today = new Date().toISOString();
          updateData.last_payment_date = today;
          console.log("Setting last_payment_date to:", today);
        }
        
        // Log the update details
        console.log("Updating player with ID:", selectedPlayer.id);
        console.log("Update data:", updateData);
        
        // Update in database
        const { data: resultData, error: playerError } = await supabase
          .from('players')
          .update(updateData)
          .eq('id', selectedPlayer.id)
          .select();
        
        console.log("Update result:", { resultData, playerError });

        if (playerError) throw playerError;

        // Store the original UI status in local storage for this player
        // This helps us remember what the UI should show even if the database uses simplified statuses
        try {
          const playerStatusKey = `player_status_${selectedPlayer.id}`;
          await AsyncStorage.setItem(playerStatusKey, newStatus);
          console.log("Saved UI status to AsyncStorage:", { id: selectedPlayer.id, status: newStatus });
        } catch (e) {
          console.error("Failed to save UI status to AsyncStorage:", e);
        }

        // Then insert/update the payment history for current month if needed
        const currentYear = 2025;
        const currentMonth = new Date().getMonth() + 1;
        const dbStatus = getValidDatabaseStatus(newStatus);
        
        console.log("Upserting payment history with player_id:", selectedPlayer.id);
        console.log("Payment history data:", { 
          player_id: selectedPlayer.id, 
          year: currentYear,
          month: currentMonth,
          status: dbStatus 
        });
        
        const { error: historyError } = await supabase
          .from('player_payments')
          .upsert({
            player_id: selectedPlayer.id,
            year: currentYear,
            month: currentMonth,
            status: dbStatus
          }, {
            onConflict: 'player_id,year,month'
          });
          
        if (historyError) {
          console.error('Error updating payment history:', historyError);
        }

        // Also update the UI immediately
        const updatedPlayers = players.map(p => 
          p.id === selectedPlayer.id 
            ? {
                ...p, 
                payment_status: newStatus, // Keep the UI status
                last_payment_date: newStatus === 'paid' ? new Date().toLocaleDateString('en-GB') : p.last_payment_date
              } 
            : p
        );
        setPlayers(updatedPlayers);
        
        // Update the selectedPlayer state too
        setSelectedPlayer({
          ...selectedPlayer,
          payment_status: newStatus, // Keep the UI status
          last_payment_date: newStatus === 'paid' ? new Date().toLocaleDateString('en-GB') : selectedPlayer.last_payment_date
        });

        // Trigger event to notify other screens of the status change
        const paymentDate = newStatus === 'paid' ? new Date().toISOString() : null;
        triggerPaymentStatusChange(selectedPlayer.id, newStatus, paymentDate);

        // Always reload data from the database after update
        await fetchData();

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

  const handleMarkAsCollected = async () => {
    if (!selectedPlayer) return;

    try {
      // First get the coach's ID
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        Alert.alert('Error', 'Could not determine coach information. Please log in again.');
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      console.log('Using coach ID:', coachData.id);
      
      // Add debug logging
      console.log('Attempting to mark payment as collected:', {
        player_id: selectedPlayer.id,
        coach_id: coachData.id,
        notes: collectionNote || null
      });
      
      // Call the function to mark payment as collected
      const { data, error } = await supabase
        .rpc('mark_payment_as_collected', {
          p_player_id: selectedPlayer.id,
          p_coach_id: coachData.id,
          p_notes: collectionNote || null
        });
        
      // Add debug logging for the response
      console.log('Payment collection creation result:', { data, error });
      
      if (error) {
        console.error('Error marking payment as collected:', error);
        Alert.alert('Error', 'Failed to mark payment as collected. Please try again.');
        return;
      }
      
      console.log('Payment marked as collected, collection ID:', data);
      
      // Update the UI
      const updatedPlayers = players.map(p => 
        p.id === selectedPlayer.id 
          ? { ...p, cash_collected: true }
          : p
      );
      setPlayers(updatedPlayers);
      
      // Trigger event to notify other screens
      triggerEvent('payment_collection_added', selectedPlayer.id);
      
      // Refresh data
      await fetchData();
      
      setIsMarkAsCollectedModalVisible(false);
      Alert.alert('Success', `Payment for ${selectedPlayer.player_name} marked as collected.`);
    } catch (error) {
      console.error('Error in handleMarkAsCollected:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading || collectionsLoading) {
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
            <Text style={styles.statsValue}>{stats.unpaidPlayers}</Text>
          </View>
        </View>
        
        {/* Toggle between Payments and Collected */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleContainer}>
            <Button 
              mode="text" // Use text mode for the segmented control look
              onPress={() => setShowCollections(false)}
              style={[
                styles.toggleButton,
                !showCollections && styles.activeSegmentButton, // Active style
                showCollections && styles.inactiveSegmentButton, // Inactive style
                styles.leftSegmentButton, // Left button styling
              ]}
              contentStyle={styles.toggleButtonContent}
              labelStyle={!showCollections ? styles.activeSegmentText : styles.inactiveSegmentText}
            >
          Payments
            </Button>
            <Button
              mode="text" // Use text mode
              onPress={() => setShowCollections(true)}
              style={[
                styles.toggleButton,
                showCollections ? styles.activeSegmentButton : styles.inactiveSegmentButton, // Active/inactive styles
                styles.rightSegmentButton, // Right button styling
              ]}
              contentStyle={styles.toggleButtonContent}
              // Ensure no icon prop here
              labelStyle={showCollections ? styles.activeSegmentText : styles.inactiveSegmentText}
            >
              Collected
            </Button>
          </View>
          {/* Single Info icon outside tabs */}
          <TouchableOpacity onPress={() => setShowInfoText(!showInfoText)} style={styles.infoIconContainer}>
            <MaterialCommunityIcons 
              name="information-outline" 
              size={24} // Slightly larger icon
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
        
        {/* Conditionally render collections or payments content */}
        {showCollections ? (
          /* Collections View - Use the new component */
          <CoachCollectionsScreen 
            refreshing={false}
            onRefresh={async () => {
              setCollectionsLoading(true);
              await fetchCollections();
              setCollectionsLoading(false);
            }}
          />
        ) : (
          /* Payments View */
          <>
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
                              onPress={() => handlePlayerAction('collected', player)}
                            >
                              <MaterialCommunityIcons name="cash-register" size={20} color={COLORS.success} />
                              <Text style={styles.menuItemText}>Mark as Collected</Text>
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
          </>
        )}
        
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
        
        {/* Status Filter Modal */}
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
                    style={[styles.statusButton, { backgroundColor: '#9C27B0' + '20' }]}
                    onPress={() => handleChangePaymentStatus('trial_ended')}
                  >
                    <MaterialCommunityIcons name="timer-sand-complete" size={24} color={'#9C27B0'} />
                    <Text style={[styles.statusButtonText, { color: '#9C27B0' }]}>Trial Ended</Text>
                    {selectedPlayer.payment_status === 'trial_ended' && (
                      <MaterialCommunityIcons name="check" size={20} color={'#9C27B0'} style={{ marginLeft: 'auto' }} />
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
                          displayStatus = getDisplayPaymentStatus(payment.status, selectedPlayer.payment_status);
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
                            
                            {/* Status display (read-only) */}
                            <View style={styles.dropdownContainer}>
                              {displayStatus ? (
                                <View style={styles.statusContainer}>
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
                                </View>
                              ) : (
                                <View style={[styles.statusPill, { backgroundColor: COLORS.grey[200] }]}> 
                                  <Text style={[styles.statusText, { color: COLORS.grey[600] }]}>No data</Text>
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
                        <Text style={styles.detailValue}>
                          {selectedPlayer.last_payment_date || 'N/A'}
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

        {/* Mark As Collected Modal */}
        <Modal
          visible={isMarkAsCollectedModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsMarkAsCollectedModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mark Payment as Collected</Text>
                <TouchableOpacity 
                  onPress={() => setIsMarkAsCollectedModalVisible(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              {selectedPlayer && (
                <View>
                  <Text style={styles.statusChangeText}>
                    Record cash payment collected from {selectedPlayer.player_name}
                  </Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Notes (optional):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={collectionNote}
                      onChangeText={setCollectionNote}
                      placeholder="Enter any notes about this collection"
                      multiline
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: COLORS.success + '20' }]}
                    onPress={handleMarkAsCollected}
                  >
                    <MaterialCommunityIcons name="cash-register" size={24} color={COLORS.success} />
                    <Text style={[styles.statusButtonText, { color: COLORS.success }]}>Confirm Collection</Text>
                  </TouchableOpacity>
                  <Text style={styles.helpText}>
                    Note: This records that you collected the payment and will notify the admin. The payment status will be updated by admin after they receive the funds.
                  </Text>
                </View>
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
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: SPACING.sm,
  },
  textInput: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    borderRadius: 8,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.grey[600],
    marginTop: SPACING.sm,
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.white,
    marginTop: SPACING.sm,
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
    flex: 1, // Allow container to take available space
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
    backgroundColor: '#EEFBFF', // Light blue background when active
  },
  inactiveSegmentButton: {
    backgroundColor: COLORS.white, // White background when inactive
  },
  activeSegmentText: {
    color: COLORS.text, // Dark text when active
    fontWeight: 'bold', // Bold text when active
  },
  inactiveSegmentText: {
    color: COLORS.text, // Dark text when inactive
    fontWeight: 'normal', // Normal weight text when inactive
  },
  toggleButtonContent: {
    height: 40,
  },
  infoIconContainer: {
    marginLeft: SPACING.md,
    padding: SPACING.sm, // Add padding to make it easier to press
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