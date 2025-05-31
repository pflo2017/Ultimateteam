import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Activity, ActivityType } from '../../services/activitiesService';
import { format, parseISO } from 'date-fns';

interface ActivitySelectorProps {
  selectedActivity: Activity | null;
  activities: Activity[];
  isLoading: boolean;
  onActivitySelect: (activity: Activity) => void;
}

export const ActivitySelector: React.FC<ActivitySelectorProps> = ({
  selectedActivity,
  activities,
  isLoading,
  onActivitySelect
}) => {
  const [showActivityModal, setShowActivityModal] = useState(false);
  
  // Log activities when they change
  useEffect(() => {
    console.log('ActivitySelector - Activities available:', activities.length);
    activities.forEach(activity => {
      console.log('Activity:', activity.id, activity.title, activity.type, 'Start time:', activity.start_time);
    });
  }, [activities]);

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return 'whistle';
      case 'game':
        return 'trophy-outline';
      case 'tournament':
        return 'tournament';
      default:
        return 'calendar-text';
    }
  };

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return COLORS.primary;
      case 'game':
        return '#E67E22'; // Orange
      case 'tournament':
        return '#8E44AD'; // Purple
      default:
        return '#2ECC71'; // Green
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'game':
        return 'Game';
      case 'tournament':
        return 'Tournament';
      default:
        return 'Event';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.activityButton}
        onPress={() => setShowActivityModal(true)}
        disabled={isLoading || activities.length === 0}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <MaterialCommunityIcons 
              name={selectedActivity ? getActivityIcon(selectedActivity.type) : 'calendar-blank'} 
              size={20} 
              color={selectedActivity ? getActivityColor(selectedActivity.type) : COLORS.primary} 
            />
            <Text style={styles.activityText}>
              {selectedActivity ? selectedActivity.title : (activities.length === 0 ? 'No activities found' : 'Select Activity')}
            </Text>
            {activities.length > 0 && (
              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
            )}
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={showActivityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Activity</Text>
              <TouchableOpacity 
                onPress={() => setShowActivityModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No activities available for the selected date and type</Text>
              </View>
            ) : (
              <FlatList
                data={activities}
                keyExtractor={(item) => item.id || ''}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.optionItem, 
                      selectedActivity?.id === item.id && styles.optionSelected
                    ]}
                    onPress={() => { 
                      onActivitySelect(item); 
                      setShowActivityModal(false); 
                    }}
                  >
                    <View style={styles.optionRow}>
                      <View style={styles.activityTypeIcon}>
                        <MaterialCommunityIcons 
                          name={getActivityIcon(item.type)} 
                          size={20} 
                          color={getActivityColor(item.type)} 
                        />
                      </View>
                      <View style={styles.activityDetails}>
                        <Text style={styles.activityTitle}>{item.title}</Text>
                        <View style={styles.activityInfo}>
                          <Text style={styles.activityType}>{getActivityTypeLabel(item.type)}</Text>
                          <Text style={styles.activityTime}>{formatTime(item.start_time)}</Text>
                        </View>
                      </View>
                    </View>
                    {selectedActivity?.id === item.id && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  activityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
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
    paddingBottom: 20,
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
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  optionSelected: {
    backgroundColor: COLORS.grey[100],
  },
  optionRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1,
  },
  activityTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityType: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginRight: SPACING.sm,
  },
  activityTime: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.grey[500],
    textAlign: 'center',
  },
}); 