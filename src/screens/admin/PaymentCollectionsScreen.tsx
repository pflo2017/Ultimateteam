import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { Text, Card, ActivityIndicator, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING } from '../../constants/theme';
import { triggerEvent } from '../../utils/events';

// Define types
type PaymentCollection = {
  id: string;
  player_id: string;
  coach_id: string;
  collected_date: string;
  is_processed: boolean;
  processed_date: string | null;
  notes: string | null;
  player_name?: string;
  team_name?: string;
  coach_name?: string;
}

type PlayerType = {
  id: string;
  name: string;
  team_id: string;
  team: {
    id: string;
    name: string;
  };
} | null;

type CoachType = {
  id: string;
  name: string;
} | null;

interface CollectionsProps {
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
}

export const PaymentCollectionsScreen = ({ 
  refreshing = false, 
  onRefresh = () => Promise.resolve()
}: CollectionsProps) => {
  const [collections, setCollections] = useState<PaymentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // State for filters
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedCollectionStatus, setSelectedCollectionStatus] = useState<boolean | null>(null); // true for Reviewed, false for Pending
  const [coaches, setCoaches] = useState<CoachType[]>([]);
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);
  const [isCollectionStatusModalVisible, setIsCollectionStatusModalVisible] = useState(false);

  const collectionStatusOptions = [
    { value: null, label: 'All Status' },
    { value: false, label: 'Pending Review' },
    { value: true, label: 'Reviewed by Admin' },
  ];

  useEffect(() => {
    fetchCollections();
    fetchCoaches();
  }, [selectedCoachId, selectedCollectionStatus]); // Re-fetch when filters change
  
  const fetchCollections = async () => {
    try {
      setLoading(true);
      
      let query = supabase.rpc('get_all_payment_collections_with_data') as any;
      
      // Apply filters
      if (selectedCoachId) {
        query = query.eq('coach_id', selectedCoachId);
      }
      
      if (selectedCollectionStatus !== null) {
        query = query.eq('is_processed', selectedCollectionStatus);
      }

      const { data, error } = await query as { data: PaymentCollection[] | null, error: any };
      
      if (error) {
        console.error('Error fetching collections:', error);
        Alert.alert('Error', 'Failed to load collections');
        return;
      }
      
      console.log('Collections data fetched:', data?.length, 'records');
      
      if (!data || data.length === 0) {
        setCollections([]);
        setLoading(false);
        return;
      }
      
      setCollections(data);
      
    } catch (error) {
      console.error('Error in fetchCollections:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name');
        
      if (error) throw error;
      
      setCoaches(data || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    }
  };

  const handleCoachSelect = (coachId: string | null) => {
    setSelectedCoachId(coachId);
    setIsCoachModalVisible(false);
  };

  const handleCollectionStatusSelect = (status: boolean | null) => {
    setSelectedCollectionStatus(status);
    setIsCollectionStatusModalVisible(false);
  };
  
  const handleMarkAsReviewed = async (collection: PaymentCollection) => {
    try {
      setProcessing(collection.id);
      
      // Only mark the collection as processed/reviewed
      const { error: collectionError } = await supabase
        .from('payment_collections')
        .update({
          is_processed: true,
          processed_date: new Date().toISOString()
        })
        .eq('id', collection.id);
        
      if (collectionError) {
        console.error('Error marking collection as reviewed:', collectionError);
        throw collectionError;
      }
      
      // Trigger event and update UI
      triggerEvent('payment_collection_reviewed', collection.player_id);
      
      // Refresh collections list with current filters
      fetchCollections();
      
      Alert.alert('Success', `Collection marked as reviewed for ${collection.player_name}`);
    } catch (error) {
      console.error('Error marking collection as reviewed:', error);
      Alert.alert('Error', 'Failed to mark collection as reviewed');
    } finally {
      setProcessing(null);
    }
  };
  
  const handleDeleteCollection = async (collection: PaymentCollection) => {
    Alert.alert(
      'Confirm Deletion',
      'Make sure the player\'s payment status has been updated before deleting this note.',
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
              
              // Refresh the list with current filters
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }
  
  const renderCollectionCard = ({ item }: { item: PaymentCollection }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={styles.playerName}>{item.player_name}</Text>
          <View style={styles.headerActions}>
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
          
          <View style={styles.collectionDetail}>
            <Text style={styles.detailLabel}>Collected by:</Text>
            <Text style={styles.detailValue}>{item.coach_name}</Text>
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
        
        {/* Add small review button directly in the content */}
        {!item.is_processed && (
          <View style={styles.reviewButtonContainer}>
            <TouchableOpacity
              style={styles.reviewButton}
              disabled={!!processing}
              onPress={() => handleMarkAsReviewed(item)}
            >
              {processing === item.id ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.reviewButtonText}>Mark as Reviewed</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Card.Content>
    </Card>
  );
  
  return (
    <View style={styles.container}>
      {/* Filter Section */}
      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setIsCoachModalVisible(true)}
          >
            <MaterialCommunityIcons name="account-tie-outline" size={20} color={COLORS.primary} style={styles.filterIcon} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {selectedCoachId ? coaches.find(c => c?.id === selectedCoachId)?.name || 'Unknown Coach' : 'All Coaches'}
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
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="cash-register" size={48} color={COLORS.grey[400]} />
            <Text style={styles.emptyText}>No pending collections</Text>
          </View>
        }
        renderItem={renderCollectionCard}
      />

      {/* Coach Filter Modal */}
      <CoachFilterModal
        isVisible={isCoachModalVisible}
        onClose={() => setIsCoachModalVisible(false)}
        coaches={coaches}
        selectedCoachId={selectedCoachId}
        onSelect={handleCoachSelect}
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
  card: {
    margin: SPACING.md,
    backgroundColor: '#EEFBFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerActions: {
    flexDirection: 'row',
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
    marginRight: SPACING.md,
  },
  deleteIcon: {
    padding: SPACING.xs,
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
  noteText: {
    fontSize: 14,
    color: COLORS.grey[600],
    flex: 1,
    textAlign: 'right',
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
  reviewButtonContainer: {
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  reviewButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
  },
  reviewButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.grey[600],
    textAlign: 'center',
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
interface CoachFilterModalProps {
  isVisible: boolean;
  onClose: () => void;
  coaches: CoachType[];
  selectedCoachId: string | null;
  onSelect: (coachId: string | null) => void;
}

const CoachFilterModal = ({ isVisible, onClose, coaches, selectedCoachId, onSelect }: CoachFilterModalProps) => (
  <Modal
    visible={isVisible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Coach</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.modalOption, !selectedCoachId && styles.modalOptionSelected]}
          onPress={() => onSelect(null)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="account-tie-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.modalOptionText, !selectedCoachId && styles.modalOptionTextSelected]}>All Coaches</Text>
          </View>
          {!selectedCoachId && (
            <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>
        
        {coaches.map(coach => (
          <TouchableOpacity
            key={coach?.id}
            style={[styles.modalOption, selectedCoachId === coach?.id && styles.modalOptionSelected]}
            onPress={() => onSelect(coach ? coach.id : null)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-tie-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalOptionText, selectedCoachId === coach?.id && styles.modalOptionTextSelected]}>
                {coach?.name}
              </Text>
            </View>
            {selectedCoachId === coach?.id && (
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
                name={option.value === true ? 'check-circle-outline' : option.value === false ? 'clock-outline' : 'cash-check'} // Icons based on status
                size={20} 
                color={option.value === true ? COLORS.success : option.value === false ? COLORS.warning : COLORS.primary} // Colors based on status
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