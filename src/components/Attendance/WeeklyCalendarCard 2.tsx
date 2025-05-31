import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';

interface WeeklyCalendarCardProps {
  currentDate: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export const WeeklyCalendarCard: React.FC<WeeklyCalendarCardProps> = ({
  currentDate,
  selectedDate,
  onDateSelect,
  onPrevWeek,
  onNextWeek
}) => {
  // Generate week days starting from Monday
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  
  // Generate array of dates for the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayName = format(date, 'EEE');
    const dayNumber = format(date, 'd');
    const isSelected = date.toDateString() === selectedDate.toDateString();
    
    return { date, dayName, dayNumber, isSelected };
  });

  return (
    <Card style={styles.card}>
      <View style={styles.weekHeader}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={onPrevWeek}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <Text style={styles.monthText}>
          {format(currentDate, 'MMMM yyyy')}
        </Text>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={onNextWeek}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.daysContainer}>
        {weekDays.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayButton,
              day.isSelected && styles.selectedDayButton
            ]}
            onPress={() => onDateSelect(day.date)}
          >
            <Text style={[styles.dayName, day.isSelected && styles.selectedDayText]}>
              {day.dayName}
            </Text>
            <Text style={[styles.dayNumber, day.isSelected && styles.selectedDayText]}>
              {day.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 70,
    borderRadius: 20,
    padding: SPACING.xs,
  },
  selectedDayButton: {
    backgroundColor: COLORS.primary,
  },
  dayName: {
    fontSize: 12,
    color: COLORS.grey[600],
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedDayText: {
    color: COLORS.white,
  },
}); 