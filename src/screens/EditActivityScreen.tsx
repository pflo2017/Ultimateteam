import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Text, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, addMonths, parseISO } from 'date-fns';
import { ActivityType, getActivityById, updateActivity } from '../services/activitiesService';
import { RepeatSchedule, RepeatType, DayOfWeek } from '../components/Schedule/RepeatSchedule';
import type { RootStackParamList } from '../types/navigation';

type EditActivityScreenRouteProp = RouteProp<RootStackParamList, 'EditActivity'>;

// Team interface
interface Team {
  id: string;
  name: string;
}

// Define MaterialCommunityIcons name type to fix type error
type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const EditActivityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<EditActivityScreenRouteProp>();
  const { activityId } = route.params;
  
  const [activityType, setActivityType] = useState<ActivityType>('training');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [duration, setDuration] = useState('1h');
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  
  // Repeat schedule state
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState<RepeatType>('weekly');
  const [repeatDays, setRepeatDays] = useState<DayOfWeek[]>([]);
  const [repeatUntil, setRepeatUntil] = useState<Date>(addMonths(new Date(), 1));

  // Initial data loading
  useEffect(() => {
    loadActivity();
  }, [activityId]);
  
  const loadActivity = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!activityId) {
        throw new Error('No activity ID provided');
      }
      
      const { data, error } = await getActivityById(activityId);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        // Populate form fields with activity data
        setTitle(data.title);
        setLocation(data.location);
        setStartDate(parseISO(data.start_time));
        setDuration(data.duration);
        setActivityType(data.type);
        setAdditionalInfo(data.additional_info || '');
        setPrivateNotes(data.private_notes || '');
        setTeamId(data.team_id || null);
        
        // Set repeat data if available
        if (data.is_repeating) {
          setIsRepeating(true);
          if (data.repeat_type) setRepeatType(data.repeat_type);
          if (data.repeat_days) setRepeatDays(data.repeat_days as DayOfWeek[]);
          if (data.repeat_until) setRepeatUntil(parseISO(data.repeat_until));
        }
      } else {
        setError('Activity not found');
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      setError(`Failed to load activity details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return false;
    }
    
    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return false;
    }
    
    if (isRepeating && repeatType === 'weekly' && repeatDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for weekly repeat');
      return false;
    }
    
    return true;
  };

  // Calculate end time
  const calculateEndTime = (startTime: Date, durationStr: string): Date => {
    const endTime = new Date(startTime);
    
    // Parse duration string (e.g., "1h", "2h30m", "45m")
    const hourMatch = durationStr.match(/(\d+)h/);
    const minuteMatch = durationStr.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    
    // If no valid duration format, default to 1 hour
    const totalMinutes = (hours * 60 + minutes) || 60;
    
    endTime.setMinutes(endTime.getMinutes() + totalMinutes);
    return endTime;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    
    try {
      setIsLoading(true);
      
      // Calculate end time from start time and duration
      const startTimeDate = new Date(startDate);
      const endTimeDate = calculateEndTime(startTimeDate, duration);
      
      const activityData = {
        title,
        location,
        start_time: startDate.toISOString(),
        end_time: endTimeDate.toISOString(),
        duration,
        type: activityType,
        team_id: teamId || undefined,
        additional_info: additionalInfo || undefined,
        private_notes: privateNotes || undefined,
        // Repeat schedule fields
        is_repeating: isRepeating,
        repeat_type: isRepeating ? repeatType : undefined,
        repeat_days: isRepeating ? repeatDays : undefined,
        repeat_until: isRepeating ? repeatUntil.toISOString() : undefined
      };
      
      const { data, error } = await updateActivity(activityId, activityData);
      
      if (error) {
        throw error;
      }
      
      Alert.alert('Success', 'Activity updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating activity:', error);
      Alert.alert('Error', `Failed to update activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showStartDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  const hideStartDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const handleStartDateConfirm = (date: Date) => {
    setStartDate(date);
    hideStartDatePicker();
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={handleGoBack}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Activity</Text>
        <Button 
          mode="contained" 
          onPress={handleUpdate} 
          style={styles.updateButton}
          labelStyle={styles.updateButtonLabel}
          loading={isLoading}
          disabled={isLoading}
        >
          Update
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          placeholder="Enter activity title"
          dense
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          style={styles.input}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          placeholder="Enter location"
          dense
        />

        <Text style={styles.label}>Time</Text>
        <View style={styles.timeContainer}>
          <View style={styles.startTimeContainer}>
            <Text style={styles.timeLabel}>Start</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton} 
              onPress={showStartDatePicker}
            >
              <MaterialCommunityIcons 
                name="calendar-clock" 
                size={18} 
                color={getActivityColor(activityType)} 
                style={styles.inputIcon}
              />
              <Text style={styles.dateTimeText}>
                {format(startDate, 'EEE, MMM d, HH:mm')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.durationContainer}>
            <Text style={styles.timeLabel}>Duration</Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              style={styles.durationInput}
              mode="outlined"
              outlineColor={COLORS.grey[200]}
              activeOutlineColor={getActivityColor(activityType)}
              outlineStyle={styles.inputOutline}
              placeholder="1h"
              dense
              left={<TextInput.Icon icon="clock-outline" color={getActivityColor(activityType)} />}
            />
          </View>
        </View>

        {/* Repeat Schedule Component */}
        <View style={styles.repeatContainer}>
          <View style={styles.repeatHeader}>
            <Text style={styles.label}>Repeat Schedule</Text>
            <TouchableOpacity 
              style={styles.repeatToggle}
              onPress={() => setIsRepeating(!isRepeating)}
            >
              <MaterialCommunityIcons 
                name={isRepeating ? "checkbox-marked" : "checkbox-blank-outline"} 
                size={24} 
                color={isRepeating ? getActivityColor(activityType) : COLORS.grey[500]} 
              />
              <Text style={[
                styles.repeatToggleText,
                isRepeating && { color: getActivityColor(activityType) }
              ]}>
                Repeat this event
              </Text>
            </TouchableOpacity>
          </View>

          {isRepeating && (
            <View style={styles.repeatOptions}>
              <RepeatSchedule
                isRepeating={isRepeating}
                repeatType={repeatType}
                repeatDays={repeatDays}
                repeatUntil={repeatUntil}
                onIsRepeatingChange={setIsRepeating}
                onRepeatTypeChange={setRepeatType}
                onRepeatDaysChange={setRepeatDays}
                onRepeatUntilChange={setRepeatUntil}
              />
            </View>
          )}
        </View>

        <Text style={styles.label}>Additional information</Text>
        <TextInput
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          style={styles.textAreaInput}
          mode="outlined"
          outlineColor={COLORS.grey[200]}
          activeOutlineColor={getActivityColor(activityType)}
          outlineStyle={styles.inputOutline}
          multiline
          numberOfLines={3}
          placeholder="Don't forget to bring..."
        />

        <View style={styles.privateNotesContainer}>
          <Text style={styles.privateNotesTitle}>Private notes for coaches</Text>
          <Text style={styles.privateNotesSubtitle}>Visible for all coaches and admins in the team</Text>
          <TextInput
            value={privateNotes}
            onChangeText={setPrivateNotes}
            style={styles.privateNotesInput}
            mode="outlined"
            outlineColor={COLORS.grey[200]}
            activeOutlineColor={getActivityColor(activityType)}
            outlineStyle={styles.inputOutline}
            multiline
            numberOfLines={3}
            placeholder="Add notes..."
          />
        </View>
        
        <View style={styles.spacer} />
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleStartDateConfirm}
        onCancel={hideStartDatePicker}
        date={startDate}
        display="inline"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  updateButton: {
    borderRadius: 20,
  },
  updateButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: COLORS.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.grey[100],
    marginBottom: 20,
    height: 48,
  },
  textAreaInput: {
    backgroundColor: COLORS.grey[100],
    marginBottom: 20,
    minHeight: 80,
  },
  inputOutline: {
    borderRadius: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  startTimeContainer: {
    flex: 2,
    marginRight: 12,
  },
  durationContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: COLORS.grey[700],
  },
  dateTimeButton: {
    backgroundColor: COLORS.grey[100],
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    color: COLORS.text,
  },
  durationInput: {
    backgroundColor: COLORS.grey[100],
    height: 48,
  },
  repeatContainer: {
    marginBottom: 24,
    backgroundColor: COLORS.grey[100],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  repeatHeader: {
    marginBottom: 8,
  },
  repeatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  repeatToggleText: {
    fontSize: 16,
    marginLeft: 8,
    color: COLORS.text,
    fontWeight: '500',
  },
  repeatOptions: {
    marginTop: 16,
  },
  privateNotesContainer: {
    backgroundColor: '#FFF8E1', // Light yellow background
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  privateNotesTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  privateNotesSubtitle: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginBottom: 8,
  },
  privateNotesInput: {
    backgroundColor: COLORS.white,
    minHeight: 80,
  },
  spacer: {
    height: 32,
  },
}); 