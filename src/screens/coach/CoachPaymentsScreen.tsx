import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert, 
  Platform, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Dimensions, 
  ActivityIndicator,
  Text,
  Button
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerEvent } from '../../utils/events';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { RouteProp, useRoute } from '@react-navigation/native';
import { CoachTabParamList } from '../../navigation/CoachNavigator';
import { getPaymentStatusText, getPaymentStatusColor, updatePlayerPaymentStatus } from '../../services/paymentStatusService';
import { RadioButton } from 'react-native-paper';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  name?: string;
  team_id: string;
  team_name: string;
  payment_status: string;
  attendance?: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
  };
  parent_id?: string;
  last_payment_date?: string;
  payment_updated_at?: string | null; // When the payment status was last updated
  payment_updated_by?: string | null; // Who updated the payment status
  payment_updated_by_name?: string | null; // Name of the person who updated the payment status
  payment_method?: string; // Optional payment method
}

interface Team {
  id: string;
  name: string;
}

interface PaymentStats {
  totalPlayers: number;
  paidPlayers: number;
  unpaidPlayers: number;
}

interface MonthlyPayment {
  player_id: string;
  year: number;
  month: number;
  status: string;
  payment_method?: string; // Optional payment method
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
  
  // Add ref for the horizontal month ScrollView
  const monthScrollViewRef = useRef<ScrollView>(null);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPlayers: 0,
    paidPlayers: 0,
    unpaidPlayers: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [isPaymentHistoryModalVisible, setIsPaymentHistoryModalVisible] = useState(false);
  const [parentDetails, setParentDetails] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<MonthlyPayment[]>([]);
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
    { value: 'unpaid', label: 'Not Paid' },
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
  
