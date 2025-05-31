import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { Text, Card, ActivityIndicator, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerEvent } from '../../utils/events';

// Define types
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
  team_id?: string;
}

interface TeamType {
  id: string;
  name: string;
}

interface CollectionsProps {
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
}

export const CoachCollectionsScreen = ({ 
  refreshing = false, 
  onRefresh = () => Promise.resolve()
}: CollectionsProps) => {
  const [collections, setCollections] = useState<PaymentCollection[]>([]);
  const [allCollections, setAllCollections] = useState<PaymentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // State for filters
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedCollectionStatus, setSelectedCollectionStatus] = useState<boolean | null>(null);
  const [teams, setTeams] = useState<TeamType[]>([]);
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [isCollectionStatusModalVisible, setIsCollectionStatusModalVisible] = useState(false);

  const collectionStatusOptions = [
    { value: null, label: 'All Status' },
    { value: false, label: 'Pending Review' },
    { value: true, label: 'Reviewed by Admin' },
  ];
  
  useEffect(() => {
    fetchCollections();
  }, []);
  
  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [selectedTeamId, selectedCollectionStatus, allCollections]);
  
  const applyFilters = () => {
    if (!allCollections.length) return;
    
    let filtered = [...allCollections];
    
    // Apply team filter
    if (selectedTeamId) {
      filtered = filtered.filter(collection => collection.team_id === selectedTeamId);
    }
    
    // Apply status filter
    if (selectedCollectionStatus !== null) {
      filtered = filtered.filter(collection => collection.is_processed === selectedCollectionStatus);
    }
    
    setCollections(filtered);
  };
  
  const fetchCollections = async () => {
    try {
      setLoading(true);
      
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        Alert.alert('Error', 'Coach data not found. Please log in again.');
        return;
      }
      
      const coachData = JSON.parse(storedCoachData);
      console.log('Fetching collections for coach ID:', coachData.id);
      
      // Use the enhanced RPC function that includes player and team data
      const { data, error } = await supabase
        .rpc('get_coach_collections_with_data', { p_coach_id: coachData.id }) as { data: PaymentCollection[] | null, error: any };
      
      if (error) {
        console.error('Error in collections fetch:', error);
        throw error;
      }
      
      console.log('Collections data fetched:', data?.length, 'records');
      
      if (!data || data.length === 0) {
        setAllCollections([]);
        setCollections([]);
        setLoading(false);
        return;
      }
      
      // The data already includes player_name and team_name from the RPC function
      setAllCollections(data);
      setCollections(data);
      
      // Extract unique teams from collections
      const uniqueTeams = Array.from(
        new Map(
          data
            .filter(item => item.team_id && item.team_name)
            .map(item => [item.team_id, { id: item.team_id!, name: item.team_name! }])
        ).values()
      );
      
      setTeams(uniqueTeams);
      
    } catch (error) {
      console.error('Error fetching collections:', error);
      Alert.alert('Error', 'Failed to load collections data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTeamSelect = (teamId: string | null) => {
    setSelectedTeamId(teamId);
    setIsTeamModalVisible(false);
  };

  const handleCollectionStatusSelect = (status: boolean | null) => {
    setSelectedCollectionStatus(status);
    setIsCollectionStatusModalVisible(false);
  };
  
  const handleDeleteCollection = async (collection: PaymentCollection) => {
    Alert.alert(
      'Confirm Deletion',
      'Make sure the admin has reviewed your note and updated the player\'s payment status before deleting.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(collection.id);
              
              const { error } = await supabase
                .from('payment_collections')
                .delete()
                .eq('id', collection.id);
                
              if (error) {
                console.error('Error deleting collection:', error);
                throw error;
              }
              
              // Refresh the list
              fetchCollections();
              
              Alert.alert('Success', 'Collection deleted successfully');
            } catch (error) {
              console.error('Error deleting collection:', error);
              Alert.alert('Error', 'Failed to delete collection');
            } finally {
              setDeleting(null);
            }
          }
        }
      ]
    );
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Filter Section */}
      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setIsTeamModalVisible(true)}
          >
            <MaterialCommunityIcons name="shield-outline" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name || 'Unknown Team' : 'All Teams'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setIsCollectionStatusModalVisible(true)}
          >
            <MaterialCommunityIcons name="cash-check" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {collectionStatusOptions.find(opt => opt.value === selectedCollectionStatus)?.label || 'All Status'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cash-register" size={48} color={COLORS.grey[400]} />
            <Text style={styles.emptyStateText}>No collections found</Text>
            <Text style={styles.emptyStateSubtext}>
              You haven't collected any cash payments yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.collectionCard}>
            <Card.Content>
              <View style={styles.collectionHeader}>
                <Text style={styles.playerName}>{item.player_name}</Text>
                <View style={styles.headerRight}>
                  <Text style={styles.teamName}>{item.team_name}</Text>
                  <TouchableOpacity 
                    onPress={() => handleDeleteCollection(item)}
                    style={styles.deleteIcon}
                    disabled={!!deleting}
                  >
                    <MaterialCommunityIcons 
                      name="delete" 
                      size={18} 
                      color={deleting === item.id ? COLORS.grey[400] : COLORS.error} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.collectionDetails}>
                <View style={styles.collectionDetail}>
                  <Text style={styles.detailLabel}>Date Collected:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(item.collected_date)}
                  </Text>
                </View>
                
                <View style={styles.collectionDetail}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[
                    styles.statusBadge,
                    { 
                      backgroundColor: item.is_processed 
                        ? COLORS.success + '20' 
                        : '#FFA500' + '20'
                    }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { 
                        color: item.is_processed 
                          ? COLORS.success 
                          : '#FFA500'
                      }
                    ]}>
                      {item.is_processed ? 'Reviewed by Admin' : 'Pending Review'}
                    </Text>
                  </View>
                </View>
                
                {item.notes && (
                  <View style={styles.collectionDetail}>
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={styles.noteText}>{item.notes}</Text>
                  </View>
                )}
                
                {item.is_processed && item.processed_date && (
                  <View style={styles.collectionDetail}>
                    <Text style={styles.detailLabel}>Reviewed On:</Text>
                    <Text style={[styles.detailValue, { color: COLORS.success }]}>
                      {formatDate(item.processed_date)}
                    </Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {/* Team Filter Modal */}
      <TeamFilterModal
        isVisible={isTeamModalVisible}
        onClose={() => setIsTeamModalVisible(false)}
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={handleTeamSelect}
      />

      {/* Collection Status Filter Modal */}
      <CollectionStatusFilterModal
        isVisible={isCollectionStatusModalVisible}
        onClose={() => setIsCollectionStatusModalVisible(false)}
        options={collectionStatusOptions}
        selectedStatus={selectedCollectionStatus}
        onSelect={handleCollectionStatusSelect}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyStateSubtext: {
    color: COLORS.grey[600],
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  collectionCard: {
    margin: SPACING.md,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  collectionHeader: {
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
  collectionDetails: {
    marginTop: SPACING.md,
  },
  collectionDetail: {
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
  noteText: {
    fontSize: 14,
    color: COLORS.grey[600],
    flex: 1,
    textAlign: 'right',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteIcon: {
    padding: SPACING.sm,
  },
  filtersContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
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
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
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
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalOptionSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});

// Add Modals here
interface TeamFilterModalProps {
  isVisible: boolean;
  onClose: () => void;
  teams: TeamType[];
  selectedTeamId: string | null;
  onSelect: (teamId: string | null) => void;
}

const TeamFilterModal = ({ isVisible, onClose, teams, selectedTeamId, onSelect }: TeamFilterModalProps) => (
  <Modal
    visible={isVisible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Team</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.modalOption, !selectedTeamId && styles.modalOptionSelected]}
          onPress={() => onSelect(null)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="shield-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.modalOptionText, !selectedTeamId && styles.modalOptionTextSelected]}>All Teams</Text>
          </View>
          {!selectedTeamId && (
            <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>
        
        {teams.map(team => (
          <TouchableOpacity
            key={team.id}
            style={[styles.modalOption, selectedTeamId === team.id && styles.modalOptionSelected]}
            onPress={() => onSelect(team.id)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="shield-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalOptionText, selectedTeamId === team.id && styles.modalOptionTextSelected]}>
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
);

interface CollectionStatusFilterModalProps {
  isVisible: boolean;
  onClose: () => void;
  options: { value: boolean | null; label: string }[];
  selectedStatus: boolean | null;
  onSelect: (status: boolean | null) => void;
}

const CollectionStatusFilterModal = ({ isVisible, onClose, options, selectedStatus, onSelect }: CollectionStatusFilterModalProps) => (
  <Modal
    visible={isVisible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Status</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {options.map(option => (
          <TouchableOpacity
            key={option.label}
            style={[styles.modalOption, selectedStatus === option.value && styles.modalOptionSelected]}
            onPress={() => onSelect(option.value)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <MaterialCommunityIcons 
                name={option.value === true ? 'check-circle-outline' : option.value === false ? 'clock-outline' : 'cash-check'} 
                size={20} 
                color={option.value === true ? COLORS.success : option.value === false ? '#FFA500' : COLORS.primary} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.modalOptionText, selectedStatus === option.value && styles.modalOptionTextSelected]}>
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
); 