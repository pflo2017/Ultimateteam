import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  background: '#fff',
  text: '#222',
  primary: '#00BDF2',
  error: '#F44336',
  success: '#4BB543',
  grey: { 600: '#757575', 200: '#eeeeee' },
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const FONT_SIZES = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };

const getPaymentStatusText = (status: string) => {
  if (!status) return 'Not Paid';
  return status.toLowerCase() === 'paid' ? 'Paid' : 'Not Paid';
};
const getPaymentStatusColor = (status: string) => {
  return status?.toLowerCase() === 'paid' ? COLORS.success : COLORS.error;
};
const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <View style={[
    styles.statusPill, 
    { backgroundColor: getPaymentStatusColor(status) + '20' }
  ]}>
    <Text style={[
      styles.statusPillText, 
      { color: getPaymentStatusColor(status) }
    ]}>
      {getPaymentStatusText(status)}
    </Text>
  </View>
);

interface PaymentHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  teamName?: string;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({ visible, onClose, playerId, playerName, teamName }) => {
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debug, setDebug] = useState<string>('');

  useEffect(() => {
    if (!visible || !playerId) return;
    
    const fetchPaymentHistory = async () => {
      setIsLoading(true);
      console.log(`[PaymentHistoryModal] Fetching payment history for player: ${playerId}`);
      
      try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Generate month data for current and previous months only
        const months = [];
        for (let m = 1; m <= currentMonth; m++) {
          months.push({ 
            year: currentYear, 
            month: m,
            monthName: new Date(currentYear, m-1).toLocaleString('default', { month: 'long' })
          });
        }
        // Reverse to show most recent first
        months.reverse();
        
        // Get parent ID from storage
        const parentData = await AsyncStorage.getItem('parent_data');
        const { data: authData } = await supabase.auth.getSession();
        const authUserId = authData?.session?.user?.id;
        
        let parentId = authUserId;
        if (parentData) {
          const parent = JSON.parse(parentData);
          parentId = parent.id;
        }
        
        console.log(`[PaymentHistoryModal] Using parent ID: ${parentId} for player ${playerId}`);
        
        // Call the RPC function instead of direct table access
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_player_payment_history',
          {
            p_player_id: playerId,
            p_parent_id: parentId,
            p_year: currentYear // Dynamically use current year
          }
        );
        
        if (rpcError) {
          console.error(`[PaymentHistoryModal] RPC error:`, rpcError);
          throw rpcError;
        }
        
        console.log(`[PaymentHistoryModal] Received ${rpcData?.length || 0} history records from function`);
        
        // Process the JSON returned by the function
        const recordsByMonth: Record<string, any> = {};
        if (rpcData && rpcData.length > 0) {
          rpcData.forEach((item: any) => {
            // Handle both string and object formats from RPC
            const record = typeof item === 'string' ? JSON.parse(item) : item;
            const key = `${record.year}-${record.month}`;
            recordsByMonth[key] = {
              id: `${record.year}-${record.month}`,
              player_id: record.player_id,
              year: record.year,
              month: record.month,
              status: record.status,
              updated_at: record.updated_at
            };
          });
        }
        
        // Create complete history for current and previous months only
        const historyRecords = months.map(({ year, month, monthName }) => {
          const key = `${year}-${month}`;
          if (recordsByMonth[key]) {
            return {
              ...recordsByMonth[key],
              monthName
            };
          } else {
            // For months without records, create virtual records with not_paid status
            return {
              id: `virtual-${year}-${month}`,
              player_id: playerId,
              year,
              month,
              monthName,
              status: 'not_paid',
              updated_at: null
            };
          }
        });
        
        setPaymentHistory(historyRecords);
      } catch (err) {
        console.error(`[PaymentHistoryModal] Error fetching history:`, err);
        setDebug(prev => prev + `\nError: ${(err as Error).message}`);
        setPaymentHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPaymentHistory();
  }, [visible, playerId]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return 'Error formatting date';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.playerModalName}>{playerName}</Text>
          {teamName && <Text style={styles.teamName}>{teamName}</Text>}
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: '80%' }}>
              {paymentHistory.length === 0 ? (
                <Text style={styles.emptyText}>No payment history available</Text>
              ) : (
                paymentHistory.map((payment, index) => (
                  <View key={index} style={styles.paymentItem}>
                    <View>
                      <Text style={styles.paymentMonth}>
                        {payment.monthName} {payment.year}
                      </Text>
                      <StatusPill status={payment.status} />
                    </View>
                    {payment.updated_at ? (
                      <Text style={styles.paymentDate}>
                        {formatDate(payment.updated_at)}
                      </Text>
                    ) : (
                      <Text style={styles.paymentDate}>-</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    borderRadius: 8,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  playerModalName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  teamName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  paymentMonth: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusPillText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  paymentDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
}); 