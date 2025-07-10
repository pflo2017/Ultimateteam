import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable, Modal } from 'react-native';
import { Text, TextInput, RadioButton, Button, Portal, Provider, Dialog } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarPickerModal } from '../../components/CalendarPickerModal';

type EditChildScreenNavigationProp = NativeStackNavigationProp<ParentStackParamList>;
type EditChildScreenRouteProp = RouteProp<ParentStackParamList, 'EditChild'>;

export const EditChildScreen = () => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [teamCode, setTeamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(birthDate);
  const [showChangeTeam, setShowChangeTeam] = useState(false);
  const [newTeamCode, setNewTeamCode] = useState('');
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [changeTeamError, setChangeTeamError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState<string | null>(null);
  const [isValidatingTeam, setIsValidatingTeam] = useState(false);

  const navigation = useNavigation<EditChildScreenNavigationProp>();
  const route = useRoute<EditChildScreenRouteProp>();
  const { childId } = route.params;

  useEffect(() => {
    loadChildData();
  }, []);

  useEffect(() => {
    if (!showChangeTeam) return;
    if (newTeamCode.trim().length !== 6) {
      setNewTeamName(null);
      setChangeTeamError(null);
      return;
    }
    setIsValidatingTeam(true);
    setChangeTeamError(null);
    setNewTeamName(null);
    const validate = setTimeout(async () => {
      try {
        const { data: team, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('access_code', newTeamCode.trim())
          .single();
        if (error || !team) {
          setChangeTeamError('Invalid team access code.');
          setNewTeamName(null);
        } else {
          setChangeTeamError(null);
          setNewTeamName(team.name);
        }
      } catch (err) {
        setChangeTeamError('Error validating team code.');
        setNewTeamName(null);
      } finally {
        setIsValidatingTeam(false);
      }
    }, 400); // debounce
    return () => clearTimeout(validate);
  }, [newTeamCode, showChangeTeam]);

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
          )
        `)
        .eq('id', childId)
        .single();

      if (error) throw error;

      console.log('Fetched child data:', data);

      setName(data.full_name);
      setBirthDate(new Date(data.birth_date));
      if (Array.isArray(data.teams)) {
        const team = (data.teams && data.teams[0]) ? (data.teams[0] as { access_code?: string; name?: string }) : undefined;
        setTeamCode(team?.access_code || '');
        setTeamName(team?.name || '');
      } else {
        const team = data.teams as { access_code?: string; name?: string };
        setTeamCode(team?.access_code || '');
        setTeamName(team?.name || '');
      }

    } catch (error) {
      console.error('Error loading child data:', error);
      Alert.alert('Error', 'Failed to load child data');
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

  // Handler to change the child's team
  const handleConfirmChangeTeam = async () => {
    setChangeTeamError(null);
    setIsChangingTeam(true);
    try {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name, access_code')
        .eq('access_code', newTeamCode.trim())
        .single();
      if (teamError || !team) {
        setChangeTeamError('Invalid team access code.');
        setIsChangingTeam(false);
        return;
      }
      // Update the child's team_id in parent_children
      const { error: updateError } = await supabase
        .from('parent_children')
        .update({ team_id: team.id })
        .eq('id', childId);
      if (updateError) {
        setChangeTeamError('Failed to change team. Please try again.');
        setIsChangingTeam(false);
        return;
      }
      // Also update the team_id in the players table for this child
      try {
        const parentData = await AsyncStorage.getItem('parent_data');
        let parentId = null;
        if (parentData) {
          const parent = JSON.parse(parentData);
          parentId = parent.id;
        }
        if (parentId) {
          await supabase
            .from('players')
            .update({ team_id: team.id })
            .eq('name', name)
            .eq('parent_id', parentId);
        } else {
          // fallback: update by name only (less safe)
          await supabase
            .from('players')
            .update({ team_id: team.id })
            .eq('name', name);
        }
      } catch (err) {
        // Log but don't block the main flow
        console.error('Error updating team_id in players table:', err);
      }
      // Success: reload child data and clear input
      setNewTeamCode('');
      setShowChangeTeam(false);
      setNewTeamName(null);
      await loadChildData();
      Alert.alert('Success', `Child has been assigned to team: ${team.name}`);
    } catch (err) {
      setChangeTeamError('An unexpected error occurred.');
    } finally {
      setIsChangingTeam(false);
    }
  };

  // Handler to cancel team change
  const handleCancelChangeTeam = () => {
    setShowChangeTeam(false);
    setNewTeamCode('');
    setChangeTeamError(null);
    setNewTeamName(null);
  };

  return (
    <Provider>
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
              mode="flat"
            style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account-circle" color={COLORS.primary} style={{ marginRight: 30 }} />}
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
              onChangeText={setTeamCode}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account-group" color={COLORS.primary} style={{ marginRight: 30 }} />}
            maxLength={6}
              editable={false}
            />

            {teamName && (
              <Text style={styles.teamName}>
                Team: {teamName}
            </Text>
          )}

            {/* Change Team Section - moved above Medical Visa Status and styled smaller */}
            <View style={{ marginTop: 8, marginBottom: 8 }}>
              {!showChangeTeam && (
                <Button
                  mode="text"
                  onPress={() => setShowChangeTeam(true)}
                  style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minWidth: 0 }}
                  labelStyle={{ fontWeight: '600', fontSize: FONT_SIZES.sm, color: COLORS.primary }}
                  compact
                >
                  Change Team
                </Button>
              )}
              {showChangeTeam && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.inputLabel}>New Team Access Code</Text>
                  <TextInput
                    label="New Team Access Code"
                    value={newTeamCode}
                    onChangeText={setNewTeamCode}
                    mode="flat"
                    style={styles.input}
                    theme={{ colors: { primary: '#0CC1EC' }}}
                    left={<TextInput.Icon icon="account-group" color={COLORS.primary} style={{ marginRight: 30 }} />}
                    maxLength={6}
                    editable={!isChangingTeam}
                  />
                  {isValidatingTeam && <Text style={{ color: COLORS.primary, marginTop: 4 }}>Validating...</Text>}
                  {newTeamName && !changeTeamError && (
                    <Text style={{ color: COLORS.primary, marginTop: 4 }}>Team: {newTeamName}</Text>
                  )}
                  {changeTeamError && <Text style={{ color: COLORS.error, marginTop: 4 }}>{changeTeamError}</Text>}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <Button
                      mode="outlined"
                      onPress={handleConfirmChangeTeam}
                      loading={isChangingTeam}
                      disabled={isChangingTeam || !newTeamName || !!changeTeamError}
                      style={[
                        { flex: 1, borderRadius: 100, borderWidth: 2 },
                        (!isChangingTeam && newTeamName && !changeTeamError)
                          ? { borderColor: '#0CC1EC', backgroundColor: 'white' }
                          : { borderColor: '#E0E0E0', backgroundColor: '#E0E0E0' }
                      ]}
                      contentStyle={{ height: 40 }}
                      labelStyle={[
                        { fontWeight: '700', fontSize: FONT_SIZES.sm },
                        (!isChangingTeam && newTeamName && !changeTeamError)
                          ? { color: '#0CC1EC' }
                          : { color: '#A0A0A0' }
                      ]}
                      compact
                    >
                      Confirm
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={handleCancelChangeTeam}
                      disabled={isChangingTeam}
                      style={{ flex: 1, borderRadius: 100, borderWidth: 2, borderColor: '#E0E0E0', backgroundColor: 'white' }}
                      contentStyle={{ height: 40 }}
                      labelStyle={{ fontWeight: '700', fontSize: FONT_SIZES.sm, color: '#222' }}
                      compact
                    >
                      Cancel
                    </Button>
                  </View>
                </View>
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

        {/* Date Picker Modal using CalendarPickerModal */}
        <CalendarPickerModal
        visible={showDatePickerModal}
          onCancel={cancelDatePicker}
          onConfirm={confirmDatePicker}
              value={tempDate}
          onValueChange={setTempDate}
        />
      </KeyboardAvoidingView>
    </Provider>
  );
};

// Custom Date Picker Component using react-native-paper Calendar
interface DatePickerComponentProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

const DatePickerComponent = ({ date, onDateChange }: DatePickerComponentProps) => {
  // Month names for the header
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const [currentDate, setCurrentDate] = useState(date);
  const [currentMonth, setCurrentMonth] = useState(date.getMonth());
  const [currentYear, setCurrentYear] = useState(date.getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Update the parent component when date changes
  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
    onDateChange(newDate);
  };
  
  // Navigate to previous month
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  
  // Navigate to next month
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };
  
  // Generate days for the current month
  const generateDays = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    const days = [];
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Add weekday headers
    days.push(
      <View key="weekdays" style={styles.weekDaysRow}>
        {weekDays.map((day, index) => (
          <Text key={`weekday-${index}`} style={styles.weekDayText}>{day}</Text>
        ))}
            </View>
    );
    
    // Add empty cells for days before the first day of the month
    const firstWeek = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      firstWeek.push(
        <View key={`empty-${i}`} style={styles.calendarDay} />
      );
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(currentYear, currentMonth, i);
      const isSelected = currentDate && 
        dayDate.getDate() === currentDate.getDate() && 
        dayDate.getMonth() === currentDate.getMonth() && 
        dayDate.getFullYear() === currentDate.getFullYear();
      
      firstWeek.push(
        <Pressable 
          key={`day-${i}`} 
          style={[
            styles.calendarDay,
            isSelected && styles.selectedDay
          ]}
          onPress={() => handleDateChange(dayDate)}
        >
          <Text style={[
            styles.calendarDayText,
            isSelected && styles.selectedDayText
          ]}>
            {i}
          </Text>
        </Pressable>
      );
      
      // Start a new row after Saturday (index 6)
      if ((firstDayOfMonth + i - 1) % 7 === 6 || i === daysInMonth) {
        days.push(
          <View key={`week-${Math.floor((firstDayOfMonth + i - 1) / 7)}`} style={styles.calendarRow}>
            {firstWeek}
          </View>
        );
        firstWeek.length = 0;
      }
    }
    
    return days;
  };
  
  return (
    <View style={styles.datePickerContainer}>
      {/* Month/Year Header */}
      <View style={styles.calendarHeader}>
        <Pressable onPress={prevMonth}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#666" />
        </Pressable>
        
        <Pressable 
          style={styles.monthYearSelector}
          onPress={() => setShowYearPicker(!showYearPicker)}
        >
          <Text style={styles.monthYearText}>
            {monthNames[currentMonth]} {currentYear}
          </Text>
          <MaterialCommunityIcons name="menu-down" size={24} color="#666" />
        </Pressable>
        
        <Pressable onPress={nextMonth}>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
        </Pressable>
        </View>
      
      {/* Year Picker if shown */}
      {showYearPicker && (
        <ScrollView style={styles.yearPickerContainer}>
          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 80 + i).map((year) => (
            <Pressable
              key={`year-${year}`}
              style={[
                styles.yearOption,
                currentYear === year && styles.selectedYear
              ]}
              onPress={() => {
                setCurrentYear(year);
                setShowYearPicker(false);
              }}
            >
              <Text style={[
                styles.yearText,
                currentYear === year && styles.selectedYearText
              ]}>
                {year}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      
      {/* Calendar Grid */}
      {!showYearPicker && (
        <View style={styles.calendarGrid}>
          {generateDays()}
        </View>
      )}
    </View>
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
  datePickerDialog: {
    borderRadius: 16,
    backgroundColor: COLORS.white,
    maxHeight: '80%',
  },
  calendarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerContainer: {
    width: '100%',
    paddingVertical: SPACING.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.text,
  },
  calendarGrid: {
    width: '100%',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.sm,
  },
  weekDayText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.grey[600],
    width: 36,
    textAlign: 'center',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.xs,
  },
  calendarDay: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  calendarDayText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  selectedDay: {
    backgroundColor: '#7366bd', // Purple color to match your UI
  },
  selectedDayText: {
    color: COLORS.white,
    fontWeight: '500',
  },
  yearPickerContainer: {
    maxHeight: 200,
    marginVertical: SPACING.sm,
  },
  yearOption: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  yearText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  selectedYear: {
    backgroundColor: '#f0f0f0',
  },
  selectedYearText: {
    fontWeight: '600',
    color: '#7366bd', // Purple color to match your UI
  },
}); 