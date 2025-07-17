import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, Alert, Modal, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerEventListener, triggerEvent } from '../utils/events';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Placeholder: Replace with your actual theme/colors
const COLORS = {
  background: '#fff',
  text: '#222',
  primary: '#00BDF2',
  error: '#F44336',
  success: '#4BB543',
  grey: { 600: '#757575', 200: '#eeeeee' },
  white: '#fff',
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const FONT_SIZES = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };

type PlayerDetailsScreenRouteParams = {
  playerId: string;
  role: 'admin' | 'coach' | 'parent';
};

type Team = {
  name: string;
};

type Player = {
  id: string;
  name: string;
  team_id: string;
  teams: Team | null;
  team_name?: string;
  created_at: string;
  birth_date: string;
  payment_status: string;
  last_payment_date: string;
  medical_visa_status: string;
  medical_visa_issue_date?: string;
  parent_id?: string;
  payment_method?: string;
};

type Parent = {
  name: string;
  phone_number: string;
  email?: string;
};

type Attendance = {
  byType: { type: string; percent: number }[];
  monthly: number;
  total: number;
};

// Helper function to get formatted payment status text
const getPaymentStatusText = (status: string, t: any) => {
  if (!status) return t('admin.players.not_paid');
  return status.toLowerCase() === 'paid' ? t('admin.players.paid') : t('admin.players.not_paid');
};

// Helper function to get payment status color
const getPaymentStatusColor = (status: string) => {
  return status?.toLowerCase() === 'paid' ? COLORS.success : COLORS.error;
};

// Custom component for status pill display
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <View style={[
      styles.statusPill, 
      { backgroundColor: getPaymentStatusColor(status) + '20' }
    ]}>
      <Text style={[
        styles.statusPillText, 
        { color: getPaymentStatusColor(status) }
      ]}>
        {getPaymentStatusText(status, t)}
      </Text>
    </View>
  );
};

