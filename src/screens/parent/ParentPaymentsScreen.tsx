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
      
      // Get the current auth session first
      const { data: authData } = await supabase.auth.getSession();
      const authUserId = authData?.session?.user?.id;
      
      if (!authUserId) {
        console.error('[ParentPaymentsScreen] No authenticated user found');
        throw new Error('You are not logged in. Please log in again.');
      }
      
      console.log(`[ParentPaymentsScreen] Authenticated as user: ${authUserId}`);
      
      // Get parent data - but use the authenticated user ID for queries
      const parentData = await AsyncStorage.getItem('parent_data');
      let parentId = authUserId; // Default to the authenticated user ID
      
      if (parentData) {
        const storedParent = JSON.parse(parentData);
        console.log(`[ParentPaymentsScreen] Stored parent ID: ${storedParent.id}`);
        
        // Check if stored parent ID matches authenticated user
        if (storedParent.id !== authUserId) {
          console.warn(`[ParentPaymentsScreen] Stored parent ID (${storedParent.id}) does not match auth user ID (${authUserId}). Using stored parent ID for now.`);
          parentId = storedParent.id; // Use stored parent ID even if it doesn't match
        } else {
          parentId = storedParent.id;
        }
      } else {
        console.warn('[ParentPaymentsScreen] No parent data found in storage. Using authenticated user ID.');
      }
      
      console.log(`[ParentPaymentsScreen] Loading children for parent ID: ${parentId}`);
      setDebugInfo(prev => prev + `\nLoading children for parent: ${parentId}`);
      
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
        .eq('parent_id', parentId)
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
        player.is_active && player.parent_id === parentId
      ) || [];
      
      console.log('[ParentPaymentsScreen] Parent player IDs:', parentPlayers.map(p => p.id));
      setDebugInfo(prev => prev + `\nParent player IDs: ${parentPlayers.map(p => p.id).join(', ')}`);
      
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
      
      // Get current date info
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-12 format
      
      // Get all player IDs
      const playerIds = parentPlayers.map(p => p.id);
      
      // Fetch all payment statuses at once from monthly_payments table
      // This is how the coach view does it, and it works correctly
      console.log(`[ParentPaymentsScreen] Fetching all payment statuses for ${playerIds.length} players for ${currentYear}-${currentMonth}`);
      
      // Check if the parent ID in our data matches the authenticated user ID
      if (authUserId !== parentId) {
        console.warn(`[ParentPaymentsScreen] Auth user ID (${authUserId}) does not match parent ID (${parentId})`);
      }
      
      // Standard query through the API - affected by RLS
      let paymentRecords: { player_id: string; status: string; updated_at: string | null }[] = [];
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('player_id, status, updated_at')
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .in('player_id', playerIds);
      
      if (paymentsError) {
        console.error('Error fetching monthly payments:', paymentsError);
        console.log(`[ParentPaymentsScreen] Error fetching monthly payments: ${paymentsError.message}`);
      } else if (paymentsData) {
        paymentRecords = paymentsData;
      }
      
      console.log(`[ParentPaymentsScreen] Found ${paymentRecords.length || 0} payment records for current month`);
      
      // Try alternative direct SQL query approach - might bypass RLS
      try {
        console.log(`[ParentPaymentsScreen] Trying direct SQL query as fallback`);
        const { data: sqlData, error: sqlError } = await supabase.rpc('get_parent_payments', {
          p_parent_id: parentId,
          p_year: currentYear,
          p_month: currentMonth
        });
        
        if (sqlError) {
          console.error(`[ParentPaymentsScreen] SQL query error: ${sqlError.message}`);
        } else {
          console.log(`[ParentPaymentsScreen] Direct SQL query found ${sqlData?.length || 0} records:`, JSON.stringify(sqlData));
          
          // If we got data from SQL but not from the standard query, use this data instead
          if (sqlData && sqlData.length > 0 && paymentRecords.length === 0) {
            console.log(`[ParentPaymentsScreen] Using SQL query results instead of standard query`);
            
            // Process JSON results from the SQL function
            paymentRecords = sqlData.map((item: any) => {
              console.log(`[ParentPaymentsScreen] Processing SQL item:`, JSON.stringify(item));
              // The item might be a JSON string or an object, handle both cases
              const record = typeof item === 'string' ? JSON.parse(item) : item;
              return {
                player_id: record.player_id,
                status: record.status,
                updated_at: record.updated_at
              };
            });
            
            console.log(`[ParentPaymentsScreen] Processed ${paymentRecords.length} SQL records`);
          }
        }
      } catch (sqlException) {
        console.error(`[ParentPaymentsScreen] SQL exception:`, sqlException);
      }
      
      // Create a map of payment statuses
      const paymentMap = new Map();
      paymentRecords.forEach(payment => {
        paymentMap.set(payment.player_id, {
          status: payment.status,
          updated_at: payment.updated_at
        });
      });
      
      // Process all children with player details
      const enhancedChildren = await Promise.all(childrenData.map(async (child) => {
        // Find matching player by name
        const player = parentPlayers.find(p => 
          p.name?.toLowerCase() === child.full_name.toLowerCase()
        );
        
        // If we have player_id directly in the child record, use that
        const playerId = child.player_id || (player ? player.id : null);
        
        if (playerId) {
          console.log(`[ParentPaymentsScreen] Processing player: ${child.full_name} (ID: ${playerId})`);
          
          // Get payment status from our map instead of calling getCurrentMonthPaymentStatus
          const paymentInfo = paymentMap.get(playerId);
          const paymentStatus = paymentInfo ? paymentInfo.status : 'unpaid';
          
          console.log(`[ParentPaymentsScreen] Payment status for player ${playerId}: ${paymentStatus}`);
          
          return {
            ...child,
            team_name: teamMap.get(child.team_id) || 'No Team',
            player_id: playerId,
            payment_status: paymentStatus,
            last_payment_date: paymentInfo?.updated_at || (player ? player.last_payment_date : null)
          };
        } else {
          // No matching player found
          console.log(`[ParentPaymentsScreen] No player found for child: ${child.full_name}`);
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
        .from('monthly_payments')
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
      
      console.log("[ParentPaymentsScreen] Opening payment history for player:", 
        child.player_id, "Name:", child.full_name);
      
      // Simply open the modal - the PaymentHistoryModal component will
      // handle the data loading using the get_player_payment_history function
      setIsPaymentHistoryModalVisible(true);
    } catch (error) {
      console.error('Error preparing payment history:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
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