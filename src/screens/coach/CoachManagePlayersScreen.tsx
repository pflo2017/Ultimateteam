import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../utils/useDataRefresh';
import { Calendar } from 'react-native-calendars';
import { forceRefresh, triggerEvent, registerEventListener } from '../../utils/events';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachStackParamList } from '../../navigation/CoachNavigator';
import { useTranslation } from 'react-i18next';

interface Team {
  id: string;
  name: string;
}

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
  created_at?: string;
  birth_date?: string;
  last_payment_date?: string;
  medical_visa_issue_date?: string;
}

interface ParentDetails {
  name: string;
  phone_number: string;
  email?: string;
}

interface CoachManagePlayersScreenProps {
  players: Player[];
  teams: Team[];
  isLoading: boolean;
  refreshing: boolean;
  searchQuery: string;
  selectedTeamId: string | null;
  onRefresh: () => Promise<void>;
  onSearchChange: (query: string) => void;
  onTeamSelect: (teamId: string | null) => void;
}

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

const getPaymentStatusColor = (status: string) => {
  return status.toLowerCase() === 'paid' ? COLORS.success : COLORS.error;
};

const getPaymentStatusText = (status: string, t?: any) => {
  if (!status) return t ? t('coach.players.status.not_paid') : 'Not Paid';
  
  const normalizedStatus = status.toLowerCase();
  
  switch (normalizedStatus) {
    case 'paid':
      return t ? t('coach.players.status.paid') : 'Paid';
    case 'not_paid':
    case 'unpaid':
    case 'not paid':
      return t ? t('coach.players.status.not_paid') : 'Not Paid';
    case 'pending':
      return t ? t('coach.players.status.pending') : 'Pending';
    case 'on_trial':
      return t ? t('coach.players.status.on_trial') : 'On Trial';
    case 'trial_ended':
      return t ? t('coach.players.status.trial_ended') : 'Trial Ended';
    default:
      // For any unknown value, try to make it presentable 
      // Replace underscores with spaces and capitalize first letter
      return status.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
};

const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24
};

