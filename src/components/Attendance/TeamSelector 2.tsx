import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Team {
  id: string;
  name: string;
}

interface TeamSelectorProps {
  selectedTeam?: Team | null;
  selectedTeams?: string[];
  teams: Team[];
  onTeamSelect?: (team: Team | null) => void;
  onSelectTeams?: (teamIds: string[]) => void;
  multiSelect?: boolean;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({
  selectedTeam,
  selectedTeams = [],
  teams,
  onTeamSelect,
  onSelectTeams,
  multiSelect = false
}) => {
  const [showTeamModal, setShowTeamModal] = useState(false);

  const handleTeamSelect = (team: Team | null) => {
    if (multiSelect && onSelectTeams) {
      if (!team) {
        onSelectTeams([]);
      } else {
        const newSelection = selectedTeams.includes(team.id)
          ? selectedTeams.filter(id => id !== team.id)
          : [...selectedTeams, team.id];
        onSelectTeams(newSelection);
      }
    } else if (onTeamSelect) {
      onTeamSelect(team);
    }
  };

  const getSelectedTeamsText = () => {
    if (multiSelect) {
      if (selectedTeams.length === 0) return 'All Teams';
      if (selectedTeams.length === 1) {
        const team = teams.find(t => t.id === selectedTeams[0]);
        return team?.name || 'Selected Team';
      }
      return `${selectedTeams.length} Teams Selected`;
    } else {
      return selectedTeam ? selectedTeam.name : 'All Teams';
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.teamButton}
        onPress={() => setShowTeamModal(true)}
      >
        <MaterialCommunityIcons 
          name="account-group" 
          size={20} 
          color={COLORS.primary} 
        />
        <Text style={styles.teamText}>
          {getSelectedTeamsText()}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
      </TouchableOpacity>

      <Modal
        visible={showTeamModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTeamModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {multiSelect ? 'Teams' : 'Team'}</Text>
              <TouchableOpacity 
                onPress={() => setShowTeamModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {!multiSelect && (
              <TouchableOpacity
                style={[styles.optionItem, !selectedTeam && styles.optionSelected]}
                onPress={() => { 
                  handleTeamSelect(null); 
                  setShowTeamModal(false); 
                }}
              >
                <View style={styles.optionRow}>
                  <MaterialCommunityIcons 
                    name="account-group" 
                    size={20} 
                    color={COLORS.primary} 
                    style={styles.optionIcon} 
                  />
                  <Text style={[styles.optionText, !selectedTeam && styles.optionTextSelected]}>
                    All Teams
                  </Text>
                </View>
                {!selectedTeam && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem, 
                    (multiSelect ? selectedTeams.includes(item.id) : selectedTeam?.id === item.id) && styles.optionSelected
                  ]}
                  onPress={() => { 
                    handleTeamSelect(item); 
                    if (!multiSelect) {
                      setShowTeamModal(false); 
                    }
                  }}
                >
                  <View style={styles.optionRow}>
                    <MaterialCommunityIcons 
                      name="account-group" 
                      size={20} 
                      color={COLORS.primary} 
                      style={styles.optionIcon} 
                    />
                    <Text style={[
                      styles.optionText, 
                      (multiSelect ? selectedTeams.includes(item.id) : selectedTeam?.id === item.id) && styles.optionTextSelected
                    ]}>
                      {item.name}
                    </Text>
                  </View>
                  {(multiSelect ? selectedTeams.includes(item.id) : selectedTeam?.id === item.id) && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />

            {multiSelect && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    onSelectTeams?.([]);
                    setShowTeamModal(false);
                  }}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowTeamModal(false)}
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
  teamButton: {
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
  teamText: {
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