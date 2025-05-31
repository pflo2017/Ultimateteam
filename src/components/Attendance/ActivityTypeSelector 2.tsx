import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityType } from '../../types/attendance';

interface ActivityTypeSelectorProps {
  selectedType?: ActivityType | 'all';
  selectedTypes?: ActivityType[];
  onTypeChange?: (type: ActivityType | 'all') => void;
  onSelectTypes?: (types: ActivityType[]) => void;
  multiSelect?: boolean;
}

export const ActivityTypeSelector: React.FC<ActivityTypeSelectorProps> = ({
  selectedType,
  selectedTypes = [],
  onTypeChange,
  onSelectTypes,
  multiSelect = false
}) => {
  const [showTypeModal, setShowTypeModal] = useState(false);

  const getActivityTypeLabel = (type: ActivityType | 'all') => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'game':
        return 'Game';
      case 'tournament':
        return 'Tournament';
      case 'other':
        return 'Other';
      case 'all':
        return 'All Types';
      default:
        return 'Event';
    }
  };

  const getActivityIcon = (type: ActivityType | 'all') => {
    switch (type) {
      case 'training':
        return 'whistle';
      case 'game':
        return 'trophy-outline';
      case 'tournament':
        return 'tournament';
      case 'all':
        return 'filter-variant-remove';
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

  const handleTypeSelect = (type: ActivityType | 'all') => {
    if (multiSelect && onSelectTypes) {
      if (type === 'all') {
        onSelectTypes([]);
      } else {
        const newSelection = selectedTypes.includes(type as ActivityType)
          ? selectedTypes.filter(t => t !== type)
          : [...selectedTypes, type as ActivityType];
        onSelectTypes(newSelection);
      }
    } else if (onTypeChange) {
      onTypeChange(type);
      setShowTypeModal(false);
    }
  };

  const getSelectedTypesText = () => {
    if (multiSelect) {
      if (selectedTypes.length === 0) return 'All Types';
      if (selectedTypes.length === 1) {
        return getActivityTypeLabel(selectedTypes[0]);
      }
      return `${selectedTypes.length} Types Selected`;
    } else {
      return getActivityTypeLabel(selectedType || 'all');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.activityTypeButton}
        onPress={() => setShowTypeModal(true)}
      >
        <MaterialCommunityIcons 
          name={multiSelect 
            ? (selectedTypes.length === 0 ? 'filter-variant-remove' : getActivityIcon(selectedTypes[0]))
            : getActivityIcon(selectedType || 'all')
          } 
          size={20} 
          color={multiSelect
            ? (selectedTypes.length === 0 ? COLORS.primary : getActivityColor(selectedTypes[0]))
            : (selectedType !== 'all' ? getActivityColor(selectedType as ActivityType) : COLORS.primary)
          } 
        />
        <Text style={styles.activityTypeText}>
          {getSelectedTypesText()}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
      </TouchableOpacity>

      <Modal
        visible={showTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {multiSelect ? 'Activity Types' : 'Activity Type'}</Text>
              <TouchableOpacity 
                onPress={() => setShowTypeModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {!multiSelect && (
              <TouchableOpacity
                style={[styles.optionItem, selectedType === 'all' && styles.optionSelected]}
                onPress={() => handleTypeSelect('all')}
              >
                <View style={styles.optionRow}>
                  <MaterialCommunityIcons 
                    name="filter-variant-remove" 
                    size={20} 
                    color={COLORS.primary} 
                    style={styles.optionIcon} 
                  />
                  <Text style={[styles.optionText, selectedType === 'all' && styles.optionTextSelected]}>
                    All Types
                  </Text>
                </View>
                {selectedType === 'all' && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            
            {(['training', 'game', 'tournament', 'other'] as ActivityType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionItem, 
                  (multiSelect ? selectedTypes.includes(type) : selectedType === type) && styles.optionSelected
                ]}
                onPress={() => handleTypeSelect(type)}
              >
                <View style={styles.optionRow}>
                  <MaterialCommunityIcons 
                    name={getActivityIcon(type)} 
                    size={20} 
                    color={getActivityColor(type)} 
                    style={styles.optionIcon} 
                  />
                  <Text style={[
                    styles.optionText, 
                    (multiSelect ? selectedTypes.includes(type) : selectedType === type) && styles.optionTextSelected
                  ]}>
                    {getActivityTypeLabel(type)}
                  </Text>
                </View>
                {(multiSelect ? selectedTypes.includes(type) : selectedType === type) && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}

            {multiSelect && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    onSelectTypes?.([]);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowTypeModal(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  activityTypeButton: {
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
  activityTypeText: {
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
    alignItems: 'center' 
  },
  optionIcon: { 
    marginRight: 8 
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  optionTextSelected: {
    fontWeight: '500',
    color: COLORS.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.grey[200],
  },
  clearButton: {
    padding: SPACING.sm,
  },
  clearButtonText: {
    color: COLORS.grey[600],
    fontSize: 16,
  },
  doneButton: {
    padding: SPACING.sm,
  },
  doneButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
}); 