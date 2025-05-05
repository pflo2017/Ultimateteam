import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable, Modal } from 'react-native';
import { Text, TextInput, RadioButton } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';

type EditChildScreenNavigationProp = NativeStackNavigationProp<ParentStackParamList>;
type EditChildScreenRouteProp = RouteProp<ParentStackParamList, 'EditChild'>;

export const EditChildScreen = () => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [medicalVisaStatus, setMedicalVisaStatus] = useState<'valid' | 'pending' | 'expired'>('pending');
  const [medicalVisaIssueDate, setMedicalVisaIssueDate] = useState<Date | null>(null);
  const [showMedicalVisaDatePicker, setShowMedicalVisaDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showMedicalVisaDatePickerModal, setShowMedicalVisaDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(birthDate);
  const [tempMedicalVisaDate, setTempMedicalVisaDate] = useState<Date | null>(medicalVisaIssueDate);

  const navigation = useNavigation<EditChildScreenNavigationProp>();
  const route = useRoute<EditChildScreenRouteProp>();
  const { childId } = route.params;

  useEffect(() => {
    loadChildData();
  }, []);

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

  const loadChildData = async () => {
    try {
      const { data, error } = await supabase
        .from('parent_children')
        .select(`
          full_name,
          birth_date,
          team_id,
          teams (
            name,
            access_code
          ),
          medical_visa_status,
          medical_visa_issue_date
        `)
        .eq('id', childId)
        .single();

      if (error) throw error;

      setName(data.full_name);
      setBirthDate(new Date(data.birth_date));
      setTeamCode(data.teams[0]?.access_code || '');
      setTeamName(data.teams[0]?.name || '');
      setMedicalVisaStatus(data.medical_visa_status);
      if (data.medical_visa_issue_date) {
        setMedicalVisaIssueDate(new Date(data.medical_visa_issue_date));
      }
    } catch (error) {
      console.error('Error loading child data:', error);
      Alert.alert('Error', 'Failed to load child data');
    }
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

  const handleUpdateChild = async () => {
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
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('access_code', teamCode)
        .single();

      if (!team) throw new Error('Team not found');

      const { error } = await supabase
        .from('parent_children')
        .update({
          full_name: name.trim(),
          birth_date: birthDate.toISOString(),
          team_id: team.id,
          medical_visa_status: medicalVisaStatus,
          medical_visa_issue_date: medicalVisaIssueDate?.toISOString(),
        })
        .eq('id', childId);

      if (error) throw error;

      Alert.alert('Success', 'Child updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (error) {
      console.error('Error updating child:', error);
      Alert.alert('Error', 'Failed to update child');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = () => {
    Alert.alert(
      'Delete Child',
      'Are you sure you want to delete this child? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { error } = await supabase
                .from('parent_children')
                .update({ is_active: false })
                .eq('id', childId);

              if (error) throw error;

              Alert.alert('Success', 'Child deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack()
                }
              ]);
            } catch (error) {
              console.error('Error deleting child:', error);
              Alert.alert('Error', 'Failed to delete child');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.title}>Edit Child</Text>
          <Text style={styles.subtitle}>Update your child's information</Text>
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
            left={<TextInput.Icon icon="account-circle" color={COLORS.primary} />}
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
            editable={false}
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
            onPress={handleUpdateChild}
            disabled={isLoading}
            style={[styles.updateButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Updating...' : 'Update Child'}
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleDeleteChild}
            disabled={isDeleting}
            style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
          >
            <MaterialCommunityIcons 
              name="delete" 
              size={20} 
              color={COLORS.error}
            />
            <Text style={[styles.buttonText, styles.deleteButtonText]}>
              Delete Child
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
    flexDirection: 'row',
    gap: SPACING.sm,
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