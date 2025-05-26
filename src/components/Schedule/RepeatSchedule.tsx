import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Checkbox, Button, TextInput, Menu, Divider } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, addMonths } from 'date-fns';

export type RepeatType = 'daily' | 'weekly' | 'monthly';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.

interface RepeatScheduleProps {
  isRepeating: boolean;
  repeatType: RepeatType;
  repeatDays: DayOfWeek[];
  repeatUntil: Date;
  onIsRepeatingChange: (value: boolean) => void;
  onRepeatTypeChange: (value: RepeatType) => void;
  onRepeatDaysChange: (value: DayOfWeek[]) => void;
  onRepeatUntilChange: (value: Date) => void;
}

export const RepeatSchedule = ({
  isRepeating,
  repeatType,
  repeatDays,
  repeatUntil,
  onIsRepeatingChange,
  onRepeatTypeChange,
  onRepeatDaysChange,
  onRepeatUntilChange,
}: RepeatScheduleProps) => {
  const [repeatTypeMenuVisible, setRepeatTypeMenuVisible] = useState(false);
  const [durationMenuVisible, setDurationMenuVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const repeatTypeOptions: { label: string; value: RepeatType }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  const durationOptions = [
    { label: '1 Month', value: 1 },
    { label: '3 Months', value: 3 },
    { label: '6 Months', value: 6 },
    { label: '1 Year', value: 12 },
    { label: 'Custom Date', value: 'custom' },
  ];

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const toggleDay = (day: DayOfWeek) => {
    if (repeatDays.includes(day)) {
      onRepeatDaysChange(repeatDays.filter((d) => d !== day));
    } else {
      onRepeatDaysChange([...repeatDays, day]);
    }
  };

  const handleDurationSelect = (months: number | 'custom') => {
    if (months === 'custom') {
      setDatePickerVisible(true);
    } else {
      onRepeatUntilChange(addMonths(new Date(), months));
    }
    setDurationMenuVisible(false);
  };

  const handleDateConfirm = (date: Date) => {
    onRepeatUntilChange(date);
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Repeat Schedule</Text>
      
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={() => onIsRepeatingChange(!isRepeating)}
      >
        <View style={styles.checkboxWrapper}>
          <Checkbox
            status={isRepeating ? 'checked' : 'unchecked'}
            onPress={() => onIsRepeatingChange(!isRepeating)}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.checkboxLabel}>Repeat this event</Text>
      </TouchableOpacity>
      
      {isRepeating && (
        <View style={styles.repeatOptionsContainer}>
          <View style={styles.optionsContainer}>
            <Text style={styles.optionLabel}>Repeat Type</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setRepeatTypeMenuVisible(true)}
            >
              <Text style={styles.dropdownButtonText}>
                {repeatTypeOptions.find(opt => opt.value === repeatType)?.label || 'Select'}
              </Text>
              <CustomIcon name="chevron-down" size={18} color={COLORS.text} />
            </TouchableOpacity>
            
            <Menu
              visible={repeatTypeMenuVisible}
              onDismiss={() => setRepeatTypeMenuVisible(false)}
              anchor={<View />}
              style={{ marginTop: 175 }}
            >
              {repeatTypeOptions.map((option) => (
                <Menu.Item
                  key={option.value}
                  onPress={() => {
                    onRepeatTypeChange(option.value);
                    setRepeatTypeMenuVisible(false);
                  }}
                  title={option.label}
                />
              ))}
            </Menu>
          </View>

          {repeatType === 'weekly' && (
            <View style={styles.daysContainer}>
              <Text style={styles.optionLabel}>Repeat On</Text>
              <View style={styles.daysButtonsContainer}>
                {dayLabels.map((label, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      repeatDays.includes(index as DayOfWeek) && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(index as DayOfWeek)}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        repeatDays.includes(index as DayOfWeek) && styles.dayLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.durationRow}>
            <View style={styles.durationColumn}>
              <Text style={styles.optionLabel}>Duration</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setDurationMenuVisible(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {new Date() < repeatUntil
                    ? `${format(repeatUntil, 'MMM yyyy')}`
                    : '1 Month'}
                </Text>
                <CustomIcon name="chevron-down" size={18} color={COLORS.text} />
              </TouchableOpacity>
              
              <Menu
                visible={durationMenuVisible}
                onDismiss={() => setDurationMenuVisible(false)}
                anchor={<View />}
                style={{ marginTop: 235 }}
              >
                {durationOptions.map((option) => (
                  <Menu.Item
                    key={option.value.toString()}
                    onPress={() => handleDurationSelect(option.value as number | 'custom')}
                    title={option.label}
                  />
                ))}
              </Menu>
            </View>
            
            <View style={styles.durationColumn}>
              <Text style={styles.optionLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setDatePickerVisible(true)}
              >
                <Text style={styles.dropdownButtonText}>{format(repeatUntil, 'dd/MM/yyyy')}</Text>
                <CustomIcon name="calendar" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={repeatUntil}
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
        minimumDate={new Date()}
      />
    </View>
  );
};

const CustomIcon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  // Simple implementation to avoid dependencies
  const iconMap: Record<string, string> = {
    'chevron-down': '▼',
    'calendar': '📅',
  };
  
  return (
    <Text style={{ fontSize: size - 4, color }}>{iconMap[name] || '▼'}</Text>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    padding: 8,
    borderRadius: 4,
    backgroundColor: COLORS.grey[100],
  },
  checkboxWrapper: {
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  repeatOptionsContainer: {
    backgroundColor: COLORS.grey[100],
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  optionsContainer: {
    marginBottom: SPACING.sm,
  },
  optionLabel: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: 6,
    fontWeight: '500',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 4,
    padding: 10,
    backgroundColor: COLORS.white,
    height: 44,
  },
  dropdownButtonText: {
    color: COLORS.text,
    fontSize: 14,
  },
  daysContainer: {
    marginBottom: SPACING.sm,
  },
  daysButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    borderWidth: 1,
    borderColor: COLORS.grey[300],
  },
  dayButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  dayLabelSelected: {
    color: COLORS.white,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationColumn: {
    width: '48%',
  },
}); 