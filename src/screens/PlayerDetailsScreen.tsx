import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder: Replace with your actual theme/colors
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

export const PlayerDetailsScreen = () => {
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

        // Fetch fresh payment status
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        const { data: paymentData, error: paymentError } = await supabase
          .from('monthly_payments')
          .select('status, updated_at')
          .eq('player_id', playerId)
          .eq('year', year)
          .eq('month', month)
          .single();
          
        if (!paymentError && paymentData) {
          playerData.payment_status = paymentData.status;
          if (paymentData.status === 'paid' && paymentData.updated_at) {
            playerData.last_payment_date = paymentData.updated_at;
          }
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

        // Set the player data with team name
        const playerWithTeam: Player = {
          ...playerData,
          teams: Array.isArray(playerData.teams) && playerData.teams.length > 0 
            ? { name: playerData.teams[0].name }
            : null,
          team_name: teamName
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
      
      const { data, error } = await supabase
        .from('monthly_payments')
        .select('*')
        .eq('player_id', playerId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
        
      if (error) throw error;
      
      setPaymentHistory(data || []);
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text>Loading player details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !player) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || 'Player not found'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Player Header Info */}
        <View style={styles.centeredSection}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.teamName}>{player.team_name || 'No team assigned'}</Text>
        </View>

        {/* Player Information */}
        <Section title="Player Information">
          <InfoRow 
            label="Join Date" 
            value={formatDate(player.created_at)} 
          />
          <InfoRow 
            label="Birthdate" 
            value={formatDate(player.birth_date)} 
          />
        </Section>

        {/* Payment Information */}
        <Section title="Payment Information">
          <InfoRow 
            label="Status" 
            value={player.payment_status ? 
              player.payment_status.charAt(0).toUpperCase() + player.payment_status.slice(1) : 
              'Unknown'} 
          />
          <InfoRow 
            label="Last Payment Date" 
            value={formatDate(player.last_payment_date)} 
          />
          <TouchableOpacity style={styles.historyButton} onPress={fetchPaymentHistory}>
            <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
            <Text style={styles.historyButtonText}>View Payment History</Text>
          </TouchableOpacity>
        </Section>

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
                <Text style={styles.modalTitle}>Payment History</Text>
                <TouchableOpacity 
                  onPress={() => setIsPaymentHistoryVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {isLoadingPaymentHistory ? (
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
                            {new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' })} {payment.year}
                          </Text>
                          <Text style={[
                            styles.paymentStatus, 
                            { color: payment.status === 'paid' ? COLORS.success : COLORS.error }
                          ]}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Text>
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

        {/* Medical Visa Information */}
        <Section title="Medical Visa Information">
          <InfoRow 
            label="Status" 
            value={player.medical_visa_status ? 
              player.medical_visa_status.charAt(0).toUpperCase() + player.medical_visa_status.slice(1) : 
              'Unknown'} 
          />
          {player.medical_visa_status === 'valid' && player.medical_visa_issue_date && (
            <>
              <InfoRow 
                label="Issue Date" 
                value={formatDate(player.medical_visa_issue_date)} 
              />
              <InfoRow 
                label="Expiry Date" 
                value={(() => {
                  try {
                    const issueDate = new Date(player.medical_visa_issue_date);
                    if (isNaN(issueDate.getTime())) return 'N/A';
                    const expiryDate = new Date(issueDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 6);
                    return expiryDate.toLocaleDateString('en-GB');
                  } catch (e) {
                    console.error("Error calculating expiry date:", e);
                    return 'N/A';
                  }
                })()} 
              />
            </>
          )}
        </Section>

        {/* Attendance */}
        {attendance && (
          <Section title="Attendance">
            {attendance.byType.map((item) => (
              <InfoRow 
                key={item.type} 
                label={`${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Attendance`} 
                value={`${item.percent}%`} 
              />
            ))}
            <InfoRow label="Monthly Attendance" value={`${attendance.monthly}%`} />
            <InfoRow label="Total Attendance" value={`${attendance.total}%`} />
          </Section>
        )}

        {/* Parent Information */}
        {parent && (
          <Section title="Parent Information">
            <InfoRow label="Name" value={parent.name} />
            <InfoRow label="Phone" value={parent.phone_number} />
            {parent.email && <InfoRow label="Email" value={parent.email} />}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
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
  },
  paymentMonth: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  paymentStatus: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  paymentDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
}); 