import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
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
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  useEffect(() => {
    fetchCollections();
  }, []);
  
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
      console.log('Raw collections data:', JSON.stringify(data, null, 2));
      
      if (!data || data.length === 0) {
        setCollections([]);
        setLoading(false);
        return;
      }
      
      // The data already includes player_name and team_name from the RPC function
      setCollections(data);
      
    } catch (error) {
      console.error('Error fetching collections:', error);
      Alert.alert('Error', 'Failed to load collections data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteCollection = async (collection: PaymentCollection) => {
    Alert.alert(
      'Confirm Deletion',
      'Make sure that admin has reviewed your note and changed the payment status before deleting.',
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
}); 