export const PlayerDetailsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, PlayerDetailsScreenRouteParams>, string>>();
  const playerId = route?.params?.playerId;
  const role = route?.params?.role;

  const [player, setPlayer] = useState<Player | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentHistoryVisible, setIsPaymentHistoryVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("Fetching player data for ID:", playerId);

        // Fetch player data with team
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select(`
            id,
            name,
            team_id,
            teams (
              name
            ),
            created_at,
            birth_date,
            payment_status,
            last_payment_date,
            medical_visa_status,
            medical_visa_issue_date,
            parent_id
          `)
          .eq('id', playerId)
          .single();

        if (playerError) {
          console.error("Error fetching player:", playerError);
          throw playerError;
        }
        
        console.log("Player data received:", playerData);
        
        // If the player doesn't have a team, fetch team data separately
        let teamName = 'No team assigned';
        if (playerData.team_id) {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', playerData.team_id)
            .single();
            
          if (!teamError && teamData) {
            teamName = teamData.name;
          }
        }

        // Fetch ALL payment records for this player, order by year/month desc
        const { data: allPayments, error: allPaymentsError } = await supabase
          .from('monthly_payments')
          .select('*')
          .eq('player_id', playerId)
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        if (allPaymentsError) throw allPaymentsError;

        // Get current year and month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Find current month's payment status
        const currentMonthPayment = allPayments?.find(p => p.year === currentYear && p.month === currentMonth);
        
        // Find the most recent paid record for last payment date
        let latestPaid = null;
        let latestPaymentMethod = null;
        if (allPayments && allPayments.length > 0) {
          latestPaid = allPayments.find(p => p.status === 'paid');
        }
        
        // Set current status based on current month
        if (currentMonthPayment) {
          playerData.payment_status = currentMonthPayment.status;
          latestPaymentMethod = currentMonthPayment.payment_method;
        } else {
          // If no current month record, default to unpaid
          playerData.payment_status = 'not_paid';
        }
        
        // Set last payment date from most recent paid record
        if (latestPaid) {
          playerData.last_payment_date = latestPaid.updated_at;
        } else {
          playerData.last_payment_date = null;
        }

        // Fetch parent data if available
        let parentData = null;
        if (playerData.parent_id) {
          const { data: pData, error: pError } = await supabase
            .from('parents')
            .select('name, phone_number, email')
            .eq('id', playerData.parent_id)
            .single();

          if (!pError) {
            parentData = pData;
          }
        }

        // Fetch attendance data
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('type, status, activity_id')
          .eq('player_id', playerId);

        if (!attendanceError && attendanceData) {
          // Calculate attendance percentages
          const totalAttendance = attendanceData.length;
          const byType = attendanceData.reduce((acc: { [key: string]: { total: number; present: number } }, curr) => {
            const type = curr.type || 'unknown';
            if (!acc[type]) {
              acc[type] = { total: 0, present: 0 };
            }
            acc[type].total++;
            if (curr.status === 'present') {
              acc[type].present++;
            }
            return acc;
          }, {});

          const attendanceByType = Object.entries(byType).map(([type, data]) => ({
            type,
            percent: Math.round((data.present / data.total) * 100)
          }));

          // Calculate monthly and total attendance
          const monthlyAttendance = attendanceByType.reduce((sum, curr) => sum + curr.percent, 0) / attendanceByType.length;
          const totalAttendancePercent = Math.round(
            (attendanceData.filter(a => a.status === 'present').length / totalAttendance) * 100
          );

          setAttendance({
            byType: attendanceByType,
            monthly: Math.round(monthlyAttendance),
            total: totalAttendancePercent
          });
        }

        // Set the player data with team name and payment_method if present
        const playerWithTeam: Player = {
          ...playerData,
          teams: playerData.teams && Array.isArray(playerData.teams)
            ? (playerData.teams.length > 0 ? { name: playerData.teams[0].name } : null)
            : playerData.teams,
          team_name: teamName,
          ...(latestPaymentMethod ? { payment_method: latestPaymentMethod } : {})
        };

        console.log('Player data with team:', playerWithTeam);
        setPlayer(playerWithTeam);
        setParent(parentData);

      } catch (err) {
        console.error('Error fetching player data:', err);
        setError('Failed to load player data');
        Alert.alert('Error', 'Could not load player details');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId]);

  const fetchPaymentHistory = async () => {
    if (!playerId) return;
    try {
      setIsLoadingPaymentHistory(true);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear(); // This will be 2024, not 2025
      const currentMonth = currentDate.getMonth() + 1; // 1-12
      
      console.log("Current date:", currentDate, "Current year:", currentYear, "Current month:", currentMonth);
      
      // Generate all months for the current year in reverse order (most recent first)
      const months = [];
      // Start with the current month and go backwards
      for (let m = currentMonth; m >= 1; m--) {
        months.push({ year: currentYear, month: m });
      }
      
      console.log("Generated months:", months.map(m => `${m.year}-${m.month}`));
      
      // Fetch payment records for this player for the current year
      const { data, error } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('player_id', playerId)
        .eq('year', currentYear);
      
      if (error) throw error;
      console.log("Fetched payment records:", data);
      
      // Build a map of records for current year and valid months only
      const recordsByMonth: Record<string, any> = {};
      (data || []).forEach(record => {
        if (record.year === currentYear && record.month <= currentMonth) {
          recordsByMonth[`${record.year}-${record.month}`] = record;
        }
      });
      console.log("Filtered records by month:", recordsByMonth);
      
      // Build history records for each month in the correct order (already in descending order)
      const historyRecords = months.map(({ year, month }) => {
        const key = `${year}-${month}`;
        if (recordsByMonth[key]) {
          return recordsByMonth[key];
        } else {
          // For any month with no record, always show Not Paid
          return {
            id: `virtual-${year}-${month}`,
            player_id: playerId,
            year,
            month,
            status: 'not_paid',
            updated_at: new Date().toISOString()
          };
        }
      });
      
      console.log("Final history records:", historyRecords.map(r => `${r.year}-${r.month}: ${r.status}`));
      setPaymentHistory(historyRecords);
      setIsPaymentHistoryVisible(true);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      Alert.alert('Error', 'Could not load payment history');
    } finally {
      setIsLoadingPaymentHistory(false);
    }
  };
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-GB');
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Error formatting date';
    }
  };

  const handleDeletePlayer = async () => {
    Alert.alert(
      "Delete Player",
      "Are you sure you want to delete this player? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              console.log("Starting deletion process for player ID:", playerId);
              
              // First, delete any parent_children records if they exist
              if (player?.parent_id) {
                const { error: childDeleteError } = await supabase
                  .from('parent_children')
                  .delete()
                  .eq('player_id', playerId);
                
                if (childDeleteError) {
                  console.error('Error deleting parent_children record:', childDeleteError);
                  // Continue even if this fails
                }
              }
              
              // Check for attendance records and delete them
              try {
                const { data: attendanceData, error: attendanceCheckError } = await supabase
                  .from('attendance')
                  .select('id')
                  .eq('player_id', playerId);
                
                if (!attendanceCheckError && attendanceData && attendanceData.length > 0) {
                  console.log(`Found ${attendanceData.length} attendance records to delete`);
                  
                  const { error: attendanceDeleteError } = await supabase
                    .from('attendance')
                    .delete()
                    .eq('player_id', playerId);
                  
                  if (attendanceDeleteError) {
                    console.error('Error deleting attendance records:', attendanceDeleteError);
                  } else {
                    console.log('Successfully deleted attendance records');
                  }
                }
              } catch (error) {
                console.error('Error checking attendance records:', error);
                // Continue even if this fails
              }
              
              // Now delete the player record completely
              const { error: deleteError } = await supabase
                .from('players')
                .delete()
                .eq('id', playerId);
                
              if (deleteError) {
                console.error('Error deleting player:', deleteError);
                throw new Error('Failed to delete player');
              }
              
              // Trigger event to notify other screens
              triggerEvent('player_deleted', playerId);
              
              Alert.alert(
                "Success", 
                "Player deleted successfully",
                [
                  {
                    text: "OK",
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            } catch (error) {
              console.error('Error in delete process:', error);
              Alert.alert("Error", error instanceof Error ? error.message : "Failed to delete player");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text>{t('admin.players.details.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (error || !player) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || t('admin.players.details.notFound')}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[
        styles.header,
        Platform.OS === 'android' ? { paddingTop: insets.top + 16 } : null
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.players.details.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Player Header Info */}
        <View style={styles.centeredSection}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.teamName}>{player.team_name || t('admin.players.details.noTeam')}</Text>
        </View>

        {/* Player Information */}
        <Section title={t('admin.players.details.playerInfo')}>
          <InfoRow 
            label={t('admin.players.details.joinDate')} 
            value={formatDate(player.created_at)} 
          />
          <InfoRow 
            label={t('admin.players.details.birthdate')} 
            value={formatDate(player.birth_date)} 
          />
        </Section>

        {/* Payment Information */}
        <Section title={t('admin.players.details.paymentInfo')}>
          <InfoRow 
            label={t('admin.players.details.status')} 
            value={<StatusPill status={player.payment_status} />} 
          />
          <InfoRow 
            label={t('admin.players.details.lastPaymentDate')} 
            value={(() => {
              // Find the last paid month from payment history
              const paidPayments = paymentHistory.filter(p => p.status === 'paid');
              if (paidPayments.length > 0) {
                const lastPaid = paidPayments.sort((a, b) => 
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )[0];
                return `${new Date(lastPaid.year, lastPaid.month - 1).toLocaleString('default', { month: 'long' })} ${lastPaid.year} - ${formatDate(lastPaid.updated_at)}`;
              }
              return formatDate(player.last_payment_date);
            })()} 
          />
          <InfoRow 
            label="Current Month Status" 
            value={`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}: ${player.payment_status === 'paid' ? 'Paid' : 'Not Paid'}`} 
          />
          <TouchableOpacity style={styles.historyButton} onPress={fetchPaymentHistory}>
            <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
            <Text style={styles.historyButtonText}>{t('admin.players.details.viewPaymentHistory')}</Text>
          </TouchableOpacity>
        </Section>

        {/* Medical Visa Information */}
        <Section title={t('admin.players.details.medicalVisaInfo')}>
          <InfoRow 
            label={t('admin.players.details.status')} 
            value={player.medical_visa_status ? 
              t(`admin.players.details.medicalStatus.${player.medical_visa_status}`) : 
              t('admin.players.details.unknown')} 
          />
          {player.medical_visa_status === 'valid' && player.medical_visa_issue_date && (
            <>
              <InfoRow 
                label={t('admin.players.details.issueDate')} 
                value={formatDate(player.medical_visa_issue_date)} 
              />
              <InfoRow 
                label={t('admin.players.details.expiryDate')} 
                value={(() => {
                  try {
                    const issueDate = new Date(player.medical_visa_issue_date);
                    if (isNaN(issueDate.getTime())) return t('admin.players.details.na');
                    const expiryDate = new Date(issueDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 6);
                    return expiryDate.toLocaleDateString('en-GB');
                  } catch (e) {
                    console.error("Error calculating expiry date:", e);
                    return t('admin.players.details.na');
                  }
                })()} 
              />
            </>
          )}
        </Section>

        {/* Attendance */}
        {attendance && (
          <Section title={t('admin.players.details.attendance')}>
            {attendance.byType.map((item) => (
              <InfoRow 
                key={item.type} 
                label={t(`admin.players.details.attendanceType.${item.type}`)} 
                value={`${item.percent}%`} 
              />
            ))}
            <InfoRow label={t('admin.players.details.monthlyAttendance')} value={`${attendance.monthly}%`} />
            <InfoRow label={t('admin.players.details.totalAttendance')} value={`${attendance.total}%`} />
          </Section>
        )}

        {/* Parent Information */}
        {parent && (
          <Section title={t('admin.players.details.parentInfo')}>
            <InfoRow label={t('admin.players.details.parentName')} value={parent.name} />
            <InfoRow label={t('admin.players.details.parentPhone')} value={parent.phone_number} />
            {parent.email && <InfoRow label={t('admin.players.details.parentEmail')} value={parent.email} />}
          </Section>
        )}
        
        {/* Delete button for admin and coach - moved to bottom of page with consistent styling */}
        {(role === 'admin' || role === 'coach') && (
          <TouchableOpacity 
            style={[styles.deleteButton, isDeleting && styles.disabledButton]} 
            onPress={handleDeletePlayer}
            disabled={isDeleting}
          >
            <Text style={styles.deleteButtonText}>
              {isDeleting ? t('admin.players.details.deleting') : t('admin.players.details.deletePlayer')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Payment History Modal */}
      <Modal
        visible={isPaymentHistoryVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPaymentHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin.players.details.paymentHistory')}</Text>
              <TouchableOpacity 
                onPress={() => setIsPaymentHistoryVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {player && (
              <Text style={styles.playerModalName}>{player.name}</Text>
            )}
            
            {isLoadingPaymentHistory ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: '80%' }}>
                {paymentHistory.length === 0 ? (
                  <Text style={styles.emptyText}>{t('admin.players.details.noPaymentHistory')}</Text>
                ) : (
                  paymentHistory.map((payment, index) => (
                    <View key={index} style={styles.paymentItem}>
                      <View>
                        <Text style={styles.paymentMonth}>
                          {new Date(payment.year, payment.month - 1).toLocaleString('default', { month: 'long' })} {payment.year}
                        </Text>
                        <StatusPill status={payment.status} />
                        {payment.status === 'paid' && payment.payment_method && (
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
                              {payment.payment_method === 'cash' && t('admin.players.details.paymentMethod.cash')}
                              {payment.payment_method === 'voucher_cash' && t('admin.players.details.paymentMethod.voucherCash')}
                              {payment.payment_method === 'bank_transfer' && t('admin.players.details.paymentMethod.bankTransfer')}
                              {!['cash','voucher_cash','bank_transfer'].includes(payment.payment_method) && payment.payment_method}
                            </Text>
                          </View>
                        )}
                      </View>
                      {payment.updated_at && (
                        <Text style={styles.paymentDate}>
                          {formatDate(payment.updated_at)}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    {typeof value === 'string' ? (
      <Text style={styles.infoValue}>{value}</Text>
    ) : (
      value
    )}
  </View>
);

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  centeredSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  playerName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  teamName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    marginTop: 2,
  },
  section: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  historyButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: FONT_SIZES.sm,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
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
    width: '80%',
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
  playerModalName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: COLORS.white,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'Urbanist',
  },
  disabledButton: {
    opacity: 0.7,
  },
}); 