const PlayerCard = ({ player, onDetailsPress, onDelete, onUpdateMedicalVisa }: { 
  player: Player;
  onDetailsPress: (player: Player) => void;
  onDelete: (player: Player) => void;
  onUpdateMedicalVisa: (player: Player) => void;
}) => {
  const { t } = useTranslation();
  const [refreshedStatus, setRefreshedStatus] = useState<string | null>(null);
  const [refreshedPaidDate, setRefreshedPaidDate] = useState<string | null>(null);
  const [refreshedLastPaidMonth, setRefreshedLastPaidMonth] = useState<string | null>(null);
  const [refreshedLastPaidExactDate, setRefreshedLastPaidExactDate] = useState<string | null>(null);
  const [refreshedMedicalVisaStatus, setRefreshedMedicalVisaStatus] = useState<string | null>(null);
  const [refreshedMedicalVisaIssueDate, setRefreshedMedicalVisaIssueDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const getLatestData = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    setIsRefreshing(true);
    try {
      // Get current year and month
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      // First, check current month payment status
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('monthly_payments')
        .select('status, updated_at')
        .eq('player_id', player.id)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      // Then, find the last paid payment record
      const { data: lastPaidData, error: lastPaidError } = await supabase
        .from('monthly_payments')
        .select('status, updated_at, year, month')
        .eq('player_id', player.id)
        .eq('status', 'paid')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .single();
      
      // Set current month status
      if (!currentMonthError && currentMonthData && currentMonthData.status) {
        setRefreshedStatus(currentMonthData.status);
        if (currentMonthData.status === 'paid' && currentMonthData.updated_at) {
          const paidDate = new Date(currentMonthData.updated_at);
          setRefreshedPaidDate(paidDate.toLocaleDateString('en-GB'));
        } else {
          setRefreshedPaidDate(null);
        }
      } else {
        setRefreshedStatus('unpaid');
        setRefreshedPaidDate(null);
      }
      // Set last paid month and exact date if found
      if (!lastPaidError && lastPaidData && lastPaidData.status === 'paid' && lastPaidData.updated_at) {
        const paidDate = new Date(lastPaidData.updated_at);
        const monthName = paidDate.toLocaleDateString('en-GB', { month: 'long' });
        setRefreshedLastPaidMonth(monthName);
        setRefreshedLastPaidExactDate(paidDate.toLocaleDateString('en-GB'));
      } else {
        setRefreshedLastPaidMonth(null);
        setRefreshedLastPaidExactDate(null);
      }
      
      // Also fetch fresh medical visa status
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('medical_visa_status, medical_visa_issue_date')
        .eq('id', player.id)
        .single();
        
      if (!playerError && playerData) {
        setRefreshedMedicalVisaStatus(playerData.medical_visa_status);
        setRefreshedMedicalVisaIssueDate(playerData.medical_visa_issue_date);
      }
    } catch (error) {
      console.error('Error fetching fresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch fresh data on mount
  useEffect(() => {
    getLatestData();
  }, []);

  // Listen for payment status changes
  useEffect(() => {
    const handlePaymentStatusChange = (playerId: string) => {
      if (playerId === player.id) {
        console.log(`[DEBUG] Payment status change detected for player ${player.id}, refreshing data`);
        getLatestData();
      }
    };
    
    const unregister = registerEventListener('payment_status_changed', handlePaymentStatusChange);
    return () => unregister();
  }, [player.id]);

  // Listen for medical visa status changes
  useEffect(() => {
    const handleMedicalVisaStatusChange = (updatedPlayer: Player) => {
      if (updatedPlayer.id === player.id) {
        console.log(`[DEBUG] Medical visa status change detected for player ${player.id}, refreshing data`);
        getLatestData();
      }
    };
    
    const unregister = registerEventListener('medical_visa_status_changed', handleMedicalVisaStatusChange);
    return () => unregister();
  }, [player.id]);

  // Also listen for general payment data changes
  useDataRefresh('payments', () => {
    console.log(`[DEBUG] Payment data change detected, refreshing data for player ${player.id}`);
    getLatestData();
  });

  // Use the refreshed status if available, otherwise fall back to the prop
  const displayStatus = refreshedStatus || player.payment_status;
  const displayPaidDate = refreshedPaidDate;
  const displayLastPaidMonth = refreshedLastPaidMonth;
  const displayLastPaidExactDate = refreshedLastPaidExactDate;
  const displayMedicalVisaStatus = refreshedMedicalVisaStatus || player.medical_visa_status;
  const displayMedicalVisaIssueDate = refreshedMedicalVisaIssueDate || player.medical_visa_issue_date;
  
  // Format the date if it exists
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
  
  return (
    <Card 
      style={styles.playerCard}
      mode="outlined"
    >
      <Card.Content style={{ padding: SPACING.md }}>
        <View style={styles.playerHeader}>
          <View style={styles.nameContainer}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: COLORS.primary + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: SPACING.md
            }}>
              <MaterialCommunityIcons 
                name="account" 
                size={28} 
                color={COLORS.primary} 
              />
            </View>
            <View>
              <Text style={styles.playerName}>{player.player_name || player.name}</Text>
              <Text style={styles.teamName}>{player.team_name || t('coach.players.no_team_assigned')}</Text>
            </View>
          </View>

          <View style={styles.ageContainer}>
            <Text style={styles.ageLabel}>{t('coach.players.birth_date')}</Text>
            <Text style={styles.ageValue}>
              {player.birth_date ? formattedBirthDate : t('coach.players.not_available')}
            </Text>
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <TouchableOpacity 
          onPress={() => onUpdateMedicalVisa(player)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md }}
        >
          <MaterialCommunityIcons name="medical-bag" size={20} color={COLORS.primary} />
          <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500' }}>
            {t('coach.players.medical_visa')}
          </Text>
          <View style={{
            backgroundColor: getMedicalVisaStatusColor(displayMedicalVisaStatus) + '20',
            borderRadius: 12,
            paddingHorizontal: SPACING.md,
            paddingVertical: 4,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
          }}>
            <Text style={{
              fontSize: FONT_SIZES.xs,
              fontWeight: '600',
              color: getMedicalVisaStatusColor(displayMedicalVisaStatus)
            }}>
              {t(`coach.players.status.${displayMedicalVisaStatus}`)}
            </Text>
          </View>
          
          {displayMedicalVisaStatus === 'valid' && displayMedicalVisaIssueDate && (
            <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: COLORS.grey[600], fontWeight: '500' }}>{t('coach.players.medical_visa_until')}</Text>
              <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '600' }}>
                {(() => {
                  try {
                    const issueDate = new Date(displayMedicalVisaIssueDate);
                    if (isNaN(issueDate.getTime())) return 'N/A';
                    const expiryDate = new Date(issueDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 6);
                    return expiryDate.toLocaleDateString('en-GB');
                  } catch (e) {
                    console.error("Error calculating expiry date:", e);
                    return 'N/A';
                  }
                })()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        <View style={{ marginBottom: SPACING.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color={COLORS.primary} />
            {displayStatus === 'paid' && displayPaidDate ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500', marginRight: 8 }}>
                    {t('coach.players.payment_status')}
                  </Text>
                  <View style={{
                    backgroundColor: getPaymentStatusColor(displayStatus) + '20',
                    borderRadius: 12,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZES.xs,
                      fontWeight: '600',
                      color: getPaymentStatusColor(displayStatus)
                    }}>
                      {getPaymentStatusText(displayStatus, t)}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500' }}>
                  {displayPaidDate}
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '500', marginRight: 8 }}>
                    {t('coach.players.payment_status')}
                  </Text>
                  <View style={{
                    backgroundColor: getPaymentStatusColor(displayStatus) + '20',
                    borderRadius: 12,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZES.xs,
                      fontWeight: '600',
                      color: getPaymentStatusColor(displayStatus)
                    }}>
                      {getPaymentStatusText(displayStatus, t)}
                    </Text>
                  </View>
                </View>
                {/* Details below, left-aligned with label */}
                {displayStatus !== 'paid' && displayLastPaidMonth && displayLastPaidExactDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8, marginLeft: 0 }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.text }}>
                      {displayLastPaidMonth}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.grey[600], fontWeight: '500', marginLeft: 6 }}>
                      {t('coach.players.paid_on', { date: displayLastPaidExactDate })}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => onDetailsPress(player)}
          >
            <MaterialCommunityIcons name="account-details" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>{t('coach.players.details')}</Text>
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );
};

