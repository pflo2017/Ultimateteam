import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert, ScrollView, Modal as RNModal } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import type { RouteProp } from '@react-navigation/native';
import type { AdminStackParamList } from '../../types/navigation';
import { useTranslation } from 'react-i18next';

type EditTeamScreenRouteProp = RouteProp<AdminStackParamList, 'EditTeam'>;

interface Coach {
  id: string;
  name: string;
}

export const EditTeamScreen = () => {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<EditTeamScreenRouteProp>();
  const { teamId } = route.params;
  const { t } = useTranslation();

  useEffect(() => {
    console.log('EditTeamScreen mounted');
    const loadData = async () => {
      console.log('Starting to load data...');
      try {
        await Promise.all([loadTeamData(), loadCoaches()]);
        console.log('Data loading completed');
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  // Debug logs for state changes
  useEffect(() => {
    console.log('Coaches state updated:', coaches);
  }, [coaches]);

  useEffect(() => {
    console.log('Selected coach ID updated:', selectedCoachId);
  }, [selectedCoachId]);

  useEffect(() => {
    console.log('Modal visibility changed:', isCoachModalVisible);
  }, [isCoachModalVisible]);

  const loadTeamData = async () => {
    try {
      console.log('Loading team data for ID:', teamId);
      const { data, error } = await supabase
        .from('teams')
        .select(`
          name,
          coach_id,
          coaches (
            id,
            name
          )
        `)
        .eq('id', teamId)
        .single();

      if (error) {
        console.error('Error loading team data:', error);
        throw error;
      }

      console.log('Loaded team data:', data);
      if (data) {
        setTeamName(data.name);
        setSelectedCoachId(data.coach_id);
      }
    } catch (error) {
      console.error('Error in loadTeamData:', error);
      Alert.alert(t('common.error'), t('admin.editTeam.failedToLoadTeamData'));
    }
  };

  const loadCoaches = async () => {
    try {
      console.log('Starting to fetch coaches...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      console.log('Fetching coaches for user:', user.id);
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();

      if (!club) {
        console.error('No club found');
        return;
      }

      console.log('Fetching coaches for club:', club.id);
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching coaches:', error);
        throw error;
      }

      console.log('Fetched coaches:', data);
      if (data) {
        setCoaches(data);
      }
    } catch (error) {
      console.error('Error in loadCoaches:', error);
      Alert.alert(t('common.error'), t('admin.editTeam.failedToLoadCoaches'));
    }
  };

  const handleUpdateTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert(t('common.error'), t('admin.editTeam.pleaseFillTeamName'));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: teamName.trim(),
          coach_id: selectedCoachId,
        })
        .eq('id', teamId);

      if (error) throw error;

      Alert.alert(t('common.success'), t('admin.editTeam.teamUpdated'));
      navigation.goBack();
    } catch (error) {
      console.error('Error updating team:', error);
      Alert.alert(t('common.error'), t('admin.editTeam.failedToUpdateTeam'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      t('admin.editTeam.deleteTeam'),
      t('admin.editTeam.deleteConfirmation'),
      [
        {
          text: t('admin.addCoach.cancel'),
          style: 'cancel',
        },
        {
          text: t('admin.addCoach.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId);

              if (error) throw error;

              Alert.alert(t('common.success'), t('admin.editTeam.teamDeleted'));
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting team:', error);
              Alert.alert(t('common.error'), t('admin.editTeam.failedToDeleteTeam'));
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const selectedCoach = coaches.find(coach => coach.id === selectedCoachId);

  const handleCoachSelectorPress = () => {
    console.log('Coach selector pressed');
    console.log('Current coaches:', coaches);
    console.log('Current selected coach:', selectedCoachId);
    setIsCoachModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Pressable 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons 
            name="arrow-left" 
            size={24} 
            color={COLORS.primary}
          />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('admin.editTeam.title')}</Text>
            <Text style={styles.subtitle}>{t('admin.editTeam.subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label={t('admin.editTeam.teamName')}
              value={teamName}
              onChangeText={setTeamName}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account-multiple" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />

            <Pressable
              style={styles.coachSelector}
              onPress={handleCoachSelectorPress}
            >
              <View style={styles.coachSelectorContent}>
                <MaterialCommunityIcons
                  name="account-tie"
                  size={24}
                  color={COLORS.primary}
                />
                <Text style={styles.coachSelectorText}>
                  {selectedCoach ? selectedCoach.name : t('admin.editTeam.selectCoach')}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={COLORS.grey[400]}
              />
            </Pressable>

            <Pressable 
              onPress={handleUpdateTeam}
              disabled={isLoading}
              style={[styles.updateButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('admin.editTeam.updating') : t('admin.editTeam.updateTeam')}
              </Text>
            </Pressable>

            <Pressable 
              onPress={handleDeleteTeam}
              disabled={isLoading}
              style={[styles.deleteButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={[styles.buttonText, styles.deleteButtonText]}>
                {t('admin.editTeam.deleteTeam')}
              </Text>
            </Pressable>
          </View>
        </View>

        <RNModal
          visible={isCoachModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            console.log('Modal closing via back button/gesture');
            setIsCoachModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('admin.editTeam.selectCoach')}</Text>
                <Pressable 
                  onPress={() => {
                    console.log('Close button pressed');
                    setIsCoachModalVisible(false);
                  }}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </Pressable>
              </View>
              
              <ScrollView style={styles.coachesList}>
                <Pressable
                  style={[
                    styles.coachItem,
                    selectedCoachId === null && styles.selectedCoachItem
                  ]}
                  onPress={() => {
                    console.log('No coach option selected');
                    setSelectedCoachId(null);
                    setIsCoachModalVisible(false);
                  }}
                >
                  <View style={styles.coachItemContent}>
                    <MaterialCommunityIcons
                      name="account-off"
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.coachName}>{t('admin.editTeam.noCoach')}</Text>
                  </View>
                  {selectedCoachId === null && (
                    <MaterialCommunityIcons
                      name="check"
                      size={24}
                      color={COLORS.primary}
                    />
                  )}
                </Pressable>
                
                {coaches.length === 0 ? (
                  <Text style={styles.noCoachesText}>{t('admin.editTeam.noCoachesAvailable')}</Text>
                ) : (
                  coaches.map((coach) => {
                    console.log('Rendering coach:', coach);
                    return (
                      <Pressable
                        key={coach.id}
                        style={[
                          styles.coachItem,
                          selectedCoachId === coach.id && styles.selectedCoachItem
                        ]}
                        onPress={() => {
                          console.log('Coach selected:', coach);
                          setSelectedCoachId(coach.id);
                          setIsCoachModalVisible(false);
                        }}
                      >
                        <View style={styles.coachItemContent}>
                          <MaterialCommunityIcons
                            name="account-tie"
                            size={24}
                            color={COLORS.primary}
                          />
                          <Text style={styles.coachName}>{coach.name}</Text>
                        </View>
                        {selectedCoachId === coach.id && (
                          <MaterialCommunityIcons
                            name="check"
                            size={24}
                            color={COLORS.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </RNModal>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.xl * 2,
    left: SPACING.lg,
    zIndex: 1,
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    paddingTop: SPACING.xl * 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  form: {
    gap: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.background,
    height: 58,
  },
  inputOutline: {
    borderRadius: 100,
    borderWidth: 1,
  },
  inputContent: {
    fontFamily: 'Urbanist',
    fontSize: FONT_SIZES.md,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  deleteButton: {
    backgroundColor: COLORS.white,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
  deleteButtonText: {
    color: COLORS.error,
  },
  coachSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
  },
  coachSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  coachSelectorText: {
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
    padding: SPACING.lg,
    maxHeight: '70%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  coachesList: {
    paddingTop: SPACING.sm,
  },
  coachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.grey[100],
  },
  selectedCoachItem: {
    backgroundColor: COLORS.primary + '10',
  },
  coachItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  coachName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  noCoachesText: {
    textAlign: 'center',
    color: COLORS.grey[600],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
}); 