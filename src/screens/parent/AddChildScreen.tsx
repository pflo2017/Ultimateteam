import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable, Modal } from 'react-native';
import { Text, TextInput, RadioButton } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';

type AddChildScreenNavigationProp = NativeStackNavigationProp<ParentStackParamList>;

export const AddChildScreen = () => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [medicalVisaStatus, setMedicalVisaStatus] = useState<'valid' | 'pending' | 'expired'>('pending');
  const [medicalVisaIssueDate, setMedicalVisaIssueDate] = useState<Date | null>(null);
  const [showMedicalVisaDatePicker, setShowMedicalVisaDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showMedicalVisaDatePickerModal, setShowMedicalVisaDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(birthDate);
  const [tempMedicalVisaDate, setTempMedicalVisaDate] = useState<Date | null>(medicalVisaIssueDate);

  const navigation = useNavigation<AddChildScreenNavigationProp>();

  const openDatePicker = () => {
    setTempDate(birthDate);
    setShowDatePickerModal(true);
  };

  const confirmDatePicker = () => {
    setBirthDate(tempDate);
    setShowDatePickerModal(false);
  };

  const cancelDatePicker = () => {
    setShowDatePickerModal(false);
  };

  const openMedicalVisaDatePicker = () => {
    setTempMedicalVisaDate(medicalVisaIssueDate || new Date());
    setShowMedicalVisaDatePickerModal(true);
  };

  const confirmMedicalVisaDatePicker = () => {
    setMedicalVisaIssueDate(tempMedicalVisaDate);
    setShowMedicalVisaDatePickerModal(false);
  };

  const cancelMedicalVisaDatePicker = () => {
    setShowMedicalVisaDatePickerModal(false);
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

    if (medicalVisaStatus === 'valid' && !medicalVisaIssueDate) {
      Alert.alert('Error', 'Please select the medical visa issue date');
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

      // Insert into parent_children
      const { error: childError } = await supabase
        .from('parent_children')
        .insert({
          full_name: name.trim(),
          birth_date: birthDate.toISOString(),
          team_id: team.id,
          parent_id: parent.id,
          medical_visa_status: medicalVisaStatus,
          medical_visa_issue_date: medicalVisaIssueDate?.toISOString(),
          is_active: true,
        });

      if (childError) throw childError;

      // Insert into players using a Supabase function
      const { error: playerError } = await supabase.rpc('insert_player_for_child', {
        p_name: name.trim(),
        p_team_id: team.id,
        p_admin_id: team.admin_id,
        p_club_id: team.club_id,
        p_parent_id: parent.id
      });

      if (playerError) {
        Alert.alert('Warning', 'Child added, but failed to add player to admin dashboard. Please contact support.');
        console.error('Error adding player:', playerError);
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
          <Text style={styles.title}>Add Child</Text>
          <Text style={styles.subtitle}>Enter your child's information</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="account-child" color={COLORS.primary} />}
          />

          <Text style={styles.inputLabel}>Birthdate</Text>
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
            label="Team Access Code"
            value={teamCode}
            onChangeText={handleTeamCodeChange}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="account-group" color={COLORS.primary} />}
            maxLength={6}
          />

          {teamName && (
            <Text style={styles.teamName}>
              Team: {teamName}
            </Text>
          )}

          <View style={styles.medicalVisaSection}>
            <Text style={styles.sectionTitle}>Medical Visa Status</Text>
            <View style={styles.statusRow}>
              {['valid', 'pending', 'expired'].map(status => (
                <Pressable
                  key={status}
                  onPress={() => {
                    setMedicalVisaStatus(status as 'valid' | 'pending' | 'expired');
                    if (status !== 'valid') setMedicalVisaIssueDate(null);
                  }}
                  style={[styles.statusOption, medicalVisaStatus === status && styles.statusOptionSelected]}
                >
                  <MaterialCommunityIcons
                    name={medicalVisaStatus === status ? 'check-circle' : 'checkbox-blank-circle-outline'}
                    size={20}
                    color={status === 'valid' ? COLORS.success : status === 'pending' ? COLORS.warning : COLORS.error}
                  />
                  <Text style={[styles.statusLabel, { color: status === 'valid' ? COLORS.success : status === 'pending' ? COLORS.warning : COLORS.error }]}> 
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {medicalVisaStatus === 'valid' && (
              <Pressable
                onPress={openMedicalVisaDatePicker}
                style={styles.dateInput}
              >
                <MaterialCommunityIcons 
                  name="calendar-check" 
                  size={24} 
                  color={COLORS.success}
                />
                <Text style={styles.dateText}>
                  {medicalVisaIssueDate 
                    ? medicalVisaIssueDate.toLocaleDateString()
                    : 'Select Issue Date'}
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable 
            onPress={handleAddChild}
            disabled={isLoading}
            style={[styles.addButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Adding...' : 'Add Child'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Date Picker Modal for Birth Date */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={cancelDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) setTempDate(selectedDate);
              }}
              maximumDate={new Date()}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={cancelDatePicker} style={styles.modalButton}><Text>Cancel</Text></Pressable>
              <Pressable onPress={confirmDatePicker} style={styles.modalButton}><Text>OK</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Date Picker Modal for Medical Visa Issue Date */}
      <Modal
        visible={showMedicalVisaDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={cancelMedicalVisaDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <DateTimePicker
              value={tempMedicalVisaDate || new Date()}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) setTempMedicalVisaDate(selectedDate);
              }}
              maximumDate={new Date()}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={cancelMedicalVisaDatePicker} style={styles.modalButton}><Text>Cancel</Text></Pressable>
              <Pressable onPress={confirmMedicalVisaDatePicker} style={styles.modalButton}><Text>OK</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    width: 320,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
  },
}); 