export const CoachManagePlayersScreen: React.FC<CoachManagePlayersScreenProps> = ({
  players,
  teams,
  isLoading,
  refreshing,
  searchQuery,
  selectedTeamId,
  onRefresh,
  onSearchChange,
  onTeamSelect,
}) => {
  const { t } = useTranslation();
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const selectedTeam = teams.find(team => team.id === selectedTeamId);
  
  const [isPlayerDetailsModalVisible, setIsPlayerDetailsModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [parentDetails, setParentDetails] = useState<ParentDetails | null>(null);
  const [playerMenuVisible, setPlayerMenuVisible] = useState<string | null>(null);

  // Add a new state for the medical visa status modal
  const [isMedicalVisaModalVisible, setIsMedicalVisaModalVisible] = useState(false);
  const [updatingPlayer, setUpdatingPlayer] = useState<Player | null>(null);
  const [isUpdatingMedicalVisa, setIsUpdatingMedicalVisa] = useState(false);
  
  // Add a new state for the selected medical visa issue date
  const [selectedMedicalVisaDate, setSelectedMedicalVisaDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showValidSection, setShowValidSection] = useState(false);

  // First, add new states for the filter modal and medical status filter
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedMedicalStatus, setSelectedMedicalStatus] = useState<string | null>(null);
  const medicalStatusOptions = [
    { value: null, label: t('coach.players.filter.all_medical') },
    { value: 'valid', label: t('coach.players.filter.valid') },
    { value: 'pending', label: t('coach.players.filter.pending') },
    { value: 'expired', label: t('coach.players.filter.expired') },
  ];

  const filteredPlayers = players.filter(player => {
    const playerName = player.player_name || player.name || '';
    const matchesSearch = playerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = !selectedTeamId || player.team_id === selectedTeamId;
    const matchesMedical = !selectedMedicalStatus || player.medical_visa_status === selectedMedicalStatus;
    return matchesSearch && matchesTeam && matchesMedical;
  });

  const navigation = useNavigation<NativeStackNavigationProp<CoachStackParamList>>();

  const handleOpenPlayerDetails = async (player: Player) => {
    try {
      console.log("Opening player details for:", player.id);
      
      // Navigate to the player details screen
      navigation.navigate('PlayerDetails', {
        playerId: player.id,
        role: 'coach'
      });
    } catch (error) {
      console.error('Error opening player details:', error);
      Alert.alert('Error', 'Could not open player details');
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id);
        
      if (error) throw error;
      
      Alert.alert("Success", "Player deleted successfully");
      onRefresh();
    } catch (error) {
      console.error('Error deleting player:', error);
      Alert.alert("Error", "Failed to delete player");
    }
  };

  const handlePlayerMenuPress = (playerId: string) => {
    setPlayerMenuVisible(playerId === playerMenuVisible ? null : playerId);
  };

  // Add this function to handle updating medical visa status with custom issue date
  const handleUpdateMedicalVisaStatus = async (status: 'valid' | 'expired') => {
    if (!updatingPlayer) return;
    
    setIsUpdatingMedicalVisa(true);
    try {
      // Ensure status is not null or empty
      if (!status) {
        console.error('[handleUpdateMedicalVisaStatus] Status is null or empty, defaulting to pending');
        status = 'pending' as 'valid' | 'expired';
      }
      
      // Determine the issue date - use selected date for valid status, null for expired
      const issueDate = status === 'valid' ? selectedMedicalVisaDate.toISOString() : null;
      
      console.log(`[handleUpdateMedicalVisaStatus] Updating medical visa for ${updatingPlayer.player_name}:`, {
        status,
        issueDate,
        player_id: updatingPlayer.id
      });
      
      // Use the stored procedure to update both tables at once
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_medical_visa_status', {
          p_player_id: updatingPlayer.id,
          p_status: status,
          p_issue_date: issueDate
        });

      console.log('[DEBUG] Update medical visa status result:', { 
        success: !updateError, 
        error: updateError?.message,
        data: updateResult
      });

      if (updateError) {
        console.error('Error updating medical visa status:', updateError);
        Alert.alert('Error', 'Failed to update medical visa status');
        setIsUpdatingMedicalVisa(false);
        return;
      }

      // Verify the update by fetching the player data again
      const { data: verifyData, error: verifyError } = await supabase
        .from('players')
        .select('medical_visa_status, medical_visa_issue_date')
        .eq('id', updatingPlayer.id)
        .single();
        
      console.log('[DEBUG] Verification fetch result:', {
        success: !verifyError,
        error: verifyError?.message,
        data: verifyData
      });
      
      // Add more detailed logging to help diagnose the issue
      if (!verifyError && verifyData) {
        console.log(`[DEBUG] CONFIRMED medical visa status in database for ${updatingPlayer.player_name}:`, {
          status: verifyData.medical_visa_status,
          issue_date: verifyData.medical_visa_issue_date,
          status_type: typeof verifyData.medical_visa_status,
          is_null: verifyData.medical_visa_status === null,
          is_undefined: verifyData.medical_visa_status === undefined,
          is_empty: verifyData.medical_visa_status === ''
        });
      }
      
      console.log(`[handleUpdateMedicalVisaStatus] Successfully updated medical visa for ${updatingPlayer.player_name}`);

      // Update the player in our local state
      if (selectedPlayer && selectedPlayer.id === updatingPlayer.id) {
        setSelectedPlayer({
          ...selectedPlayer,
          medical_visa_status: status,
          medical_visa_issue_date: issueDate || undefined
        });
      }
      
      // Also update the player in the filteredPlayers list
      const updatedPlayer = {
        ...updatingPlayer,
        medical_visa_status: status,
        medical_visa_issue_date: issueDate || undefined
      };
      
      // Trigger a medical visa status changed event
      triggerEvent('medical_visa_status_changed', updatedPlayer);
      
      // Force a refresh of the players data
      forceRefresh('players');
      
      // Close the modal and refresh
      setIsMedicalVisaModalVisible(false);
      onRefresh();
    } catch (error) {
      console.error('Error updating medical visa status:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsUpdatingMedicalVisa(false);
    }
  };

  // Add this function to handle opening the medical visa modal
  const handleOpenMedicalVisaModal = (player: Player) => {
    setUpdatingPlayer(player);
    // Set the default date to today
    setSelectedMedicalVisaDate(new Date());
    setShowValidSection(false);
    setIsMedicalVisaModalVisible(true);
  };

  useEffect(() => {
    onRefresh();
  }, []);
  
  // Use data refresh hook to refresh player data when payment status changes
  useDataRefresh('players', () => {
    console.log("[CoachManagePlayersScreen] Payment status change detected - refreshing player data");
    onRefresh();
  });

  useEffect(() => {
    // Listen for payment status changes from PaymentsScreen
    const handlePaymentStatusChange = () => {
      console.log('[CoachManagePlayersScreen] Payment status changed, refreshing player data');
      onRefresh();
    };
    const unregister = registerEventListener('payment_status_changed', handlePaymentStatusChange);
    return () => unregister();
  }, [onRefresh]);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.playersContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('coach.players.title')}</Text>
              <Text style={styles.totalCount}>{t('coach.players.total_count', { count: filteredPlayers.length })}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsFilterModalVisible(true)}>
              <MaterialCommunityIcons name="filter" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('coach.players.search_placeholder')}
              placeholderTextColor={COLORS.grey[400]}
              value={searchQuery}
              onChangeText={onSearchChange}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {filteredPlayers.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                onDetailsPress={handleOpenPlayerDetails}
                onDelete={handleDeletePlayer}
                onUpdateMedicalVisa={handleOpenMedicalVisaModal}
              />
            ))}
            {filteredPlayers.length === 0 && !isLoading && (
              <Text style={styles.emptyText}>{t('coach.players.no_players_found')}</Text>
            )}
          </ScrollView>

          <Modal
            visible={isFilterModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsFilterModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { borderRadius: 16, padding: 24 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{t('coach.players.filter.title')}</Text>
                  <Pressable 
                    onPress={() => setIsFilterModalVisible(false)}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color="#000"
                    />
                  </Pressable>
                </View>
                
                <ScrollView style={{ maxHeight: '80%' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 16 }}>{t('coach.players.filter.teams')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: selectedTeamId === null ? COLORS.primary : 'transparent',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: selectedTeamId === null ? COLORS.primary : COLORS.grey[300],
                        marginBottom: 8
                      }}
                      onPress={() => {
                        onTeamSelect(null);
                        setIsFilterModalVisible(false);
                      }}
                    >
                      <Text style={{ 
                        color: selectedTeamId === null ? COLORS.white : COLORS.text,
                        fontWeight: '500',
                        fontSize: 14
                      }}>
                        {t('coach.players.filter.all_teams')}
                      </Text>
                    </TouchableOpacity>
                    
                    {teams.map(team => (
                      <TouchableOpacity
                        key={team.id}
                        style={{
                          backgroundColor: selectedTeamId === team.id ? COLORS.primary : 'transparent',
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: selectedTeamId === team.id ? COLORS.primary : COLORS.grey[300],
                          marginBottom: 8
                        }}
                        onPress={() => {
                          onTeamSelect(team.id);
                          setIsFilterModalVisible(false);
                        }}
                      >
                        <Text style={{ 
                          color: selectedTeamId === team.id ? COLORS.white : COLORS.text,
                          fontWeight: '500',
                          fontSize: 14
                        }}>
                          {team.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 16 }}>{t('coach.players.filter.medical_status')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {medicalStatusOptions.map(option => (
                      <TouchableOpacity
                        key={option.value ?? 'all'}
                        style={{
                          backgroundColor: selectedMedicalStatus === option.value ? 
                            (option.value === 'valid' ? COLORS.success : 
                             option.value === 'pending' ? COLORS.warning : 
                             option.value === 'expired' ? COLORS.error : COLORS.primary) : 'transparent',
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: option.value === 'valid' ? COLORS.success : 
                                       option.value === 'pending' ? COLORS.warning : 
                                       option.value === 'expired' ? COLORS.error : COLORS.primary,
                          marginBottom: 8
                        }}
                        onPress={() => setSelectedMedicalStatus(option.value)}
                      >
                        <Text style={{ 
                          color: selectedMedicalStatus === option.value ? COLORS.white : 
                                (option.value === 'valid' ? COLORS.success : 
                                 option.value === 'pending' ? COLORS.warning : 
                                 option.value === 'expired' ? COLORS.error : COLORS.primary),
                          fontWeight: '500',
                          fontSize: 14
                        }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                
                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.primary,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 16
                  }}
                  onPress={() => {
                    setIsFilterModalVisible(false);
                  }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 16 }}>{t('coach.players.filter.apply_filters')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal
            visible={isTeamModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsTeamModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('coach.players.select_team')}</Text>
                  <Pressable 
                    onPress={() => setIsTeamModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color={COLORS.text}
                    />
                  </Pressable>
                </View>

                <ScrollView style={styles.teamsList}>
                  <Pressable
                    style={[
                      styles.teamItem,
                      selectedTeamId === null && styles.teamOptionSelected
                    ]}
                    onPress={() => {
                      onTeamSelect(null);
                      setIsTeamModalVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.teamItemText}>{t('coach.players.all_teams')}</Text>
                    </View>
                    {selectedTeamId === null && (
                      <MaterialCommunityIcons
                        name="check"
                        size={24}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>

                  {teams.map(team => (
                    <TouchableOpacity
                      key={team.id}
                      style={[styles.teamItem, selectedTeamId === team.id && styles.teamOptionSelected]}
                      onPress={() => {
                        onTeamSelect(team.id);
                        setIsTeamModalVisible(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.teamItemText}>{team.name}</Text>
                      </View>
                      {selectedTeamId === team.id && (
                        <MaterialCommunityIcons
                          name="check"
                          size={24}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={isMedicalVisaModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsMedicalVisaModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { padding: 24, borderRadius: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{t('coach.players.update_medical_visa_status.title')}</Text>
                  <Pressable 
                    onPress={() => setIsMedicalVisaModalVisible(false)}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color="#000"
                    />
                  </Pressable>
                </View>
                
                {updatingPlayer && (
                  <Text style={{ fontSize: 16, marginBottom: 20 }}>
                    {t('coach.players.update_medical_visa_status.change_status_for', { playerName: updatingPlayer.player_name })}
                  </Text>
                )}
                
                <View style={{ gap: 16 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      backgroundColor: 'rgba(75, 181, 67, 0.1)',
                      borderRadius: 8
                    }}
                    onPress={() => {
                      // When Valid is clicked, show the date selection section
                      setShowValidSection(true);
                    }}
                    disabled={isUpdatingMedicalVisa}
                  >
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={COLORS.success}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.success }}>{t('coach.players.update_medical_visa_status.valid')}</Text>
                  </TouchableOpacity>
                  
                  {/* This section appears when Valid is clicked */}
                  {showValidSection && (
                    <View style={{ 
                      backgroundColor: 'rgba(75, 181, 67, 0.05)', 
                      padding: 16, 
                      borderRadius: 8, 
                      marginTop: -8,
                      borderWidth: 1,
                      borderColor: 'rgba(75, 181, 67, 0.2)'
                    }}>
                      <Text style={{ fontSize: 14, color: COLORS.grey[600], marginBottom: 8 }}>{t('coach.players.update_medical_visa_status.medical_visa_issue_date')}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '500' }}>
                          {selectedMedicalVisaDate.toLocaleDateString()}
                        </Text>
                        <TouchableOpacity 
                          style={{ 
                            backgroundColor: COLORS.success, 
                            paddingVertical: 6, 
                            paddingHorizontal: 12, 
                            borderRadius: 4 
                          }}
                          onPress={() => setShowCalendar(!showCalendar)}
                        >
                          <Text style={{ color: COLORS.white, fontWeight: '500' }}>
                            {showCalendar ? t('coach.players.update_medical_visa_status.hide_calendar') : t('coach.players.update_medical_visa_status.change_date')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {showCalendar && (
                        <View style={{ marginTop: 16, maxHeight: 350 }}>
                          <ScrollView>
                            <Calendar
                              current={selectedMedicalVisaDate.toISOString().split('T')[0]}
                              onDayPress={(day) => {
                                const selectedDate = new Date(day.timestamp);
                                setSelectedMedicalVisaDate(selectedDate);
                              }}
                              markedDates={{
                                [selectedMedicalVisaDate.toISOString().split('T')[0]]: {
                                  selected: true,
                                  selectedColor: COLORS.success
                                }
                              }}
                              maxDate={new Date().toISOString().split('T')[0]}
                              theme={{
                                backgroundColor: '#ffffff',
                                calendarBackground: '#ffffff',
                                textSectionTitleColor: '#b6c1cd',
                                selectedDayBackgroundColor: COLORS.success,
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: COLORS.success,
                                dayTextColor: '#2d4150',
                                textDisabledColor: '#d9e1e8',
                                arrowColor: COLORS.success,
                                monthTextColor: COLORS.text,
                                indicatorColor: COLORS.success
                              }}
                              style={{
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: 'rgba(75, 181, 67, 0.2)',
                                marginBottom: 16
                              }}
                            />
                          </ScrollView>
                        </View>
                      )}
                      
                      <TouchableOpacity
                        style={{
                          backgroundColor: COLORS.success,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          alignItems: 'center',
                          marginTop: 16
                        }}
                        onPress={() => handleUpdateMedicalVisaStatus('valid')}
                        disabled={isUpdatingMedicalVisa}
                      >
                        <Text style={{ color: COLORS.white, fontWeight: '600' }}>{t('coach.players.update_medical_visa_status.confirm_valid_status')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      borderRadius: 8
                    }}
                    onPress={() => handleUpdateMedicalVisaStatus('expired')}
                    disabled={isUpdatingMedicalVisa}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={24}
                      color={COLORS.error}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.error }}>{t('coach.players.update_medical_visa_status.expired')}</Text>
                  </TouchableOpacity>
                </View>
                
                {isUpdatingMedicalVisa && (
                  <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
                )}
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  searchIcon: {
    marginRight: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.text,
  },
  playerCard: {
    marginBottom: SPACING.md,
    borderColor: COLORS.grey[200],
    backgroundColor: COLORS.white,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  teamName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    marginTop: 2,
  },
  ageContainer: {
    alignItems: 'flex-end',
  },
  ageLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[600],
    fontWeight: '500',
  },
  ageValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grey[200],
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
  },
  viewButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: '500',
    fontSize: FONT_SIZES.sm,
  },
  playersContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: 4,
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
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  teamsList: {
    maxHeight: 300,
  },
  teamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  teamOptionSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  teamItemText: {
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
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: '#00BDF2', // Turquoise color
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
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  medicalVisaOptions: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  medicalVisaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 8,
    gap: SPACING.md,
  },
  medicalVisaOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.grey[500],
  },
}); 