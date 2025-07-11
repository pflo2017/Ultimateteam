import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable, Modal } from 'react-native';
import { Text, TextInput, RadioButton, Button } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarPickerModal } from '../../components/CalendarPickerModal';
import { useTranslation } from 'react-i18next';

type AddChildScreenNavigationProp = NativeStackNavigationProp<ParentStackParamList>;

export const AddChildScreen = () => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [teamCode, setTeamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(birthDate);

  const navigation = useNavigation<AddChildScreenNavigationProp>();
  const { t } = useTranslation();

  const openDatePicker = () => {
    setTempDate(birthDate || new Date());
    setShowDatePickerModal(true);
  };

  const confirmDatePicker = () => {
    setBirthDate(tempDate);
    setShowDatePickerModal(false);
  };

  const cancelDatePicker = () => {
    setShowDatePickerModal(false);
  };

  const validateTeamCode = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('access_code', code)
        .single();

      if (error) throw error;
      if (data) {
        setTeamName(data.name);
        return data.id;
      }
      return null;
    } catch (error) {
      console.error('Error validating team code:', error);
      return null;
    }
  };

  const handleTeamCodeChange = async (code: string) => {
    setTeamCode(code);
    if (code.length === 6) {
      const teamId = await validateTeamCode(code);
      if (!teamId) {
        Alert.alert('Error', 'Invalid team code');
        setTeamName(null);
      }
    } else {
      setTeamName(null);
    }
  };

  const handleAddChild = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your child\'s name');
      return;
    }

    if (!teamName) {
      Alert.alert('Error', 'Please enter a valid team code');
      return;
    }

    setIsLoading(true);
    try {
      // Get parent data directly from AsyncStorage 
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('Parent data not found. Please log out and log in again.');
      
      const parent = JSON.parse(parentData);
      if (!parent || !parent.id) throw new Error('User not authenticated. Please log out and log in again.');

      const { data: team } = await supabase
        .from('teams')
        .select('id, admin_id, club_id')
        .eq('access_code', teamCode)
        .single();

      if (!team) throw new Error('Team not found');

      // First create the player record using the insert_player_for_child function
      const { data: playerId, error: playerError } = await supabase.rpc('insert_player_for_child', {
        p_name: name.trim(),
        p_team_id: team.id,
        p_admin_id: team.admin_id,
        p_club_id: team.club_id,
        p_parent_id: parent.id,
        p_is_new_trial: false
      });

      if (playerError) {
        console.error('Error adding player:', playerError);
        throw new Error('Failed to create player record');
      }

      if (!playerId) {
        throw new Error('Player ID not returned from insert_player_for_child function');
      }

      // Then insert into parent_children with the player_id
      const { error: childError } = await supabase
        .from('parent_children')
        .insert({
          full_name: name.trim(),
          birth_date: birthDate.toISOString(),
          team_id: team.id,
          parent_id: parent.id,
          medical_visa_status: 'pending',
          medical_visa_issue_date: null,
          is_active: true,
          player_id: playerId
        });

      if (childError) {
        console.error('Error adding child:', childError);
        throw childError;
      }

      Alert.alert('Success', 'Child added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (error) {
      console.error('Error adding child:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('parent.addChild.title', 'Add Child')}</Text>
          <Text style={styles.subtitle}>{t('parent.addChild.subtitle', "Enter your child's information")}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('parent.addChild.fullName', 'Full Name')}
            value={name}
            onChangeText={setName}
            mode="flat"
            style={styles.input}
            theme={{ colors: { primary: '#0CC1EC' }}}
            left={<TextInput.Icon icon="account-child" color={COLORS.primary} style={{ marginRight: 30 }} />}
          />

          <Text style={styles.inputLabel}>{t('parent.addChild.birthdate', 'Birthdate')}</Text>
          <Pressable
            onPress={openDatePicker}
            style={styles.dateInput}
          >
            <MaterialCommunityIcons 
              name="calendar" 
              size={24} 
              color={COLORS.primary}
            />
            <Text style={styles.dateText}>
              {birthDate.toLocaleDateString()}
            </Text>
          </Pressable>

          <TextInput
            label={t('parent.addChild.teamAccessCode', 'Team Access Code')}
            value={teamCode}
            onChangeText={handleTeamCodeChange}
            mode="flat"
            style={styles.input}
            theme={{ colors: { primary: '#0CC1EC' }}}
            left={<TextInput.Icon icon="account-group" color={COLORS.primary} style={{ marginRight: 30 }} />}
            maxLength={6}
          />

          {teamName && (
            <Text style={styles.teamName}>
              {t('parent.addChild.teamName', 'Team') + ': ' + teamName}
            </Text>
          )}

          <Pressable 
            onPress={handleAddChild}
            disabled={isLoading}
            style={[styles.addButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('parent.addChild.adding', 'Adding...') : t('parent.addChild.addChild', 'Add Child')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Date Picker Modal using CalendarPickerModal for both platforms */}
      <CalendarPickerModal
        visible={showDatePickerModal}
        onCancel={cancelDatePicker}
        onConfirm={confirmDatePicker}
        value={tempDate}
        onValueChange={setTempDate}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
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
  inputLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontFamily: 'Urbanist',
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 100,
    height: 58,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    gap: SPACING.sm,
  },
  dateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontFamily: 'Urbanist',
  },
  teamName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontFamily: 'Urbanist',
    textAlign: 'center',
    marginTop: -SPACING.sm,
  },
  medicalVisaSection: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Urbanist',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.sm,
    gap: SPACING.md,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    opacity: 0.85,
  },
  statusOptionSelected: {
    opacity: 1,
  },
  statusLabel: {
    fontSize: FONT_SIZES.md,
    fontFamily: 'Urbanist',
    marginLeft: 6,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 16,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalHeaderText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Urbanist',
  },
  closeButton: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 100,
    backgroundColor: COLORS.grey[300],
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
  },
  modalContentCentered: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.lg,
    width: 340,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
    gap: 16,
  },
  modalTextButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  okText: {
    color: '#7366bd',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
}); 