  // Add state for monthly selector
  const [months, setMonths] = useState<{name: string, value: number, year: number}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<{name: string, value: number, year: number} | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [attendanceData, setAttendanceData] = useState<{[playerId: string]: {present: number, absent: number, total: number, percentage: number}}>({});

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null); // Track expanded card

  // 1. Add state for monthStatusMap
  const [monthStatusMap, setMonthStatusMap] = useState<{ [key: string]: 'all_paid' | 'not_all_paid' | undefined }>({});

  // Add state for modal
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);

  // Add state for payment method modal
  const [isPaymentMethodModalVisible, setIsPaymentMethodModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [pendingPaymentPlayer, setPendingPaymentPlayer] = useState<Player | null>(null);

  // Payment method options
  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'voucher_cash', label: 'Voucher & cash' },
    { value: 'bank_transfer', label: 'Bank transfer' },
  ];

  useEffect(() => {
    console.log("[DEBUG] Initial useEffect - Starting data fetch");
    fetchData();
    if (showCollections) {
      console.log("[DEBUG] Initial useEffect - Fetching collections");
      fetchCollections();
    }
    
    // Initialize months array for the selector
    console.log("[DEBUG] Initial useEffect - Initializing months");
    initializeMonths();
    
    console.log("[DEBUG] Initial useEffect - Selected team ID:", selectedTeamId === null ? "All Teams" : selectedTeamId);
  }, [showCollections]);

  // Add a new useEffect to handle initial payment data loading
  useEffect(() => {
    if (selectedMonth && selectedTeamId === null) {
      console.log("[DEBUG] Initial payment data loading - Fetching all teams data for", selectedMonth.name, selectedMonth.year);
      fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
    }
  }, [selectedMonth, selectedTeamId]);

  // Add an enhanced useEffect for centering the month selector
  useEffect(() => {
    // This ensures the month is properly centered after everything is loaded
    if (months.length > 0 && currentMonthIndex > 0) {
      // Sequence of timers to ensure the month is centered at all times
      const timer1 = setTimeout(() => {
        scrollToMonth(currentMonthIndex);
      }, 100);
      
      const timer2 = setTimeout(() => {
        scrollToMonth(currentMonthIndex);
      }, 500);
      
      const timer3 = setTimeout(() => {
        scrollToMonth(currentMonthIndex);
      }, 1000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [months, currentMonthIndex]);

  // Use data refresh hook to refresh when payment status changes
  useDataRefresh('payments', () => {
    console.log("Payment status change detected in coach screen - refreshing payment data");
    fetchData();
  });

  // Use data refresh hook to refresh when attendance data changes
  useDataRefresh('attendance', () => {
    console.log("Attendance data change detected - refreshing attendance data");
    if (selectedMonth) {
      if (selectedTeamId) {
        // If a specific team is selected
        fetchMonthlyPaymentsForTeam(selectedMonth.year, selectedMonth.value, selectedTeamId);
      } else {
        // If "All Teams" is selected
        fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
      }
    }
  });

  // Hide toast after 3 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Initialize months for the selector
  const initializeMonths = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    console.log(`Initializing months. Current month: ${currentMonth + 1}, year: ${currentYear}`);
    
    // Create an array of all months for the current year
    const monthsArray = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Add all months
    for (let i = 0; i < 12; i++) {
      monthsArray.push({
        name: monthNames[i],
        value: i + 1, // 1-based month value
        year: currentYear
      });
    }
    
    // Current month index
    const currentMonthIdx = currentMonth;
    
    console.log(`Setting months array with ${monthsArray.length} months. Current month index: ${currentMonthIdx}`);
    console.log(`Current month: ${monthsArray[currentMonthIdx].name} ${monthsArray[currentMonthIdx].year}`);
    
    setMonths(monthsArray);
    setSelectedMonth(monthsArray[currentMonthIdx]);
    setCurrentMonthIndex(currentMonthIdx);
  };
  
  // Function to scroll to a specific month by index
  const scrollToMonth = (index: number) => {
    if (monthScrollViewRef.current) {
      // Calculate the position to scroll to
      const itemWidth = 80; // Width of each month item including margins
      const screenWidth = Dimensions.get('window').width;
      
      // Account for container padding and margins
      const containerPadding = SPACING.lg * 2; // Left and right padding
      const itemMargin = 8; // Horizontal margin between items (4px on each side)
      const availableWidth = screenWidth - containerPadding;
      
      // Calculate the position to perfectly center the selected month
      // This formula ensures the selected month is centered in the available space
      const scrollPosition = Math.max(0, (index * (itemWidth + itemMargin)) - (availableWidth / 2) + (itemWidth / 2));
      
      console.log(`[DEBUG] Scrolling to month index ${index}`, {
        position: scrollPosition,
        screenWidth,
        availableWidth,
        itemWidth,
        itemMargin,
        containerPadding
      });
      
      // Use requestAnimationFrame to ensure smooth scrolling after layout
      requestAnimationFrame(() => {
        monthScrollViewRef.current?.scrollTo({ 
          x: scrollPosition, 
          animated: true 
        });
      });
    }
  };
  
  // Add a useEffect to handle initial screen focus and centering
  useEffect(() => {
    const centerCurrentMonth = () => {
      if (months.length > 0 && currentMonthIndex >= 0) {
        // Use a sequence of timeouts to ensure reliable centering
        const timers = [100, 300, 600, 1000].map(delay => 
          setTimeout(() => {
            console.log(`[DEBUG] Centering month at ${delay}ms delay`);
            scrollToMonth(currentMonthIndex);
          }, delay)
        );
        
        return () => timers.forEach(clearTimeout);
      }
    };

    // Center on mount and when months/currentMonthIndex changes
    centerCurrentMonth();
  }, [months, currentMonthIndex]);

  // Handler for selecting a month
  const handleMonthSelect = (month: {name: string, value: number, year: number}, index: number) => {
    console.log(`Month selected: ${month.name}, index: ${index}`);
    setSelectedMonth(month);
    setCurrentMonthIndex(index);
    
    // Scroll to center the selected month with a slight delay to ensure state is updated
    setTimeout(() => {
      scrollToMonth(index);
    }, 50);
    
    // Fetch data for the selected month
    if (selectedTeamId) {
      fetchMonthlyPaymentsForTeam(month.year, month.value, selectedTeamId);
    } else {
      // If no specific team is selected, fetch data for all teams
      fetchAllTeamsPayments(month.year, month.value);
    }
  };

  // Main data fetching function
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
      console.log("Fetching data for coach ID:", coachData.id);
      
      // Fetch teams assigned to this coach
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });
      
      if (teamsError) {
        console.error("Error fetching teams:", teamsError);
        throw teamsError;
      }
      
      console.log(`Found ${teamsData?.length || 0} teams for coach`);
      
      // Transform teams data
      const transformedTeams = (teamsData || []).map((team: any) => ({
        id: team.team_id,
        name: team.team_name
      }));
      
      setTeams(transformedTeams);
      
      // If no team is selected and we have teams, we'll default to "All Teams" view
      // but we'll preserve the existing teamId if it's already set
      if (selectedTeamId === null && transformedTeams.length > 0) {
        console.log("No team explicitly selected, using 'All Teams' view");
        // We keep selectedTeamId as null to indicate "All Teams"
      }
      
      // Fetch monthly payments based on team selection
      if (selectedMonth) {
        if (selectedTeamId) {
          // Fetch for specific team
          console.log(`Fetching monthly payments for team ${selectedTeamId}`);
          await fetchMonthlyPaymentsForTeam(selectedMonth.year, selectedMonth.value, selectedTeamId);
        } else {
          // Fetch for all teams
          console.log(`Fetching monthly payments for all teams`);
          await fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
        }
      } else {
        console.log("Could not fetch monthly payments: missing month", {
          selectedMonth
        });
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // New function to fetch monthly payments with explicit team ID
  const fetchMonthlyPaymentsForTeam = async (year: number, month: number, teamId: string) => {
    try {
      setIsLoading(true);
      console.log(`Fetching monthly payments for year: ${year}, month: ${month}, explicit team: ${teamId}`);
      
      // Get coach data
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        console.log("No coach data found");
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      
      // Fetch players for the specified team
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          teams:team_id(name)
        `)
        .eq('team_id', teamId)
        .eq('is_active', true);
      
      if (playersError) {
        console.error("Error fetching players:", playersError);
        throw playersError;
      }
      
      console.log(`Found ${playersData?.length || 0} players for explicit team ${teamId}`);
      
      if (!playersData || playersData.length === 0) {
        console.log("No players found for this team");
        setPlayers([]);
        setStats({
          totalPlayers: 0,
          paidPlayers: 0,
          unpaidPlayers: 0
        });
        return;
      }
      
      // Get current date info for comparing months
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // 1-based month
      const currentYear = currentDate.getFullYear();
      const isFutureMonth = (year > currentYear) || (year === currentYear && month > currentMonth);
      
      console.log(`Current date: ${currentMonth}/${currentYear}, Selected: ${month}/${year}, isFutureMonth: ${isFutureMonth}`);
      
      // For future months, set all players to 'unpaid' without querying the database
      if (isFutureMonth) {
        console.log("Future month selected - setting all players to unpaid by default");
        const transformedPlayers = playersData.map((player: any) => ({
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: 'unpaid',
          payment_updated_at: null,
          payment_updated_by: null,
          payment_updated_by_name: null
        }));
        
        setPlayers(transformedPlayers);
        
        // All unpaid for future months
        setStats({
          totalPlayers: transformedPlayers.length,
          paidPlayers: 0,
          unpaidPlayers: transformedPlayers.length
        });
        
        // Build statusMap for future months (all unpaid)
        const statusMap: { [key: string]: { paid: number; total: number } } = {};
        playersData.forEach((player: any) => {
          for (let m = 1; m <= 12; m++) {
            const key = `${year}-${m}`;
            if (!statusMap[key]) statusMap[key] = { paid: 0, total: 0 };
            statusMap[key].total++;
          }
        });
        
        // Build monthStatusMap for future months (all not_all_paid)
        const newMonthStatusMap: { [key: string]: 'all_paid' | 'not_all_paid' } = {};
        Object.entries(statusMap).forEach(([key, val]) => {
          if (val.total > 0) {
            newMonthStatusMap[key] = 'not_all_paid';
          }
        });
        setMonthStatusMap(newMonthStatusMap);
        
        // Now fetch attendance data for these players
        await fetchAttendanceDataForTeam(year, month, teamId, transformedPlayers);
        setIsLoading(false);
        return;
      }
      
      // For current or past months, fetch actual payment data
      // Fetch monthly payments for these players
      const playerIds = playersData.map((p: any) => p.id);
      
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('player_id', playerIds);
      
      if (paymentsError) {
        console.error("Error fetching payments:", paymentsError);
        throw paymentsError;
      }
      
      console.log(`Found ${paymentsData?.length || 0} payment records`);
      
      // Transform player data with last paid status and date
      const transformedPlayers = (playersData || []).map((player: any) => {
        // Find payment record for this player for the selected month
        const paymentInfo = (paymentsData || []).find((p: any) => p.player_id === player.id) || { status: 'unpaid', updated_at: null, updated_by: null };
        return {
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: paymentInfo.status,
          payment_updated_at: paymentInfo.updated_at,
          payment_updated_by: paymentInfo.updated_by,
          payment_method: paymentInfo.payment_method ?? undefined,
        };
      });
      setPlayers(transformedPlayers);
      // Always update stats right after setting players
      const totalPlayers = transformedPlayers.length;
      const paidPlayers = transformedPlayers.filter(p => p.payment_status === 'paid').length;
      const unpaidPlayers = totalPlayers - paidPlayers;
      setStats({ totalPlayers, paidPlayers, unpaidPlayers });
      
      // Build a map: { 'YYYY-M': { paid: X, total: Y } }
      const statusMap: { [key: string]: { paid: number; total: number } } = {};
      playersData.forEach((player: any) => {
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${m}`;
          if (!statusMap[key]) statusMap[key] = { paid: 0, total: 0 };
          statusMap[key].total++;
        }
      });
      (paymentsData || []).forEach((payment: any) => {
        const key = `${payment.year}-${payment.month}`;
        if (statusMap[key]) {
          if (payment.status === 'paid') statusMap[key].paid++;
        }
      });
      
      // Now build monthStatusMap
      const newMonthStatusMap: { [key: string]: 'all_paid' | 'not_all_paid' } = {};
      Object.entries(statusMap).forEach(([key, val]) => {
        if (val.total > 0) {
          newMonthStatusMap[key] = val.paid === val.total ? 'all_paid' : 'not_all_paid';
        }
      });
      setMonthStatusMap(newMonthStatusMap);
      console.log('[DEBUG] monthStatusMap:', newMonthStatusMap);
      
    } catch (error) {
      console.error('Error fetching monthly payments for team:', error);
      Alert.alert('Error', 'Failed to load payment data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // New function to fetch attendance data with explicit team ID and players
  const fetchAttendanceDataForTeam = async (year: number, month: number, teamId: string, playersList: Player[]) => {
    try {
      // Calculate the start and end dates for the selected month
      const monthIndex = month - 1; // Convert to 0-based month
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0); // Last day of the month
      
      // Format dates for the query
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`Fetching attendance for team ${teamId} from ${startDateStr} to ${endDateStr}`);
      
      // Fetch all activities for the selected team and month
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('id, start_time, type')
        .eq('team_id', teamId)
        .gte('start_time', startDateStr)
        .lte('start_time', endDateStr);
      
      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        throw activitiesError;
      }
      
      console.log(`Found ${activitiesData?.length || 0} activities for this period (${month}/${year})`);
      if (activitiesData && activitiesData.length > 0) {
        console.log(`Activities by type: ${
          activitiesData.reduce((acc: {[key: string]: number}, activity: any) => {
            const type = activity.type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})}`);
      }
      
      // Filter activities to only include 'training' type
      const trainingActivities = (activitiesData || []).filter((a: any) => a.type === 'training');
      const trainingActivityIds = trainingActivities.map((a: any) => a.id);

      if (trainingActivityIds.length === 0) {
        // No training sessions this month
        const emptyAttendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
        playersList.forEach(player => {
          emptyAttendance[player.id] = { present: 0, absent: 0, total: 0, percentage: 0 };
        });
        setAttendanceData(emptyAttendance);
        setPlayers(playersList.map(player => ({
          ...player,
          attendance: { present: 0, absent: 0, total: 0, percentage: 0 }
        })));
        return;
      }

      // Fetch attendance records for these training activities
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('activity_id, player_id, status')
        .in('activity_id', trainingActivityIds);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw attendanceError;
      }

      // Calculate attendance for each player for trainings only
      const attendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
      playersList.forEach(player => {
        const playerAttendance = (attendanceData || []).filter((a: any) => a.player_id === player.id && trainingActivityIds.includes(a.activity_id));
        const present = playerAttendance.filter((a: any) => a.status === 'present').length;
        const absent = playerAttendance.filter((a: any) => a.status === 'absent').length;
        const total = playerAttendance.length; // Only trainings where attendance is marked for this player
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        attendance[player.id] = { present, absent, total, percentage };
      });
      setAttendanceData(attendance);
      setPlayers(playersList.map(player => ({
        ...player,
        attendance: attendance[player.id] || { present: 0, absent: 0, total: 0, percentage: 0 }
      })));
      
    } catch (error) {
      console.error('Error fetching attendance data for team:', error);
    }
  };
  
  // Handle team selection
  const handleTeamSelect = (teamId: string) => {
    console.log(`Team selected: ${teamId}`);
    setSelectedTeamId(teamId);
    setIsTeamModalVisible(false);
    
    // Fetch data for the selected team
    if (selectedMonth) {
      console.log(`Fetching data for team ${teamId} and month ${selectedMonth.value}/${selectedMonth.year}`);
      fetchMonthlyPaymentsForTeam(selectedMonth.year, selectedMonth.value, teamId);
      
      // Ensure the month selector stays centered on the current month after team selection
      const currentIndex = currentMonthIndex;
      setTimeout(() => {
        if (currentIndex > 0) scrollToMonth(currentIndex);
      }, 100);
      
      setTimeout(() => {
        if (currentIndex > 0) scrollToMonth(currentIndex);
      }, 300);
      
      setTimeout(() => {
        if (currentIndex > 0) scrollToMonth(currentIndex);
      }, 600);
    } else {
      console.log('Could not fetch data: selectedMonth is missing', { selectedMonth });
    }
  };
  
  // Handle search input
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // Modified togglePaymentStatus to require payment method if marking as paid
  const togglePaymentStatus = async (player: Player) => {
    if (player.payment_status !== 'paid') {
      setPendingPaymentPlayer(player);
      setIsPaymentMethodModalVisible(true);
      return;
    }
    // If marking as unpaid, proceed as before
    await updatePaymentStatus(player, 'not_paid', null);
  };

  // New function to update payment status with payment method
  const updatePaymentStatus = async (player: Player, newStatus: string, paymentMethod: string | null) => {
    try {
      if (!selectedMonth) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User information not found. Please log in again.');
        return;
      }
      const now = new Date().toISOString();
      const upsertData: any = {
        player_id: player.id,
        year: selectedMonth.year,
        month: selectedMonth.value,
        status: newStatus,
        updated_at: now,
        updated_by: user.id
      };
      if (newStatus === 'paid' && paymentMethod) {
        upsertData.payment_method = paymentMethod;
      } else if (newStatus !== 'paid') {
        // Do not set payment_method at all if not paid
        delete upsertData.payment_method;
      }
      const { error } = await supabase
        .from('monthly_payments')
        .upsert(upsertData, { onConflict: 'player_id,year,month' });
      if (error) throw error;
      setPlayers(players.map(p =>
        p.id === player.id
          ? {
              ...p,
              payment_status: newStatus,
              payment_updated_at: now,
              payment_updated_by: user.id,
              payment_updated_by_name: user.email,
              ...(upsertData.payment_method !== undefined ? { payment_method: upsertData.payment_method ?? undefined } : {})
            }
          : p
      ));
      const updatedPaidCount = newStatus === 'paid'
        ? stats.paidPlayers + 1
        : stats.paidPlayers - 1;
      setStats({
        ...stats,
        paidPlayers: updatedPaidCount,
        unpaidPlayers: stats.totalPlayers - updatedPaidCount
      });
      setToastMessage(`${player.player_name} marked as ${newStatus}`);
      setShowToast(true);
      triggerEvent('payment_status_changed', player.id, newStatus, now);
    } catch (error) {
      Alert.alert('Error', 'Failed to update payment status.');
    }
  };

  // Handler for confirming payment method
  const handleConfirmPaymentMethod = async () => {
    if (!pendingPaymentPlayer || !selectedPaymentMethod) {
      Alert.alert('Select Payment Method', 'Please select a payment method.');
      return;
    }
    await updatePaymentStatus(pendingPaymentPlayer, 'paid', selectedPaymentMethod);
    setIsPaymentMethodModalVisible(false);
    setSelectedPaymentMethod(null);
    setPendingPaymentPlayer(null);
    setExpandedPlayerId(null); // Collapse the expanded card after marking as paid
  };

  // Filter players based on search query
  const filteredPlayers = players.filter(player => {
    const matchesSearch = !searchQuery || 
      player.player_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

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
    
    console.log("[DEBUG] Fetching payment history for player:", player.id);
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    // Generate all months for the current year up to the current month
    const months = [];
    for (let m = 1; m <= currentMonth; m++) {
      months.push({ year: currentYear, month: m, date: new Date(currentYear, m - 1, 1) });
    }
    months.reverse(); // Most recent first
    
    console.log("[DEBUG] Generated months:", months.map(m => `${m.year}-${m.month}`));
    setHistoryMonths(months);
    
    const playerId = player.id;
    
    try {
      // Fetch all payment records for this player for the current year
      const { data, error } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('player_id', playerId)
        .eq('year', currentYear);
      
      if (error) throw error;
      console.log("[DEBUG] Raw payment records:", data);
      
      // Build a map of records for lookup, ONLY for months <= currentMonth
      const recordsByMonth: Record<string, any> = {};
      (data || []).forEach(record => {
        if (record.year === currentYear && record.month <= currentMonth) {
          recordsByMonth[`${record.year}-${record.month}`] = record;
        }
      });
      
      console.log("[DEBUG] Filtered records by month:", recordsByMonth);
      
      // Build history for each month in our months array
      const history = months.map(({ year, month }) => {
        const key = `${year}-${month}`;
        if (recordsByMonth[key]) {
          return {
            player_id: playerId,
            year,
            month,
            status: recordsByMonth[key].status
          };
        } else {
          // For any month with no record, always show Not Paid
          return {
            player_id: playerId,
            year,
            month,
            status: 'not_paid'
          };
        }
      });
      
      console.log("[DEBUG] Final payment history:", history.map(h => `${h.year}-${h.month}: ${h.status}`));
      setPaymentHistory(history);
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
      case 'unpaid': return 'Not Paid';
      case 'on_trial': return 'On Trial';
      case 'trial_ended': return 'Trial Ended';
      case 'select_status': return 'Select Status';
      default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    }
  };

  // First, add a helper function to map database status values back to display values
  const getDisplayPaymentStatus = (dbStatus: string, uiStatus?: string): string => {
    return dbStatus === 'paid' ? 'paid' : 'unpaid';
  };

  // Add this helper function near the getDisplayPaymentStatus function
  const getValidDatabaseStatus = (status: string): string => {
    console.log("Converting UI status to database status for legacy column:", status);
    
    // This function now only used for backward compatibility with the old TEXT payment_status column
    // The player_status ENUM column will get the exact status value directly
    
    // Map UI status values to valid database values for the old column
    // Legacy column accepts: 'paid', 'not_paid' but NOT 'unpaid', 'pending', 'on_trial', etc.
    switch(status) {
      case 'paid':
        return 'paid';
      case 'unpaid': 
        return 'not_paid'; // Map 'unpaid' to 'not_paid' for database compatibility
      case 'pending':
        return 'not_paid'; // Map 'pending' to 'not_paid' for simplicity
      case 'on_trial':
        return 'not_paid'; // Map 'on_trial' to 'not_paid' for simplicity
      case 'trial_ended':
        return 'not_paid'; // Map 'trial_ended' to 'not_paid' for simplicity
      case 'select_status':
        return 'not_paid'; // Map 'select_status' to 'not_paid' for simplicity
      case 'not_paid':
        return 'not_paid'; // Already correct format
      default:
        console.log("Using default status 'not_paid' for unknown status:", status);
        return 'not_paid';
    }
  };

  // Handle player menu visibility
  const handlePlayerMenuPress = (playerId: string) => {
    console.log("Player menu press:", playerId, "current:", playerMenuVisible);
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
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
    if (!selectedPlayer) return;
    
    try {
      console.log("[DEBUG] Changing payment status for player:", selectedPlayer.id, "to:", newStatus);
      
      // Get current date info for recording the payment
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12 format
      
      // Use stored procedure to update both tables at once
      const dbStatus = newStatus === 'paid' ? 'paid' : 'not_paid';
      
      console.log("[DEBUG] Current month/year:", currentMonth, currentYear);
      console.log("[DEBUG] Using database status:", dbStatus);
      
      // Update monthly_payments record (SOURCE OF TRUTH)
      const { data: monthlyResult, error: monthlyError } = await supabase
        .rpc('update_player_payment_status', {
          p_player_id: selectedPlayer.id,
          p_status: dbStatus,
          p_year: currentYear,
          p_month: currentMonth
        });
      
      if (monthlyError) {
        console.error("[ERROR] Failed to update monthly payment:", monthlyError);
        throw monthlyError;
      }
      
      console.log("[DEBUG] Monthly payment update result:", monthlyResult);
      
      // Also update the legacy player.payment_status field to keep it in sync
      const { error: playerError } = await supabase
        .from('players')
        .update({
          payment_status: dbStatus,
          last_payment_date: dbStatus === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', selectedPlayer.id);
      
      if (playerError) {
        console.error("[ERROR] Failed to update player payment status:", playerError);
        // Don't throw here, as the monthly_payments update succeeded
      }
      
      // Trigger global event that payment status has changed
      triggerPaymentStatusChange(
        selectedPlayer.id,
        newStatus,
        dbStatus === 'paid' ? new Date().toISOString() : null
      );
      
      // Close the modal and refresh
      setIsStatusModalVisible(false);
      
      // Refresh data to show updated status
      if (selectedMonth && selectedTeamId) {
        await fetchMonthlyPaymentsForTeam(selectedMonth.year, selectedMonth.value, selectedTeamId);
      } else if (selectedMonth) {
        await fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
      }
      
      Alert.alert("Success", "Payment status updated successfully");
    } catch (error) {
      console.error("[ERROR] Error updating payment status:", error);
      Alert.alert("Error", "Failed to update payment status");
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
      
      // Update the UI - no longer setting cash_collected flag
      const updatedPlayers = players.map(p => 
        p.id === selectedPlayer.id 
          ? { ...p }
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
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };
  
  // Send payment reminder to parent
  const sendPaymentReminder = async (player: Player) => {
    try {
      if (!selectedMonth) return;
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to send reminders.');
        return;
      }
      
      // Call the Edge Function to send the reminder
      const { data, error } = await supabase.functions.invoke('send-payment-reminder', {
        body: {
          playerId: player.id,
          parentId: player.parent_id,
          month: selectedMonth.value,
          monthName: selectedMonth.name,
          year: selectedMonth.year,
          playerName: player.player_name,
          senderId: user.id,
          senderType: 'coach'
        }
      });
      
      if (error) throw error;
      
      // Show success message
      setToastMessage(data.message || 'Payment reminder sent');
      setShowToast(true);
      
      // Hide toast after 3 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      Alert.alert('Error', 'Failed to send payment reminder. Please try again.');
    }
  };

  // Function to fetch payments data for all teams managed by the coach
  const fetchAllTeamsPayments = async (year: number, month: number) => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] fetchAllTeamsPayments - Starting for ${month}/${year}`);
      
      // Get coach data
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        console.log("[DEBUG] fetchAllTeamsPayments - No coach data found");
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      console.log("[DEBUG] fetchAllTeamsPayments - Coach ID:", coachData.id);
      
      // First, get all teams assigned to this coach
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });
      
      if (teamsError) {
        console.error("[DEBUG] fetchAllTeamsPayments - Error fetching teams:", teamsError);
        throw teamsError;
      }
      
      if (!teamsData || teamsData.length === 0) {
        console.log("[DEBUG] fetchAllTeamsPayments - No teams found for this coach");
        setPlayers([]);
        setStats({
          totalPlayers: 0,
          paidPlayers: 0,
          unpaidPlayers: 0
        });
        return;
      }
      
      // Get all team IDs
      const teamIds = teamsData.map((team: any) => team.team_id);
      console.log(`[DEBUG] fetchAllTeamsPayments - Found ${teamIds.length} teams: ${teamIds.join(', ')}`);
      
      // Fetch all players from these teams
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          teams:team_id(name)
        `)
        .in('team_id', teamIds)
        .eq('is_active', true);
      
      if (playersError) {
        console.error("[DEBUG] fetchAllTeamsPayments - Error fetching players:", playersError);
        throw playersError;
      }
      
      console.log(`[DEBUG] fetchAllTeamsPayments - Found ${playersData?.length || 0} players across all teams`);
      
      if (!playersData || playersData.length === 0) {
        console.log("[DEBUG] fetchAllTeamsPayments - No players found in any team");
        setPlayers([]);
        setStats({
          totalPlayers: 0,
          paidPlayers: 0,
          unpaidPlayers: 0
        });
        return;
      }
      
      // Get current date info for comparing months
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // 1-based month
      const currentYear = currentDate.getFullYear();
      const isFutureMonth = (year > currentYear) || (year === currentYear && month > currentMonth);
      
      console.log(`[DEBUG] fetchAllTeamsPayments - Current date: ${currentMonth}/${currentYear}, Selected: ${month}/${year}, isFutureMonth: ${isFutureMonth}`);
      
      // For future months, set all players to 'unpaid' without querying the database
      if (isFutureMonth) {
        console.log("[DEBUG] fetchAllTeamsPayments - Future month selected - setting all players to unpaid by default");
        const transformedPlayers = playersData.map((player: any) => ({
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: 'unpaid',
          payment_updated_at: null,
          payment_updated_by: null,
          payment_updated_by_name: null
        }));
        
        console.log(`[DEBUG] fetchAllTeamsPayments - Setting ${transformedPlayers.length} players with default unpaid status`);
        setPlayers(transformedPlayers);
        
        // All unpaid for future months
        setStats({
          totalPlayers: transformedPlayers.length,
          paidPlayers: 0,
          unpaidPlayers: transformedPlayers.length
        });
        
        // Now fetch attendance data for all teams
        await fetchAttendanceDataForAllTeams(year, month, teamIds, transformedPlayers);
        setIsLoading(false);
        return;
      }
      
      // For current or past months, fetch actual payment data
      // Fetch monthly payments for these players
      const playerIds = playersData.map((p: any) => p.id);
      
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('player_id', playerIds);
      
      if (paymentsError) {
        console.error("[DEBUG] fetchAllTeamsPayments - Error fetching payments:", paymentsError);
        throw paymentsError;
      }
      
      console.log(`[DEBUG] fetchAllTeamsPayments - Found ${paymentsData?.length || 0} payment records across all teams`);
      
      // Transform player data with payment status
      const transformedPlayers = (playersData || []).map((player: any) => {
        // Default to 'unpaid' if no payment record exists
        const paymentInfo = (paymentsData || []).find((p: any) => p.player_id === player.id) || { status: 'unpaid' };
        
        return {
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: paymentInfo.status,
          payment_updated_at: paymentInfo.updated_at,
          payment_updated_by: paymentInfo.updated_by,
          payment_updated_by_name: 'Coach',
          payment_method: paymentInfo.payment_method ?? undefined
        };
      });
      setPlayers(transformedPlayers);
      // Always update stats right after setting players
      const totalPlayers = transformedPlayers.length;
      const paidPlayers = transformedPlayers.filter(p => p.payment_status === 'paid').length;
      const unpaidPlayers = totalPlayers - paidPlayers;
      setStats({ totalPlayers, paidPlayers, unpaidPlayers });
      
      // Now fetch attendance data for all teams
      await fetchAttendanceDataForAllTeams(year, month, teamIds, transformedPlayers);
      
    } catch (error) {
      console.error('[DEBUG] fetchAllTeamsPayments - Error fetching payments for all teams:', error);
      Alert.alert('Error', 'Failed to load payment data');
    } finally {
      console.log("[DEBUG] fetchAllTeamsPayments - Finished, setting isLoading to false");
      setIsLoading(false);
    }
  };
  
  // Function to fetch attendance data for all teams
  const fetchAttendanceDataForAllTeams = async (year: number, month: number, teamIds: string[], playersList: Player[]) => {
    try {
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Starting for ${month}/${year} with ${teamIds.length} teams and ${playersList.length} players`);
      
      // Calculate the start and end dates for the selected month
      const monthIndex = month - 1; // Convert to 0-based month
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0); // Last day of the month
      
      // Format dates for the query
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Date range: ${startDateStr} to ${endDateStr}`);
      
      // Fetch all activities for the selected teams and month
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('id, team_id, start_time')
        .in('team_id', teamIds)
        .gte('start_time', startDateStr)
        .lte('start_time', endDateStr);
      
      if (activitiesError) {
        console.error("[DEBUG] fetchAttendanceDataForAllTeams - Error fetching activities:", activitiesError);
        throw activitiesError;
      }
      
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Found ${activitiesData?.length || 0} activities for this period across all teams`);
      
      // Create a map to group activities by team
      const teamActivitiesMap = new Map();
      teamIds.forEach(teamId => {
        teamActivitiesMap.set(teamId, []);
      });
      
      // Group activities by team
      (activitiesData || []).forEach((activity: any) => {
        const teamActivities = teamActivitiesMap.get(activity.team_id) || [];
        teamActivities.push(activity.id);
        teamActivitiesMap.set(activity.team_id, teamActivities);
      });
      
      // Get all activity IDs
      const activityIds = (activitiesData || []).map((a: any) => a.id);
      
      if (activityIds.length === 0) {
        // No activities this month across any team
        console.log(`[DEBUG] fetchAttendanceDataForAllTeams - No activities found for month ${month}/${year} across any team`);
        const emptyAttendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
        playersList.forEach(player => {
          emptyAttendance[player.id] = { present: 0, absent: 0, total: 0, percentage: 0 };
        });
        setAttendanceData(emptyAttendance);
        
        // Update players with empty attendance data
        console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Updating ${playersList.length} players with empty attendance data`);
        setPlayers(playersList.map(player => ({
          ...player,
          attendance: { present: 0, absent: 0, total: 0, percentage: 0 }
        })));
        
        return;
      }
      
      // Fetch all attendance records for these activities
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('activity_id, player_id, status')
        .in('activity_id', activityIds);
      
      if (attendanceError) {
        console.error("[DEBUG] fetchAttendanceDataForAllTeams - Error fetching attendance:", attendanceError);
        throw attendanceError;
      }
      
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Found ${attendanceData?.length || 0} attendance records`);
      
      // Calculate attendance for each player
      const attendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
      
      playersList.forEach(player => {
        // Get activities for this player's team
        const teamActivities = teamActivitiesMap.get(player.team_id) || [];
        // Only count attendance for activities in this player's team
        const playerAttendance = (attendanceData || []).filter(
          (a: any) => a.player_id === player.id && teamActivities.includes(a.activity_id)
        );
        const present = playerAttendance.filter((a: any) => a.status === 'present').length;
        const absent = playerAttendance.filter((a: any) => a.status === 'absent').length;
        const total = playerAttendance.length; // Only trainings where attendance is marked for this player
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        attendance[player.id] = { present, absent, total, percentage };
      });
      
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Calculated attendance for ${Object.keys(attendance).length} players`);
      setAttendanceData(attendance);
      
      // Update players with attendance data
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Updating ${playersList.length} players with attendance data`);
      setPlayers(playersList.map(player => ({
        ...player,
        attendance: attendance[player.id] || { present: 0, absent: 0, total: 0, percentage: 0 }
      })));
      
      console.log(`[DEBUG] fetchAttendanceDataForAllTeams - Completed successfully`);
      
    } catch (error) {
      console.error('[DEBUG] fetchAttendanceDataForAllTeams - Error fetching attendance data for all teams:', error);
    }
  };

  if (isLoading || collectionsLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Fixed Month Selector */}
        <View style={styles.monthStepperContainer}>
          <TouchableOpacity
            onPress={() => {
              if (!months.length || !selectedMonth) return;
              const idx = months.findIndex(m => m.value === selectedMonth.value && m.year === selectedMonth.year);
              if (idx > 0) {
                handleMonthSelect(months[idx - 1], idx - 1);
              }
            }}
            style={styles.monthArrowButton}
            disabled={!months.length || !selectedMonth || months.findIndex(m => m.value === selectedMonth.value && m.year === selectedMonth.year) === 0}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsMonthPickerVisible(true)} style={styles.monthStepperLabelContainer} activeOpacity={0.7}>
            <Text style={styles.monthStepperLabel}>
              {selectedMonth ? `${selectedMonth.name} ${selectedMonth.year}` : ''}
                    </Text>
            {selectedTeamId && monthStatusMap[`${selectedMonth?.year}-${selectedMonth?.value}`] === 'all_paid' && (
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} style={{ marginLeft: 8 }} />
            )}
            {selectedTeamId && monthStatusMap[`${selectedMonth?.year}-${selectedMonth?.value}`] === 'not_all_paid' && (
              <MaterialCommunityIcons name="flag" size={20} color={COLORS.error} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!months.length || !selectedMonth) return;
              const idx = months.findIndex(m => m.value === selectedMonth.value && m.year === selectedMonth.year);
              if (idx < months.length - 1) {
                handleMonthSelect(months[idx + 1], idx + 1);
              }
            }}
            style={styles.monthArrowButton}
            disabled={!months.length || !selectedMonth || months.findIndex(m => m.value === selectedMonth.value && m.year === selectedMonth.year) === months.length - 1}
          >
            <MaterialCommunityIcons name="chevron-right" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.mainScrollView}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Team Selector */}
          <TouchableOpacity
            style={styles.teamSelectorButton}
            onPress={() => setIsTeamModalVisible(true)}
          >
            <MaterialCommunityIcons 
              name="account-group" 
              size={20} 
              color={COLORS.primary} 
              style={styles.teamSelectorIcon} 
            />
            <Text style={styles.teamSelectorText} numberOfLines={1}>
              {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : 'Select Team'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
          
          {/* Add empty state message when no team is selected */}
          {!selectedTeamId && (
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="arrow-up-drop-circle" size={48} color={COLORS.primary} />
              <Text style={styles.emptyStateTextCentered}>Please select a team to view payments</Text>
            </View>
          )}
          
          {/* Search Bar - Only show when a team is selected */}
          {selectedTeamId && (
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
          )}
          
          {/* Stats Summary */}
          {players.length > 0 && (
            <>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                  <Text style={styles.statLabel}>Paid</Text>
                  <Text style={styles.statValue}>{stats.paidPlayers}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                  <Text style={styles.statLabel}>Not Paid</Text>
                  <Text style={styles.statValue}>{stats.unpaidPlayers}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
                  <Text style={styles.statLabel}>Total</Text>
                  <Text style={styles.statValue}>{stats.totalPlayers}</Text>
                </View>
              </View>
              {/* Player List */}
              <View style={styles.playersContainer}>
                {filteredPlayers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="account-off" size={48} color={COLORS.grey[400]} />
                    <Text style={styles.emptyStateText}>No players found</Text>
                  </View>
                ) : (
                  filteredPlayers.map(player => (
                    <View key={player.id} style={styles.playerCard}>
                      <View 
                        style={[
                          styles.playerCardContent,
                          { 
                            borderLeftWidth: 4,
                            borderLeftColor: player.payment_status === 'paid' ? COLORS.success : COLORS.error,
                            borderTopWidth: 1,
                            borderRightWidth: 1,
                            borderBottomWidth: 1,
                            borderTopColor: COLORS.grey[200],
                            borderRightColor: COLORS.grey[200],
                            borderBottomColor: COLORS.grey[200]
                          }
                        ]}
                      >
                        {/* Player Name and Status */}
                        <View style={styles.playerHeader}>
                          <View style={styles.playerInfo}>
                            <MaterialCommunityIcons name="account" size={24} color={COLORS.text} style={styles.playerIcon} />
                            <Text style={styles.playerName}>{player.player_name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[
                              styles.statusBadge,
                              { backgroundColor: player.payment_status === 'paid' ? COLORS.success + '20' : COLORS.error + '20' }
                            ]}>
                              <MaterialCommunityIcons 
                                name={player.payment_status === 'paid' ? 'check' : 'close'} 
                                size={14} 
                                color={player.payment_status === 'paid' ? COLORS.success : COLORS.error} 
                              />
                              <Text style={[
                                styles.statusText,
                                { color: player.payment_status === 'paid' ? COLORS.success : COLORS.error }
                              ]}>
                                {player.payment_status === 'paid' ? 'Paid' : 'Not Paid'}
                              </Text>
                            </View>
                            
                            {/* Payment reminder bell icon - only show for unpaid players */}
                            {player.payment_status !== 'paid' && (
                              <TouchableOpacity 
                                style={styles.reminderButton}
                                onPress={() => sendPaymentReminder(player)}
                                accessibilityLabel="Send payment reminder"
                              >
                                <MaterialCommunityIcons 
                                  name="bell" 
                                  size={20} 
                                  color={COLORS.warning} 
                                />
                              </TouchableOpacity>
                            )}
                            
                            {/* Expand/collapse arrow */}
                            <TouchableOpacity
                              onPress={() => setExpandedPlayerId(expandedPlayerId === player.id ? null : player.id)}
                              style={{ marginLeft: 8 }}
                              accessibilityLabel={expandedPlayerId === player.id ? 'Collapse actions' : 'Expand actions'}
                            >
                              <MaterialCommunityIcons 
                                name={expandedPlayerId === player.id ? 'chevron-up' : 'chevron-down'} 
                                size={24} 
                                color={COLORS.grey[600]} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {/* Payment Update Info - Show only for paid payments */}
                        {player.payment_status === 'paid' && player.payment_updated_at && (
                          <View style={styles.paymentUpdateContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.grey[600]} />
                            <Text style={styles.paymentUpdateText}>
                              Paid on {formatDate(player.payment_updated_at)}
                            </Text>
                            {player.payment_method && (
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
                                  {paymentMethodOptions.find(opt => opt.value === player.payment_method)?.label || player.payment_method}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {/* Expandable Payment Toggle Button */}
                        {expandedPlayerId === player.id && (
                          <TouchableOpacity 
                            style={[
                              styles.paymentToggleButton,
                              { backgroundColor: player.payment_status === 'paid' ? COLORS.error + '20' : COLORS.success + '20' }
                            ]}
                            onPress={() => togglePaymentStatus(player)}
                          >
                            <MaterialCommunityIcons 
                              name={player.payment_status === 'paid' ? 'close' : 'check'} 
                              size={20} 
                              color={player.payment_status === 'paid' ? COLORS.error : COLORS.success} 
                            />
                            <Text style={[
                              styles.paymentToggleText,
                              { color: player.payment_status === 'paid' ? COLORS.error : COLORS.success }
                            ]}>
                              Mark as {player.payment_status === 'paid' ? 'Not Paid' : 'Paid'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
                {/* Add extra padding at bottom for better scrolling */}
                <View style={{ height: 24 }} />
              </View>
            </>
          )}
        </ScrollView>

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
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
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
        
        {/* Toast Notification */}
        {showToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
      </View>
      {/* Month Picker Modal */}
      <Modal
        visible={isMonthPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderRadius: 0, padding: 24, width: '100%', maxWidth: undefined, alignSelf: undefined, margin: 0 }]}> 
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 }}>Select Month</Text>
              <TouchableOpacity onPress={() => setIsMonthPickerVisible(false)} style={{ marginLeft: 8 }}>
                <MaterialCommunityIcons name="close" size={28} color={COLORS.grey[600]} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {months.map((month, idx) => {
                const isSelected = selectedMonth && selectedMonth.value === month.value && selectedMonth.year === month.year;
                const monthKey = `${month.year}-${month.value}`;
                return (
                  <TouchableOpacity
                    key={monthKey}
                    style={[
                      styles.monthGridItem,
                      isSelected && styles.monthGridItemSelected,
                      { width: '30%', maxWidth: 110, minWidth: 90, height: 56, margin: '1.5%' } // 3 columns
                    ]}
                    onPress={() => {
                      handleMonthSelect(month, idx);
                      setIsMonthPickerVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.monthGridItemText,
                      isSelected && styles.monthGridItemTextSelected
                    ]}>
                      {month.name}
                    </Text>
                    {selectedTeamId && monthStatusMap[monthKey] === 'all_paid' && (
                      <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }} />
                    )}
                    {selectedTeamId && monthStatusMap[monthKey] === 'not_all_paid' && (
                      <MaterialCommunityIcons name="flag" size={16} color={COLORS.error} style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
      {/* Payment Method Modal */}
      <Modal
        visible={isPaymentMethodModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPaymentMethodModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Select Payment Method</Text>
            <RadioButton.Group
              onValueChange={value => setSelectedPaymentMethod(value)}
              value={selectedPaymentMethod ?? ''}
            >
              {paymentMethodOptions.map(option => {
                const isSelected = selectedPaymentMethod === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                    }}
                    onPress={() => setSelectedPaymentMethod(option.value)}
                    activeOpacity={0.7}
                  >
                    <RadioButton
                      value={option.value}
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => setSelectedPaymentMethod(option.value)}
                      color="#00BDF2"
                      uncheckedColor="#ccc"
                    />
                    <Text style={{ fontSize: 16, color: '#222' }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </RadioButton.Group>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, marginTop: 16, alignItems: 'center' }}
              onPress={handleConfirmPaymentMethod}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => {
                setIsPaymentMethodModalVisible(false);
                setSelectedPaymentMethod(null);
                setPendingPaymentPlayer(null);
              }}
            >
              <Text style={{ color: COLORS.error, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Month selector styles
  monthStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    paddingTop: SPACING.xl, // Add more top padding for distance from account area
  },
  monthArrowButton: {
    padding: 8,
  },
  monthStepperLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    marginHorizontal: 12,
  },
  monthStepperLabel: {
    fontSize: 24, // Make the month name bigger
    fontWeight: 'bold',
    color: COLORS.text,
  },
  // Team selector styles
  teamSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    padding: SPACING.md,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  teamSelectorIcon: {
    marginRight: SPACING.sm,
  },
  teamSelectorText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
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
  // Stats summary styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12, // Slightly increased for a card look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    borderWidth: 1, // Add border
    borderColor: COLORS.grey[200], // Subtle border color
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: COLORS.grey[200],
  },
  // Player list styles
  playersContainer: {
    paddingHorizontal: 12, // Add horizontal padding to the container
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
  // Player card styles
  playerCard: {
    marginBottom: SPACING.sm, // Reduce from md to sm for less space between cards
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 6, // Add horizontal margin to each card
  },
  playerCardContent: {
    padding: SPACING.md,
    paddingVertical: SPACING.sm, // Reduce from lg to sm for a more compact card
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerIcon: {
    marginRight: SPACING.sm,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: SPACING.sm,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 3,
  },
  paymentToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  paymentToggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  // Modal styles
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
  // Toast styles
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Payment update styles
  paymentUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  paymentUpdateText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: SPACING.xs,
    fontStyle: 'italic',
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: SPACING.lg, // Reduce from xl to lg for less bottom whitespace
  },
  // Add/replace style for underline
  currentMonthUnderline: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    bottom: -4,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  // Add styles for the month grid
  monthGridItem: {
    // width and height are set inline in the JSX for the grid, so only keep the default for fallback
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.grey[300],
  },
  monthGridItemSelected: {
    backgroundColor: COLORS.primary + '20',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  monthGridItemText: {
    fontSize: 16, // Match filter chip font size
    color: COLORS.text,
    fontWeight: '500', // Medium
  },
  monthGridItemTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyStateTextCentered: {
    fontSize: 16,
    color: COLORS.grey[600],
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  attendanceLabel: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
  },
  reminderButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: COLORS.warning + '20',
    marginLeft: SPACING.sm,
  },
}); 