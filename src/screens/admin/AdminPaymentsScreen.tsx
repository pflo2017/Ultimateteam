import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Alert, SafeAreaView, Dimensions, ActivityIndicator, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { getUserClubId } from '../../services/activitiesService';
import { useTranslation } from 'react-i18next';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  payment_status: 'paid' | 'unpaid';
  payment_updated_at?: string | null; // When the payment status was last updated
  payment_updated_by?: string | null; // Who updated the payment status
  parent_id?: string; // Parent ID for sending notifications
  attendance?: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
  };
  payment_method?: string | null;
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

export const AdminPaymentsScreen = () => {
  // Refs
  const monthScrollViewRef = useRef<ScrollView>(null);
  const { t } = useTranslation();
  
  // Basic state
  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  
  // Month selection state
  const [months, setMonths] = useState<{name: string, value: number, year: number}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<{name: string, value: number, year: number} | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  
  // Payment statistics
  const [stats, setStats] = useState<PaymentStats>({
    totalPlayers: 0,
    paidPlayers: 0,
    unpaidPlayers: 0,
  });
  
  // 1. Add state for monthStatusMap
  const [monthStatusMap, setMonthStatusMap] = useState<{ [key: string]: 'all_paid' | 'not_all_paid' | undefined }>({});
  
  // Add state for modal month picker
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  
  // Add state for toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Initialize on mount
  useEffect(() => {
    initializeMonths();
    fetchTeams();
  }, []);
  
  // Add a useEffect to ensure scroll happens after render
  useEffect(() => {
    if (months.length > 0 && currentMonthIndex > 0) {
      // Delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        scrollToMonth(currentMonthIndex);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [months, currentMonthIndex]);
  
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
  
  // Add a useEffect to load initial data when months are initialized
  useEffect(() => {
    if (selectedMonth && months.length > 0) {
      console.log("Initial data loading with selectedMonth:", selectedMonth);
      // Load all teams data by default when the page first loads
      fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
    }
  }, [selectedMonth, months.length]);
  
  // Use data refresh hook to refresh when payment status changes
  useDataRefresh('payments', () => {
    console.log("Payment status change detected - refreshing payment data");
    if (selectedMonth && selectedTeamId) {
      fetchMonthlyPayments(selectedMonth.year, selectedMonth.value, selectedTeamId);
    } else if (selectedMonth) {
      fetchAllTeamsPayments(selectedMonth.year, selectedMonth.value);
    }
  });
  
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
    
    // Ensure we scroll to center the current month after render
    setTimeout(() => {
      scrollToMonth(currentMonthIdx);
    }, 500);
  };
  
  // Function to scroll to a specific month by index
  const scrollToMonth = (index: number) => {
    if (monthScrollViewRef.current) {
      // Calculate the position to scroll to
      const itemWidth = 70; // Width of each month item including margins
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
  
  // Handler for selecting a month
  const handleMonthSelect = (month: {name: string, value: number, year: number}, index: number) => {
    setSelectedMonth(month);
    setCurrentMonthIndex(index);
    
    // Scroll to center the selected month with a slight delay to ensure state is updated
    setTimeout(() => {
      scrollToMonth(index);
    }, 50);
    
    // Fetch data for the selected month
    if (selectedTeamId) {
      fetchMonthlyPayments(month.year, month.value, selectedTeamId);
    } else {
      fetchAllTeamsPayments(month.year, month.value);
    }
  };
  
  // Fetch all teams
  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      
      console.log("Fetching teams for current club");
      
      // Get the current user's club ID first
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        setIsLoading(false);
        return;
      }
      
      console.log(`Fetching teams for club ID: ${clubId}`);
      
      // IMPORTANT: Always filter by club_id to ensure proper data isolation between clubs
      // This prevents admins from seeing teams from other clubs/academies
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId) // Add club_id filter to ensure data isolation
        .eq('is_active', true)
        .order('name');
      
      if (teamsError) {
        console.error("Error fetching teams:", teamsError);
        throw teamsError;
      }
      
      console.log(`Found ${teamsData?.length || 0} teams for club ${clubId}`);
      setTeams(teamsData || []);
      
      // We don't fetch payment data here anymore - that's handled by the useEffect
      
    } catch (error) {
      console.error('Error fetching teams:', error);
      Alert.alert(t('common.error'), t('admin.payments.failedToLoadTeams'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch monthly payments for all teams
  const fetchAllTeamsPayments = async (year: number, month: number) => {
    try {
      setIsLoading(true);
      
      console.log("Fetching payments for all teams");
      
      // Get the current user's club ID first
      const { data: { user } } = await supabase.auth.getUser();
      console.log('DEBUG: Current admin user ID', user?.id, 'email', user?.email);
      const clubId = await getUserClubId();
      console.log('DEBUG: clubId', clubId);
      if (!clubId) {
        console.error('No club found for user');
        return;
      }
      
      // Fetch all active players with their teams, regardless of team selection
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          teams:team_id(name)
        `)
        .eq('is_active', true)
        .eq('club_id', clubId);
      const playerIds = playersData ? playersData.map((p: any) => p.id) : [];
      console.log('DEBUG: playerIds for payments query', playerIds);
      
      if (playersError) {
        console.error("Error fetching players:", playersError);
        throw playersError;
      }
      
      console.log(`Found ${playersData?.length || 0} active players across all teams`);
      
      if (!playersData || playersData.length === 0) {
        setPlayers([]);
        setStats({
          totalPlayers: 0,
          paidPlayers: 0,
          unpaidPlayers: 0
        });
        setIsLoading(false);
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
          payment_status: 'unpaid' as 'paid' | 'unpaid',
          payment_updated_at: null,
          payment_updated_by: null
        }));
        
        setPlayers(transformedPlayers);
        
        // All unpaid for future months
        setStats({
          totalPlayers: transformedPlayers.length,
          paidPlayers: 0,
          unpaidPlayers: transformedPlayers.length
        });
        
        // Fetch attendance data for these players across all teams
        fetchAttendanceData(year, month, transformedPlayers);
        setIsLoading(false);
        return;
      }
      
      // For current or past months, fetch actual payment data
      // Fetch monthly payments for these players
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
      
      console.log(`Found ${paymentsData?.length || 0} payment records for the selected month`);
      
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
      
      // Transform player data with payment status
      const transformedPlayers = (playersData || []).map((player: any) => {
        // Find payment record for this player for the selected month
        const paymentInfo = (paymentsData || []).find((p: any) => p.player_id === player.id) || { status: 'unpaid', updated_at: null, updated_by: null };
        return {
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: paymentInfo.status as 'paid' | 'unpaid',
          payment_updated_at: paymentInfo.updated_at,
          payment_updated_by: paymentInfo.updated_by,
          payment_method: paymentInfo.payment_method ?? undefined
        };
      });
      
      console.log('DEBUG: playersData', playersData);
      console.log('DEBUG: paymentsData', paymentsData);
      console.log('DEBUG: transformedPlayers', transformedPlayers);
      
      setPlayers(transformedPlayers);
      
      // Calculate stats
      const totalPlayers = transformedPlayers.length;
      const paidPlayers = transformedPlayers.filter(p => p.payment_status === 'paid').length;
      const unpaidPlayers = totalPlayers - paidPlayers;
      
      setStats({
        totalPlayers,
        paidPlayers,
        unpaidPlayers
      });
      
      // Fetch attendance data for these players across all teams
      fetchAttendanceData(year, month, transformedPlayers);
      
    } catch (error) {
      console.error('Error fetching monthly payments:', error);
      Alert.alert(t('common.error'), t('admin.payments.failedToLoadPaymentData'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch monthly payments for a specific team
  const fetchMonthlyPayments = async (year: number, month: number, teamId: string) => {
    try {
      setIsLoading(true);
      
      // Get the current user's club ID first
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        setIsLoading(false);
        return;
      }
      
      console.log(`Fetching monthly payments for team ${teamId} in club ${clubId}`);
      
      // Fetch players for the selected team
      // IMPORTANT: Always filter by club_id to ensure proper data isolation between clubs
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          teams:team_id(name)
        `)
        .eq('team_id', teamId)
        .eq('club_id', clubId) // Add club_id filter to ensure data isolation
        .eq('is_active', true);
      
      if (playersError) throw playersError;
      
      if (!playersData || playersData.length === 0) {
        setPlayers([]);
        setStats({
          totalPlayers: 0,
          paidPlayers: 0,
          unpaidPlayers: 0
        });
        setIsLoading(false);
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
          payment_status: 'unpaid' as 'paid' | 'unpaid',
          payment_updated_at: null,
          payment_updated_by: null
        }));
        
        setPlayers(transformedPlayers);
        
        // All unpaid for future months
        setStats({
          totalPlayers: transformedPlayers.length,
          paidPlayers: 0,
          unpaidPlayers: transformedPlayers.length
        });
        
        // Fetch attendance data for this team
        fetchAttendanceData(year, month, transformedPlayers, teamId);
        setIsLoading(false);
        return;
      }
      
      // For current or past months, fetch actual payment data
      // Fetch monthly payments for these players
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('player_id', playersData.map((p: any) => p.id));
      
      if (paymentsError) throw paymentsError;
      
      // Fetch all months' payment data for these players
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from('monthly_payments')
        .select('player_id, year, month, status')
        .in('player_id', playersData.map((p: any) => p.id));
      if (allPaymentsError) throw allPaymentsError;
      
      // Build a map: { 'YYYY-M': { paid: X, total: Y } }
      const statusMap: { [key: string]: { paid: number; total: number } } = {};
      playersData.forEach((player: any) => {
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${m}`;
          if (!statusMap[key]) statusMap[key] = { paid: 0, total: 0 };
          statusMap[key].total++;
        }
      });
      (allPayments || []).forEach((payment: any) => {
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
      
      // Transform player data with payment status
      const transformedPlayers = (playersData || []).map((player: any) => {
        // Find payment record for this player for the selected month
        const paymentInfo = (paymentsData || []).find((p: any) => p.player_id === player.id) || { status: 'unpaid', updated_at: null, updated_by: null };
        return {
          id: player.id,
          player_id: player.id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: player.teams?.name || 'Unknown Team',
          payment_status: paymentInfo.status as 'paid' | 'unpaid',
          payment_updated_at: paymentInfo.updated_at,
          payment_updated_by: paymentInfo.updated_by,
          payment_method: paymentInfo.payment_method ?? undefined
        };
      });
      
      console.log('DEBUG: playersData', playersData);
      console.log('DEBUG: paymentsData', paymentsData);
      console.log('DEBUG: transformedPlayers', transformedPlayers);
      
      setPlayers(transformedPlayers);
      
      // Calculate stats
      const totalPlayers = transformedPlayers.length;
      const paidPlayers = transformedPlayers.filter(p => p.payment_status === 'paid').length;
      const unpaidPlayers = totalPlayers - paidPlayers;
      
      setStats({
        totalPlayers,
        paidPlayers,
        unpaidPlayers
      });
      
      // Fetch attendance data for this team
      fetchAttendanceData(year, month, transformedPlayers, teamId);
      
    } catch (error) {
      console.error('Error fetching monthly payments:', error);
      Alert.alert(t('common.error'), t('admin.payments.failedToLoadPaymentData'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // New function to fetch attendance data
  const fetchAttendanceData = async (year: number, month: number, playersList: Player[], teamId?: string) => {
    try {
      // Get the current user's club ID first
      const clubId = await getUserClubId();
      if (!clubId) {
        console.error('No club found for user');
        return;
      }
      
      // Calculate the start and end dates for the selected month
      const monthIndex = month - 1; // Convert to 0-based month
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0); // Last day of the month
      
      // Format dates for the query
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`Fetching attendance data from ${startDateStr} to ${endDateStr} for club ${clubId}`);
      
      // Prepare query for activities
      // IMPORTANT: Always filter by club_id to ensure proper data isolation between clubs
      // IMPORTANT: Only count training activities for attendance on payments page
      let activitiesQuery = supabase
        .from('activities')
        .select('id, start_time, type')
        .eq('club_id', clubId) // Add club_id filter to ensure data isolation
        .eq('type', 'training') // Only count training activities
        .gte('start_time', startDateStr)
        .lte('start_time', endDateStr);
      
      if (teamId) {
        activitiesQuery = activitiesQuery.eq('team_id', teamId);
      }
      
      const { data: activitiesData, error: activitiesError } = await activitiesQuery;
      
      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        throw activitiesError;
      }
      
      console.log(`Found ${activitiesData?.length || 0} activities for period (${month}/${year})`);
      if (activitiesData && activitiesData.length > 0) {
        console.log(`Activities by type: ${
          activitiesData.reduce((acc: {[key: string]: number}, activity: any) => {
            const type = activity.type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})}`);
      }
      
      // If no activities, set empty attendance data
      if (!activitiesData || activitiesData.length === 0) {
        const emptyAttendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
        playersList.forEach(player => {
          emptyAttendance[player.id] = { present: 0, absent: 0, total: 0, percentage: 0 };
        });
        
        // Update players with attendance data
        setPlayers(playersList.map(player => ({
          ...player,
          attendance: { present: 0, absent: 0, total: 0, percentage: 0 }
        })));
        
        return;
      }
      
      // Get activity IDs
      const activityIds = activitiesData.map((a: any) => a.id);
      console.log("Activity IDs to fetch attendance for:", activityIds);
      
      // Ensure we're only getting official coach-marked attendance, not parent RSVPs
      console.log("IMPORTANT: Only fetching official coach-marked attendance records from activity_attendance table");
      
      // Fetch attendance records for these activities
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')  // This is the official coach-marked attendance
        .select('activity_id, player_id, status')
        .in('activity_id', activityIds);
      
      if (attendanceError) {
        console.error("Error fetching attendance:", attendanceError);
        throw attendanceError;
      }
      
      console.log(`Found ${attendanceData?.length || 0} attendance records`);
      if (attendanceData && attendanceData.length > 0) {
        console.log("Sample attendance data:", attendanceData.slice(0, 3));
      }
      
      // Calculate attendance for each player
      const attendance: {[playerId: string]: {present: number, absent: number, total: number, percentage: number}} = {};
      
      playersList.forEach(player => {
        // Only include attendance records for activities in the valid list
        const playerAttendance = (attendanceData || []).filter((a: any) => {
          return a.player_id === player.id && activityIds.includes(a.activity_id);
        });
        
        const present = playerAttendance.filter((a: any) => a.status === 'present').length;
        const absent = playerAttendance.filter((a: any) => a.status === 'absent').length;
        const total = playerAttendance.length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        
        // Also calculate stats by activity type for debugging
        const attendanceByType: {[type: string]: {present: number, absent: number, total: number}} = {};
        
        // Group activities by type
        const activitiesByType: {[type: string]: string[]} = {};
        (activitiesData || []).forEach((activity: any) => {
          const type = activity.type || 'unknown';
          if (!activitiesByType[type]) activitiesByType[type] = [];
          activitiesByType[type].push(activity.id);
        });
        
        // Calculate attendance by type
        Object.entries(activitiesByType).forEach(([type, ids]) => {
          const typeAttendance = playerAttendance.filter((a: any) => 
            ids.includes(a.activity_id) && a.status === 'present'
          ).length;
          attendanceByType[type] = {
            present: typeAttendance,
            absent: playerAttendance.filter((a: any) => 
              ids.includes(a.activity_id) && a.status === 'absent'
            ).length,
            total: playerAttendance.filter((a: any) => 
              ids.includes(a.activity_id)
            ).length
          };
        });
        
        // Log attendance by type for debugging
        if (player.id === playersList[0]?.id) {
          console.log(`Attendance by type for first player (${player.player_name}):`, attendanceByType);
        }
        
        attendance[player.id] = { present, absent, total, percentage };
      });
      
      // Update players with attendance data
      setPlayers(playersList.map(player => ({
        ...player,
        attendance: attendance[player.id] || { present: 0, absent: 0, total: 0, percentage: 0 }
      })));
      
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };
  
  // Modify the handleTeamSelect function to remove the "All Teams" option
  const handleTeamSelect = (teamId: string) => {
    console.log(`Team selected: ${teamId}`);
    setSelectedTeamId(teamId);
    setIsTeamModalVisible(false);
    
    // Fetch data for the selected team
    if (selectedMonth) {
      console.log(`Fetching data for team ${teamId} and month ${selectedMonth.value}/${selectedMonth.year}`);
      fetchMonthlyPayments(selectedMonth.year, selectedMonth.value, teamId);
    } else {
      console.log('Could not fetch data: selectedMonth is missing', { selectedMonth });
    }
  };
  
  // Handle search input
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };
  
  // Filter players based on search query
  const filteredPlayers = players.filter(player => {
    const matchesSearch = !searchQuery || 
      player.player_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Format date for display
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
        Alert.alert(t('common.error'), t('admin.payments.mustBeLoggedInToSendReminders'));
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
          senderType: 'admin'
        }
      });
      
      if (error) throw error;
      
      // Show success message
      setToastMessage(data.message || t('admin.payments.paymentReminderSent'));
      setShowToast(true);
      
      // Hide toast after 3 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      Alert.alert(t('common.error'), t('admin.payments.failedToSendPaymentReminder'));
    }
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Fixed Month Selector - REPLACE the old horizontal chip selector with the new stepper/modal UI */}
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
              {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : t('admin.payments.selectTeam')}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
          
          {/* Add empty state message when no team is selected */}
          {!selectedTeamId && (
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="arrow-up-drop-circle" size={48} color={COLORS.primary} />
              <Text style={styles.emptyStateText}>{t('admin.payments.pleaseSelectTeamToViewPayments')}</Text>
            </View>
          )}
          
          {/* Search Bar - Only show when a team is selected */}
          {selectedTeamId && (
            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('admin.payments.searchPlayer')}
                placeholderTextColor={COLORS.grey[400]}
                value={searchQuery}
                onChangeText={handleSearchChange}
              />
            </View>
          )}
          
          {/* Stats Summary */}
          {selectedTeamId && (
            <>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                  <Text style={styles.statLabel}>{t('admin.payments.paid')}</Text>
                  <Text style={styles.statValue}>{stats.paidPlayers}</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                  <Text style={styles.statLabel}>{t('admin.payments.notPaid')}</Text>
                  <Text style={styles.statValue}>{stats.unpaidPlayers}</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
                  <Text style={styles.statLabel}>{t('admin.payments.total')}</Text>
                  <Text style={styles.statValue}>{stats.totalPlayers}</Text>
                </View>
              </View>
              
              {/* Player List */}
              <View style={styles.playersContainer}>
                {filteredPlayers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="account-off" size={48} color={COLORS.grey[400]} />
                    <Text style={styles.emptyStateText}>{t('admin.payments.noPlayersFound')}</Text>
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
                        {/* Player Name and Team */}
                        <View style={styles.playerHeader}>
                          <View style={styles.playerInfo}>
                            <MaterialCommunityIcons name="account" size={24} color={COLORS.text} style={styles.playerIcon} />
                            <View>
                              <Text style={styles.playerName}>{player.player_name}</Text>
                              <Text style={styles.teamName}>{player.team_name}</Text>
                            </View>
                          </View>
                          
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
                              {player.payment_status === 'paid' ? t('admin.payments.paid') : t('admin.payments.notPaid')}
                            </Text>
                          </View>
                          
                          {/* Payment reminder bell icon - only show for unpaid players */}
                          {player.payment_status !== 'paid' && (
                            <TouchableOpacity 
                              style={styles.reminderButton}
                              onPress={() => sendPaymentReminder(player)}
                              accessibilityLabel={t('admin.payments.sendPaymentReminder')}
                            >
                              <MaterialCommunityIcons 
                                name="bell" 
                                size={20} 
                                color={COLORS.warning} 
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        {/* Payment Update Info - Show only for paid payments */}
                        {player.payment_status === 'paid' && player.payment_updated_at && (
                          <View style={styles.paymentUpdateContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.grey[600]} />
                            <Text style={styles.paymentUpdateText}>
                              {t('admin.payments.paidOn')} {formatDate(player.payment_updated_at)}
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
                                  {player.payment_method === 'cash' && t('admin.payments.cash')}
                                  {player.payment_method === 'voucher_cash' && t('admin.payments.voucherCash')}
                                  {player.payment_method === 'bank_transfer' && t('admin.payments.bankTransfer')}
                                  {!['cash','voucher_cash','bank_transfer'].includes(player.payment_method) && player.payment_method}
                                </Text>
                              </View>
                            )}
                          </View>
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
                <Text style={styles.modalTitle}>{t('admin.payments.selectTeam')}</Text>
                <TouchableOpacity 
                  onPress={() => setIsTeamModalVisible(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {/* Team options */}
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

        {/* Month Picker Modal - Add after the main view, before SafeAreaView close */}
        <Modal
          visible={isMonthPickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsMonthPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderRadius: 0, padding: 24, width: '100%', maxWidth: undefined, alignSelf: undefined, margin: 0 }]}> 
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 }}>{t('admin.payments.selectMonth')}</Text>
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
                        { width: '30%', maxWidth: 110, minWidth: 90, height: 56, margin: '1.5%' }
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
        
        {/* Toast Notification */}
        {showToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
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
    paddingHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.grey[600],
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  // Player card styles
  playerCard: {
    marginBottom: SPACING.sm,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  playerCardContent: {
    padding: SPACING.md,
    paddingVertical: SPACING.sm,
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
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
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
  // Attendance styles
  attendanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  attendanceText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginLeft: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.grey[700],
    marginBottom: SPACING.sm,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: SPACING.lg,
  },
  monthGridItem: {
    position: 'relative',
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridItemSelected: {
    backgroundColor: COLORS.primary + '15',
  },
  monthGridItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.grey[600],
  },
  monthGridItemTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  attendanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  reminderButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: COLORS.warning + '20',
    marginLeft: SPACING.sm,
  },
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
}); 