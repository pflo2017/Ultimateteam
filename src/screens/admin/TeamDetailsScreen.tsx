import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { Text, Button, Portal, Modal, TextInput, Avatar } from 'react-native-paper';
import { COLORS } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AdminStackParamList } from '../../types/navigation';
import { supabase } from '../../lib/supabase';

type TeamDetailsRouteProp = RouteProp<AdminStackParamList, 'TeamDetails'>;

interface Coach {
  id: string;
  name: string;
  access_code: string;
}

interface Team {
  id: string;
  name: string;
  access_code: string;
  coach_id: string | null;
  is_active: boolean;
}

export const TeamDetailsScreen = () => {
  const [team, setTeam] = useState<Team | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [editedName, setEditedName] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [showCoachSelect, setShowCoachSelect] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<TeamDetailsRouteProp>();

  useEffect(() => {
    fetchTeamAndCoaches();
  }, []);

  const fetchTeamAndCoaches = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', route.params.teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);
      setEditedName(teamData.name);
      setSelectedCoachId(teamData.coach_id);

      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('*')
        .eq('is_active', true);

      if (coachesError) throw coachesError;
      setCoaches(coachesData || []);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const handleSave = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Team name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .update({ 
          name: editedName.trim(),
          coach_id: selectedCoachId 
        })
        .eq('id', route.params.teamId);

      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to update team');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', route.params.teamId);

              if (error) throw error;
              navigation.goBack();
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'Failed to delete team');
            }
          }
        }
      ]
    );
  };

  const selectedCoach = coaches.find(c => c.id === selectedCoachId);

  return (
    <Portal>
      <Modal
        visible={true}
        onDismiss={() => navigation.goBack()}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Team</Text>
            <Button 
              mode="text" 
              onPress={() => navigation.goBack()}
              icon="close"
            >
              Close
            </Button>
          </View>

          <View style={styles.content}>
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Coach</Text>
              <Button
                mode="outlined"
                onPress={() => setShowCoachSelect(true)}
                icon={selectedCoach ? () => (
                  <Avatar.Text 
                    size={24} 
                    label={selectedCoach.name.split(' ').map(n => n[0]).join('')} 
                    style={styles.avatar}
                  />
                ) : 'account'}
                contentStyle={styles.coachButton}
                style={styles.coachButtonContainer}
              >
                {selectedCoach ? selectedCoach.name : 'Select Coach'}
              </Button>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={handleDelete}
              style={styles.deleteButton}
              contentStyle={styles.buttonContent}
              icon="delete"
            >
              Delete Team
            </Button>

            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              contentStyle={styles.buttonContent}
            >
              Save Changes
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
              contentStyle={styles.buttonContent}
            >
              Cancel
            </Button>
          </View>
        </View>

        <Modal
          visible={showCoachSelect}
          onDismiss={() => setShowCoachSelect(false)}
          contentContainerStyle={styles.selectModalContainer}
        >
          <View style={styles.selectModal}>
            <View style={styles.selectModalHeader}>
              <Text style={styles.selectModalTitle}>Select Coach</Text>
              <Button 
                mode="text" 
                onPress={() => setShowCoachSelect(false)}
                icon="close"
              >
                Close
              </Button>
            </View>

            <ScrollView style={styles.coachList}>
              {coaches.map((coach) => (
                <Pressable
                  key={coach.id}
                  style={[
                    styles.coachOption,
                    selectedCoachId === coach.id && styles.coachOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedCoachId(coach.id);
                    setShowCoachSelect(false);
                  }}
                >
                  <View style={styles.coachOptionContent}>
                    <Avatar.Text 
                      size={40}
                      label={coach.name.split(' ').map(n => n[0]).join('')}
                      style={[
                        styles.coachAvatar,
                        selectedCoachId === coach.id && styles.selectedCoachAvatar
                      ]}
                    />
                    <Text style={[
                      styles.coachOptionText,
                      selectedCoachId === coach.id && styles.coachOptionTextSelected
                    ]}>
                      {coach.name}
                    </Text>
                  </View>
                  {selectedCoachId === coach.id && (
                    <MaterialCommunityIcons 
                      name="check" 
                      size={24} 
                      color={COLORS.primary}
                      style={styles.checkIcon} 
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  content: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.background,
  },
  inputOutline: {
    borderRadius: 12,
  },
  coachButtonContainer: {
    borderRadius: 12,
  },
  coachButton: {
    height: 48,
    justifyContent: 'flex-start',
  },
  avatar: {
    marginRight: 8,
  },
  footer: {
    gap: 12,
    marginTop: 32,
  },
  buttonContent: {
    height: 48,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  cancelButton: {
    borderRadius: 12,
  },
  selectModalContainer: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  selectModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  selectModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  coachList: {
    maxHeight: 400,
  },
  coachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  coachOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coachAvatar: {
    marginRight: 12,
    backgroundColor: COLORS.primary + '20',
  },
  selectedCoachAvatar: {
    backgroundColor: COLORS.primary,
  },
  coachOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  coachOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  coachOptionSelected: {
    backgroundColor: COLORS.primary + '08',
  },
  checkIcon: {
    marginLeft: 12,
  },
}); 