import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Checkbox, Divider, IconButton, HelperText, Menu } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

type ActivityType = 'practice' | 'match' | 'event';

type ActivityFormProps = {
  type: ActivityType;
  onSubmit: (data: ActivityFormData) => void;
  onCancel: () => void;
  initialData?: ActivityFormData;
};

export type ActivityFormData = {
  id?: string;
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  teams: string[];
  isPublic: boolean;
  type: ActivityType;
};

export const ActivityForm = ({ type, onSubmit, onCancel, initialData }: ActivityFormProps) => {
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    location: '',
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 60 * 60 * 1000), // Default 1 hour later
    teams: [],
    isPublic: true,
    type: type,
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [teamsMenuVisible, setTeamsMenuVisible] = useState(false);

  // Sample teams for demonstration
  const availableTeams = [
    { id: '1', name: 'Team A' },
    { id: '2', name: 'Team B' },
    { id: '3', name: 'Team C' },
    { id: '4', name: 'Team D' },
  ];

  const handleInputChange = (field: keyof ActivityFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      const newStartDate = new Date(selectedDate);
      // Preserve the time from the existing start date
      newStartDate.setHours(formData.startDate.getHours());
      newStartDate.setMinutes(formData.startDate.getMinutes());
      
      handleInputChange('startDate', newStartDate);
      
      // If end date is before start date, update end date
      if (formData.endDate < newStartDate) {
        handleInputChange('endDate', new Date(newStartDate.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      const newStartDate = new Date(formData.startDate);
      newStartDate.setHours(selectedTime.getHours());
      newStartDate.setMinutes(selectedTime.getMinutes());
      
      handleInputChange('startDate', newStartDate);
      
      // If end time is before start time on the same day, update end time
      if (
        formData.endDate.getDate() === newStartDate.getDate() &&
        formData.endDate.getMonth() === newStartDate.getMonth() &&
        formData.endDate.getFullYear() === newStartDate.getFullYear() &&
        formData.endDate < newStartDate
      ) {
        handleInputChange('endDate', new Date(newStartDate.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const newEndDate = new Date(selectedDate);
      // Preserve the time from the existing end date
      newEndDate.setHours(formData.endDate.getHours());
      newEndDate.setMinutes(formData.endDate.getMinutes());
      
      // If end date is before start date, don't allow it
      if (newEndDate < formData.startDate) {
        newEndDate.setDate(formData.startDate.getDate());
        newEndDate.setMonth(formData.startDate.getMonth());
        newEndDate.setFullYear(formData.startDate.getFullYear());
      }
      
      handleInputChange('endDate', newEndDate);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      const newEndDate = new Date(formData.endDate);
      newEndDate.setHours(selectedTime.getHours());
      newEndDate.setMinutes(selectedTime.getMinutes());
      
      // If end time is before start time on the same day, don't allow it
      if (
        formData.startDate.getDate() === newEndDate.getDate() &&
        formData.startDate.getMonth() === newEndDate.getMonth() &&
        formData.startDate.getFullYear() === newEndDate.getFullYear() &&
        newEndDate < formData.startDate
      ) {
        newEndDate.setTime(formData.startDate.getTime() + 30 * 60 * 1000); // 30 min later
      }
      
      handleInputChange('endDate', newEndDate);
    }
  };

  const toggleTeamSelection = (teamId: string) => {
    const updatedTeams = formData.teams.includes(teamId)
      ? formData.teams.filter(id => id !== teamId)
      : [...formData.teams, teamId];
    
    handleInputChange('teams', updatedTeams);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (formData.teams.length === 0) {
      newErrors.teams = 'At least one team must be selected';
    }
    
    if (formData.endDate <= formData.startDate) {
      newErrors.endDate = 'End time must be after start time';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const getActivityTypeLabel = () => {
    switch (type) {
      case 'practice':
        return 'Practice';
      case 'match':
        return 'Match';
      case 'event':
        return 'Event';
      default:
        return 'Activity';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>New {getActivityTypeLabel()}</Text>
        <IconButton
          icon="close"
          size={24}
          onPress={onCancel}
        />
      </View>

      <View style={styles.formContainer}>
        <TextInput
          label="Title"
          value={formData.title}
          onChangeText={(text) => handleInputChange('title', text)}
          style={styles.input}
          mode="outlined"
          error={!!errors.title}
        />
        {errors.title && <HelperText type="error">{errors.title}</HelperText>}

        <TextInput
          label="Description"
          value={formData.description}
          onChangeText={(text) => handleInputChange('description', text)}
          style={styles.input}
          mode="outlined"
          multiline
          numberOfLines={3}
        />

        <TextInput
          label="Location"
          value={formData.location}
          onChangeText={(text) => handleInputChange('location', text)}
          style={styles.input}
          mode="outlined"
          error={!!errors.location}
        />
        {errors.location && <HelperText type="error">{errors.location}</HelperText>}

        <Text style={styles.sectionTitle}>Date and Time</Text>
        
        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateTimeLabel}>Start</Text>
          <View style={styles.dateTimeButtons}>
            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => setShowStartDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>
                {format(formData.startDate, 'MMM d, yyyy')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.timeButton} 
              onPress={() => setShowStartTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>
                {format(formData.startDate, 'h:mm a')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateTimeLabel}>End</Text>
          <View style={styles.dateTimeButtons}>
            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => setShowEndDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>
                {format(formData.endDate, 'MMM d, yyyy')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.timeButton} 
              onPress={() => setShowEndTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>
                {format(formData.endDate, 'h:mm a')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {errors.endDate && <HelperText type="error">{errors.endDate}</HelperText>}

        <Text style={styles.sectionTitle}>Teams</Text>
        
        <View>
          <Menu
            visible={teamsMenuVisible}
            onDismiss={() => setTeamsMenuVisible(false)}
            anchor={
              <Button 
                mode="outlined" 
                onPress={() => setTeamsMenuVisible(true)}
                style={styles.teamsButton}
                icon="chevron-down"
                contentStyle={styles.teamsButtonContent}
              >
                {formData.teams.length > 0
                  ? `${formData.teams.length} team${formData.teams.length > 1 ? 's' : ''} selected`
                  : 'Select teams'}
              </Button>
            }
          >
            {availableTeams.map(team => (
              <Menu.Item
                key={team.id}
                title={team.name}
                onPress={() => toggleTeamSelection(team.id)}
                leadingIcon={formData.teams.includes(team.id) ? "check" : ""}
              />
            ))}
          </Menu>
          {errors.teams && <HelperText type="error">{errors.teams}</HelperText>}
        </View>

        <View style={styles.visibilitySection}>
          <Text style={styles.visibilityLabel}>Public Activity</Text>
          <Checkbox
            status={formData.isPublic ? 'checked' : 'unchecked'}
            onPress={() => handleInputChange('isPublic', !formData.isPublic)}
          />
        </View>
        <Text style={styles.helperText}>
          Public activities are visible to all parents
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
          >
            Create {getActivityTypeLabel()}
          </Button>
          
          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </View>

      {showStartDatePicker && (
        <DateTimePicker
          value={formData.startDate}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={formData.startDate}
          mode="time"
          display="default"
          onChange={handleStartTimeChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={formData.endDate}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={formData.endDate}
          mode="time"
          display="default"
          onChange={handleEndTimeChange}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  formContainer: {
    padding: SPACING.md,
  },
  input: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  dateTimeLabel: {
    width: 50,
    fontSize: 16,
    color: COLORS.text,
  },
  dateTimeButtons: {
    flex: 1,
    flexDirection: 'row',
  },
  dateButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.grey[100],
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  timeButton: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.grey[100],
    borderRadius: 4,
  },
  dateButtonText: {
    marginLeft: 8,
    color: COLORS.text,
  },
  teamsButton: {
    marginBottom: SPACING.sm,
    borderColor: COLORS.grey[300],
  },
  teamsButtonContent: {
    justifyContent: 'space-between',
  },
  visibilitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  visibilityLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  helperText: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: SPACING.md,
  },
  buttonContainer: {
    marginTop: SPACING.lg,
  },
  submitButton: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    borderColor: COLORS.grey[300],
  },
}); 