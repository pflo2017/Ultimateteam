import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerEventListener } from '../../utils/events';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { getPlayerPaymentStatus, getPlayerPaymentHistory, getPaymentStatusText, getPaymentStatusColor, getCurrentMonthPaymentStatus } from '../../services/paymentStatusService';
import { PaymentHistoryModal } from '../../components/PaymentHistoryModal';

interface Child {
  id: string;
  full_name: string;
  player_id?: string;
  team_id: string;
  team_name: string;
  medical_visa_status: string;
  payment_status?: string;
  last_payment_date?: string;
}

interface PaymentHistory {
  id: string;
  player_id: string;
  year: number;
  month: number;
  status: string;
  updated_at: string;
}

interface HistoryMonth {
  year: number;
  month: number;
  date: Date;
}

interface Player {
  id: string;
  name: string;
  parent_id?: string;
  team_id?: string;
  payment_status?: string;
  player_status?: string;
  last_payment_date?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const ParentPaymentsScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isPaymentHistoryModalVisible, setIsPaymentHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMonths, setHistoryMonths] = useState<HistoryMonth[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  // Use data refresh hook to refresh when payment status changes
  useDataRefresh('players', () => {
    console.log("[ParentPaymentsScreen] Payment status change detected - refreshing data");
    loadChildren();
  });
  
  // Use data refresh hook for payments changes as well
  useDataRefresh('payments', () => {
    console.log("[ParentPaymentsScreen] Payment data change detected - refreshing data");
    loadChildren();
    
    // Also refresh payment history if a child is selected
    if (selectedChild && selectedChild.player_id) {
      // Only refresh data without reopening modal
      refreshPaymentHistoryWithoutModal(selectedChild);
    }
  });
  
  // Add event listener for payment status changes
  useEffect(() => {
    const handlePaymentStatusChange = async (playerId: string, newStatus: string, lastPaymentDate: string | null) => {
      // Validate the date if provided
      let validatedDate = null;
      if (lastPaymentDate) {
        validatedDate = isValidDate(lastPaymentDate) ? lastPaymentDate : new Date().toISOString();
      }
      
      // Clear any cached data to force fresh data on next load
      try {
        await AsyncStorage.removeItem('players_cache');
      } catch (err) {
        console.error('Failed to clear cache:', err);
      }
      
      // Force a fresh data load from the server
      await loadChildren();
      
      // Also update the local state
      setChildren(prevChildren => 
        prevChildren.map(child => {
          if (child.player_id === playerId) {
            return { 
              ...child, 
              payment_status: newStatus,
              last_payment_date: validatedDate || child.last_payment_date
            };
          }
          return child;
        })
      );
    };

    // Add event listener and get the unregister function
    const unregister = registerEventListener('payment_status_changed', handlePaymentStatusChange);

    // Clean up the listener when component unmounts
    return () => {
      unregister();
    };
  }, []);
  
  useFocusEffect(
    React.useCallback(() => {
      loadChildren();
      
      if (selectedChild && isPaymentHistoryModalVisible) {
        refreshPaymentHistoryWithoutModal(selectedChild);
      }
      
      return () => {};
    }, [selectedChild, isPaymentHistoryModalVisible])
  );
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadChildren();
    
    if (selectedChild && isPaymentHistoryModalVisible) {
      await refreshPaymentHistoryWithoutModal(selectedChild);
    }
    
    setRefreshing(false);
  };
  
  const loadChildren = async () => {
    try {
      setIsLoading(true);
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('No parent data found');
      
      const parent = JSON.parse(parentData);
      
      console.log("[ParentPaymentsScreen] Loading children for parent:", parent.id);
      setDebugInfo(prev => prev + `\nLoading children for parent: ${parent.id}`);
      
      // Force clear any cached data
      try {
        await AsyncStorage.removeItem('players_cache');
      } catch (err) {
        console.error('Failed to clear cache:', err);
      }
      
      // Get parent's children first to ensure we have the correct names
      const { data: childrenData, error: childrenError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', parent.id)
        .eq('is_active', true);
        
      if (childrenError) {
        console.error('Error fetching parent_children:', childrenError);
        setDebugInfo(prev => prev + `\nError fetching parent_children: ${childrenError.message}`);
        throw childrenError;
      }
      
      console.log("[ParentPaymentsScreen] Found children in parent_children:", childrenData?.length || 0);
      setDebugInfo(prev => prev + `\nFound ${childrenData?.length || 0} children in parent_children`);
      
      if (!childrenData || childrenData.length === 0) {
        setChildren([]);
        setIsLoading(false);
        return;
      }
      
      if (childrenData) {
        childrenData.forEach(child => {
          console.log("[ParentPaymentsScreen] Child from parent_children:", JSON.stringify(child, null, 2));
        });
      }
      
      // CRITICAL FIX: Force RPC call to ensure we're getting fresh data
      // This bypasses any caching that might be happening
      console.log("[ParentPaymentsScreen] Making direct query for all players");

      // Make a direct query to get players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (playersError) {
        console.error('Error fetching players:', playersError);
        setDebugInfo(prev => prev + `\nPlayers query error: ${playersError.message}`);
        throw playersError;
      }
      
      const allPlayers = playersData || [];
      console.log("[ParentPaymentsScreen] Successfully fetched players:", allPlayers?.length || 0);
      
      // Filter to only the active players with this parent's ID
      const parentPlayers = allPlayers?.filter((player: Player) => 
        player.is_active && player.parent_id === parent.id
      ) || [];
      
      console.log("[ParentPaymentsScreen] Filtered parent players:", parentPlayers.length);
      setDebugInfo(prev => prev + `\nFiltered to ${parentPlayers.length} players for this parent`);
      
      // Get teams info
      const teamIds = [...new Set(childrenData.map(child => child.team_id))];
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
        
      if (teamsError) throw teamsError;
      
      // Create a map of team ids to team names
      const teamMap = new Map();
      teamsData.forEach(team => {
        teamMap.set(team.id, team.name);
      });
      
      // Process all children with player details
      const enhancedChildren = await Promise.all(childrenData.map(async (child) => {
        // Find matching player by name
        const player = parentPlayers.find(p => 
          p.name?.toLowerCase() === child.full_name.toLowerCase()
        );
        
        if (player) {
          console.log(`[ParentPaymentsScreen] Processing player: ${player.name}`);
          
          // IMPORTANT: Get the CURRENT MONTH payment status specifically
          const currentMonthStatus = await getCurrentMonthPaymentStatus(player.id);
          console.log(`[ParentPaymentsScreen] Current month status for ${player.name}: ${currentMonthStatus}`);
          
          return {
            ...child,
            team_name: teamMap.get(child.team_id) || 'No Team',
            player_id: player.id,
            payment_status: currentMonthStatus, // Use current month status for the card
            last_payment_date: player.last_payment_date
          };
        } else {
          // No matching player found
          return {
            ...child,
            team_name: teamMap.get(child.team_id) || 'No Team',
            payment_status: 'unpaid',
            last_payment_date: null
          };
        }
      }));
      
      enhancedChildren.forEach(child => {
        console.log(`[ParentPaymentsScreen] Enhanced child:`, JSON.stringify({
          name: child.full_name,
          player_id: child.player_id,
          payment_status: child.payment_status
        }, null, 2));
      });
      
      setChildren(enhancedChildren);
    } catch (error) {
      console.error('Error loading children:', error);
      setDebugInfo(prev => prev + `\nError: ${(error as Error).message}`);
      Alert.alert('Error', 'Failed to load children and payment information');
    } finally {
      setIsLoading(false);
    }
  };
  
  const closePaymentHistoryModal = () => {
    setIsPaymentHistoryModalVisible(false);
    // Clear selected child and payment history when closing the modal
    // to prevent stale data from being displayed if modal is reopened
    setTimeout(() => {
      if (!isPaymentHistoryModalVisible) {
        setSelectedChild(null);
        setPaymentHistory([]);
      }
    }, 500); // Small delay to ensure modal is closed first
  };
  
  // New function that refreshes payment history data without showing the modal
  const refreshPaymentHistoryWithoutModal = async (child: Child) => {
    try {
      setHistoryLoading(true);
      
      console.log("[ParentPaymentsScreen] Refreshing payment history data for:", 
        child.player_id, "Name:", child.full_name);
      
      // Get current date info
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-12
      
      // Generate all months for the current year up to and including the current month
      const months = [];
      for (let m = 1; m <= currentMonth; m++) {
        months.push({ year: currentYear, month: m, date: new Date(currentYear, m - 1, 1) });
      }
      months.reverse();
      setHistoryMonths(months);
      
      // Get the latest player data
      const { data: latestPlayerData, error: playerError } = await supabase
        .from('players')
        .select('id, payment_status, player_status, last_payment_date')
        .eq('id', child.player_id)
        .maybeSingle();
        
      if (!playerError && latestPlayerData) {
        // Update the child data with fresh status
        const freshStatus = latestPlayerData.payment_status || latestPlayerData.player_status || 'pending';
        
        // Update our children array with this fresh data
        setChildren(prev => prev.map(c => 
          c.player_id === child.player_id 
            ? {...c, payment_status: freshStatus, last_payment_date: latestPlayerData.last_payment_date}
            : c
        ));
      }
      
      // Fetch payment history data
      const { data, error } = await supabase
        .from('player_payments')
        .select('id, player_id, year, month, status, updated_at')
        .eq('player_id', child.player_id)
        .eq('year', currentYear) // Only get current year
        .order('month', { ascending: false });
      
      if (!error && data) {
        if (data.length === 0 && child.payment_status && child.player_id) {
          // If no payment records found in database, but the player has a current status,
          // create a virtual record for the current month
          const virtualRecord: PaymentHistory = {
            id: `virtual-${Date.now()}`,
            player_id: child.player_id,
            year: currentYear,
            month: currentMonth,
            status: child.payment_status,
            updated_at: new Date().toISOString()
          };
          
          console.log("[ParentPaymentsScreen] No payment records found in DB. Creating virtual current month record:", 
            JSON.stringify(virtualRecord, null, 2));
          
          // Set the payment history to include this virtual record
          setPaymentHistory([virtualRecord]);
        } else {
          // Process the payment history data and update state
          setPaymentHistory(data);
        }
      }
    } catch (error) {
      console.error('Error refreshing payment history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const fetchPaymentHistory = async (child: Child) => {
    // Don't open the modal if it's already open - this prevents re-render loops
    if (isPaymentHistoryModalVisible) {
      console.log("[ParentPaymentsScreen] Modal already open, not reopening");
      return;
    }
    
    try {
      setHistoryLoading(true);
      setSelectedChild(child);
      
      console.log("[ParentPaymentsScreen] Fetching payment history for player:", 
        child.player_id, "Name:", child.full_name);
      setDebugInfo(prev => prev + `\nFetching history for: ${child.full_name}`);
      
      // First check if we're using a hardcoded player ID
      if (!child.player_id || (child.player_id && child.player_id.startsWith('hdcoded-'))) {
        console.log("[ParentPaymentsScreen] Using hardcoded data for payment history");
        setDebugInfo(prev => prev + `\nUsing hardcoded data for payment history`);
        
        // If we're using hardcoded data, create a complete payment history for all months
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12 format
        
        // Create months for the current year
        const months = [];
        for (let i = 1; i <= currentMonth; i++) {
          months.push({
            year: currentYear,
            month: i,
            date: new Date(currentYear, i-1, 1)
          });
        }
        
        // Reverse to show most recent first
        months.reverse();
        setHistoryMonths(months);
        
        // Generate payment history for ALL months with the current status
        const playerId = child.player_id || `hdcoded-${child.full_name.toLowerCase().replace(/\s/g, '-')}-id`;
        const currentStatus = child.payment_status === 'paid' ? 'paid' : 'not_paid';
        
        const historyRecords: PaymentHistory[] = months.map(({ year, month }) => ({
          id: `virtual-${Date.now()}-${month}`,
          player_id: playerId,
          year: year,
          month: month,
          status: currentStatus,
          updated_at: new Date().toISOString()
        }));
        
        console.log("[ParentPaymentsScreen] Hardcoded payment history for all months:", 
          JSON.stringify(historyRecords, null, 2));
        setPaymentHistory(historyRecords);
        setHistoryLoading(false);
        setIsPaymentHistoryModalVisible(true);
        return;
      }
      
      // We have a valid player_id, proceed with normal loading
      await loadPaymentHistory(child);
    } catch (error) {
      console.error('Error preparing payment history:', error);
      setDebugInfo(prev => prev + `\nError: ${(error as Error).message}`);
      Alert.alert('Error', 'Failed to load payment history');
      setHistoryLoading(false);
    }
  };
  
  // Updated loadPaymentHistory function to ensure consistent display
  const loadPaymentHistory = async (child: Child) => {
    if (!child.player_id) {
      setHistoryLoading(false);
      return;
    }
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    // Generate all months for the current year up to the current month
    const months = [];
    for (let m = 1; m <= currentMonth; m++) {
      months.push({ year: currentYear, month: m, date: new Date(currentYear, m - 1, 1) });
    }
    months.reverse();
    setHistoryMonths(months);
    try {
      // Fetch all payment records for this player for the current year
      const { data, error } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('player_id', child.player_id)
        .eq('year', currentYear);
      if (error) throw error;
      const recordsByMonth: Record<string, any> = {};
      (data || []).forEach(record => {
        recordsByMonth[`${record.year}-${record.month}`] = record;
      });
      // Build the history for each month
      const processedHistory: PaymentHistory[] = months.map(({ year, month }) => {
        const key = `${year}-${month}`;
        if (recordsByMonth[key]) {
          return {
            id: `${year}-${month}`,
            player_id: child.player_id as string,
            year,
            month,
            status: recordsByMonth[key].status,
            updated_at: recordsByMonth[key].updated_at
          };
        } else {
          return {
            id: `virtual-${year}-${month}`,
            player_id: child.player_id as string,
            year,
            month,
            status: 'not_paid',
            updated_at: null
          };
        }
      });
      setPaymentHistory(processedHistory);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
      setIsPaymentHistoryModalVisible(true);
    }
  };
  
  // Add these helper functions near the top of the component, just after the state declarations
  const isValidDate = (dateString: string | undefined): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };
  
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB');
    } catch (e) {
      console.error('Error formatting date:', dateString, e);
      return 'N/A';
    }
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>
          Manage and view your children's payment history
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.sectionTitle}>Payment Status</Text>
        
        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-off" size={48} color={COLORS.grey[400]} />
            <Text style={styles.emptyStateText}>No children added yet</Text>
          </View>
        ) : (
          children.map((child) => {
            // Ensure the status is clearly logged before display
            console.log(`[ParentPaymentsScreen] Displaying status for ${child.full_name}:`, child.payment_status);
            
            return (
              <Card key={child.id} style={styles.childCard}>
                <Card.Content>
                  <View style={styles.childHeader}>
                    <View style={styles.childInfo}>
                      <MaterialCommunityIcons name="account-circle" size={40} color={COLORS.primary} />
                      <View style={styles.childDetails}>
                        <Text style={styles.childName}>{child.full_name}</Text>
                        <Text style={styles.teamName}>{child.team_name}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.paymentSection}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Current Payment Status:</Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getPaymentStatusColor(child.payment_status || 'pending') + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: getPaymentStatusColor(child.payment_status || 'pending') }
                        ]}>
                          {getPaymentStatusText(child.payment_status || 'pending')}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Last Payment:</Text>
                      <Text style={styles.paymentValue}>
                        {child.last_payment_date && isValidDate(child.last_payment_date) 
                          ? formatDate(child.last_payment_date) 
                          : 'N/A'}
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.viewHistoryButton}
                      onPress={() => {
                        setSelectedChild(child);
                        setIsPaymentHistoryModalVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="history" size={20} color={COLORS.white} />
                      <Text style={styles.viewHistoryText}>View Payment History</Text>
                    </TouchableOpacity>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>
      
      {/* Payment History Modal (shared) */}
      <PaymentHistoryModal
        visible={isPaymentHistoryModalVisible}
        onClose={closePaymentHistoryModal}
        playerId={selectedChild?.player_id || ''}
        playerName={selectedChild?.full_name || ''}
        teamName={selectedChild?.team_name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: SPACING.xl,
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  childCard: {
    marginBottom: SPACING.md,
    elevation: 2,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childDetails: {
    marginLeft: SPACING.md,
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  teamName: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  paymentSection: {
    backgroundColor: '#FAFAFA',
    padding: SPACING.md,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  paymentLabel: {
    fontSize: 14,
    color: COLORS.grey[700],
  },
  paymentValue: {
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
  headerStatusBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    alignSelf: 'flex-end',
  },
  viewHistoryText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyStateText: {
    color: COLORS.grey[600],
    marginTop: SPACING.md,
    textAlign: 'center',
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
    width: '100%',
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
  paymentHistoryHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  playerDetailName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  teamDetailName: {
    fontSize: 16,
    color: COLORS.grey[600],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  detailsContainer: {
    padding: SPACING.lg,
  },
  detailsSection: {
    marginHorizontal: 0,
    marginBottom: SPACING.xl,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#F5FBFF',
    padding: SPACING.md,
    borderRadius: 8,
    marginHorizontal: 0,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  emptyHistoryText: {
    textAlign: 'center',
    color: COLORS.grey[600],
    marginVertical: SPACING.lg,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: '#00BDF2', // Turquoise color matching admin design
    marginLeft: SPACING.md, // Add margin to title only
  },
}); 