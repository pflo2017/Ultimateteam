import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, SafeAreaView, Modal, TextInput } from 'react-native';
import { Text, Button, Card, FAB } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getActivities, getActivitiesByDateRange, ActivityType as ServiceActivityType, Activity } from '../../services/activitiesService';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, setMonth, 
  addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, addDays, getDate, isSameWeek } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useCallback } from 'react';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScheduleCalendarProps = {
  userRole: 'admin' | 'coach' | 'parent';
  onCreateActivity: () => void;
};

type ViewMode = 'monthly' | 'weekly';

export const ScheduleCalendar = ({ userRole, onCreateActivity }: ScheduleCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  
  // Filter states
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [selectedType, setSelectedType] = useState<ServiceActivityType | 'all'>('all');
  
  // Use focus effect to reload activities when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Schedule screen focused - reloading activities');
      loadActivities();
      return () => {
        // Cleanup if needed
      };
    }, [viewMode === 'monthly' ? currentMonth : currentWeek])
  );
  
  // Initial load
  useEffect(() => {
    loadActivities();
  }, [viewMode === 'monthly' ? currentMonth : currentWeek]);
  
  const loadActivities = async () => {
    try {
      setIsLoading(true);
      
      let start, end;
      
      if (viewMode === 'monthly') {
        start = startOfMonth(currentMonth).toISOString();
        end = endOfMonth(currentMonth).toISOString();
      } else {
        start = startOfWeek(currentWeek, { weekStartsOn: 1 }).toISOString(); // Monday
        end = endOfWeek(currentWeek, { weekStartsOn: 1 }).toISOString(); // Sunday
      }
      
      const { data, error } = await getActivitiesByDateRange(start, end);
      
      if (error) throw error;
      
      if (data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format calendar marked dates
  const getMarkedDates = () => {
    const markedDates: any = {};
    
    // Mark selected date
    markedDates[selectedDate] = { selected: true, selectedColor: COLORS.primary };
    
    // Group activities by date and find primary color
    const dateActivityMap: {[key: string]: ServiceActivityType[]} = {};
    
    // Filter activities by type if needed
    const filteredActivities = selectedType === 'all' 
      ? activities 
      : activities.filter(activity => activity.type === selectedType);
    
    filteredActivities.forEach(activity => {
      const activityDate = activity.start_time.split('T')[0];
      
      if (!dateActivityMap[activityDate]) {
        dateActivityMap[activityDate] = [];
      }
      
      dateActivityMap[activityDate].push(activity.type);
    });
    
    // Mark dates with activities using appropriate colors
    Object.entries(dateActivityMap).forEach(([date, types]) => {
      // Determine the primary color for this date
      let dotColor = COLORS.primary; // Default to blue (training)
      
      // Prioritize certain activity types for the marker color
      if (types.includes('tournament')) {
        dotColor = '#8E44AD'; // Purple
      } else if (types.includes('game')) {
        dotColor = '#E67E22'; // Orange
      } else if (types.includes('other')) {
        dotColor = '#2ECC71'; // Green
      }
      
      if (date === selectedDate) {
        // If it's the selected date, merge with selected properties
        markedDates[date] = {
          ...markedDates[date],
          marked: true,
          dotColor
        };
      } else {
        // If it's not already marked
        markedDates[date] = {
          marked: true,
          dotColor
        };
      }
    });
    
    return markedDates;
  };
  
  // Filter activities for selected date
  const getActivitiesForSelectedDate = () => {
    return activities
      .filter(activity => {
        const activityDate = activity.start_time.split('T')[0];
        const matchesDate = viewMode === 'monthly' 
          ? activityDate === selectedDate
          : true; // In weekly view, show all activities for the week
        const matchesType = selectedType === 'all' || activity.type === selectedType;
        return matchesDate && matchesType;
      });
  };
  
  const handleMonthChange = (month: DateData) => {
    const newMonth = new Date(month.timestamp);
    setCurrentMonth(newMonth);
  };
  
  const getActivityIcon = (type: ServiceActivityType) => {
    switch (type) {
      case 'training':
        return 'whistle';
      case 'game':
        return 'trophy-outline';
      case 'tournament':
        return 'tournament';
      default:
        return 'calendar-text';
    }
  };
  
  const getActivityTypeLabel = (type: ServiceActivityType | 'all') => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'game':
        return 'Game';
      case 'tournament':
        return 'Tournament';
      case 'other':
        return 'Other';
      case 'all':
        return 'All Types';
      default:
        return 'Event';
    }
  };
  
  const getActivityColor = (type: ServiceActivityType) => {
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
  
  const EventCard = ({ activity }: { activity: Activity }) => {
    const startTime = parseISO(activity.start_time);
    const cardNavigation = useNavigation<NavigationProp>();
    const activityColor = getActivityColor(activity.type);
    
    const handlePress = () => {
      if (!activity.id) {
        console.error('Cannot navigate to activity details: Missing activity ID');
        return;
      }
      
      try {
        console.log('Navigating to activity details with ID:', activity.id);
        cardNavigation.navigate('ActivityDetails', { activityId: activity.id });
      } catch (error) {
        console.error('Error navigating to activity details:', error);
      }
    };
    
    return (
      <Card 
        style={[styles.eventCard, { borderLeftWidth: 4, borderLeftColor: activityColor }]} 
        onPress={handlePress}
      >
        <Card.Content>
          <View style={styles.eventHeader}>
            <View style={styles.eventType}>
              <MaterialCommunityIcons 
                name={getActivityIcon(activity.type)} 
                size={18} 
                color={activityColor} 
              />
              <Text style={[styles.eventTypeText, { color: activityColor }]}>
                {getActivityTypeLabel(activity.type)}
              </Text>
              {activity.is_repeating && (
                <MaterialCommunityIcons name="repeat" size={14} color={activityColor} style={styles.repeatIcon} />
              )}
            </View>
            <Text style={styles.eventTime}>
              {format(startTime, 'HH:mm')}
            </Text>
          </View>
          
          {/* Title row with score for games */}
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventTitle}>{activity.title}</Text>
          </View>
          {activity.teams?.name && (
            <Text style={styles.eventTeam}>{activity.teams.name}</Text>
          )}
          
          <Text style={styles.eventDate}>
            {format(startTime, 'EEE, d MMM')}
            {activity.duration ? ` • ${activity.duration}` : ''}
          </Text>
        </Card.Content>
      </Card>
    );
  };
  
  // Generate months for the full year
  const generateMonthOptions = () => {
    const months = [];
    const currentYear = currentMonth.getFullYear();
    
    // Generate all 12 months for the current year
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthDate = new Date(currentYear, monthIndex, 1);
      months.push({
        date: monthDate,
        label: format(monthDate, 'MMMM yyyy')
      });
    }
    
    return months;
  };
  
  // Week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'prev' 
      ? subWeeks(currentWeek, 1)
      : addWeeks(currentWeek, 1);
    
    setCurrentWeek(newWeek);
  };
  
  // Format the week range for display (e.g., "May 12 - 19, 2025")
  const formatWeekRange = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
    
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
  };
  
  const renderWeekView = () => {
    return (
      <View style={styles.weekViewContainer}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekRangeText}>{formatWeekRange()}</Text>
          
          <View style={styles.weekNavigation}>
            <TouchableOpacity 
              style={styles.weekNavButton}
              onPress={() => navigateWeek('prev')}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.weekNavButton}
              onPress={() => navigateWeek('next')}
            >
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Make the entire page scrollable */}
      <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Filter Section - matching Payment screen style */}
          <View style={styles.filtersContainer}>
            <View style={styles.filtersRow}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowTypeFilter(true)}
              >
                <MaterialCommunityIcons name="filter-variant" size={20} color={COLORS.primary} style={styles.filterIcon} />
                <Text style={styles.filterButtonText} numberOfLines={1}>
                  {getActivityTypeLabel(selectedType)}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowMonthFilter(true)}
              >
                <MaterialCommunityIcons name="calendar-month" size={20} color={COLORS.primary} style={styles.filterIcon} />
                <Text style={styles.filterButtonText} numberOfLines={1}>
                  {format(viewMode === 'monthly' ? currentMonth : currentWeek, 'MMMM yyyy')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.grey[400]} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* View Mode Toggle */}
          <View style={styles.viewToggleChipsRow}>
            <TouchableOpacity
              style={[styles.toggleChipSmall, viewMode === 'monthly' && styles.toggleChipSmallActive]}
              onPress={() => setViewMode('monthly')}
            >
              <MaterialCommunityIcons name="calendar-month" size={16} color={viewMode === 'monthly' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.toggleChipSmallText, viewMode === 'monthly' && styles.toggleChipSmallTextActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleChipSmall, viewMode === 'weekly' && styles.toggleChipSmallActive]}
              onPress={() => setViewMode('weekly')}
            >
              <MaterialCommunityIcons name="calendar-week" size={16} color={viewMode === 'weekly' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.toggleChipSmallText, viewMode === 'weekly' && styles.toggleChipSmallTextActive]}>Weekly</Text>
            </TouchableOpacity>
          </View>
          
          {/* Calendar or Week View */}
          {viewMode === 'monthly' ? (
            <Calendar
              onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
              markedDates={getMarkedDates()}
              onMonthChange={handleMonthChange}
              current={format(currentMonth, 'yyyy-MM-dd')}
              theme={{
                backgroundColor: COLORS.white,
                calendarBackground: COLORS.white,
                textSectionTitleColor: COLORS.text,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.white,
                todayTextColor: COLORS.primary,
                dayTextColor: COLORS.text,
                textDisabledColor: COLORS.grey[400],
                dotColor: COLORS.secondary,
                selectedDotColor: COLORS.white,
                arrowColor: COLORS.primary,
                monthTextColor: COLORS.text,
                indicatorColor: COLORS.primary,
              }}
            />
          ) : (
            renderWeekView()
          )}
          
          <View style={styles.eventsContainer}>
            <View style={styles.eventsHeader}>
              <Text style={styles.eventsTitle}>Activities</Text>
              {isLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            
            <View style={styles.eventsContent}>
              {!isLoading && getActivitiesForSelectedDate().length > 0 ? (
                getActivitiesForSelectedDate().map(activity => (
                  <EventCard key={activity.id} activity={activity} />
                ))
              ) : (
                !isLoading && (
                  <Text style={styles.noEventsText}>
                    No activities scheduled for {viewMode === 'monthly' ? 'this date' : 'this week'}
                  </Text>
                )
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      
      {userRole !== 'parent' && (
        <TouchableOpacity style={styles.fab} onPress={onCreateActivity} activeOpacity={0.85}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
      
      {/* Activity Type Filter Modal */}
      <Modal
        visible={showTypeFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTypeFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Activity Type</Text>
              <TouchableOpacity 
                onPress={() => setShowTypeFilter(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'all' && styles.optionSelected]}
              onPress={() => { setSelectedType('all'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="filter-variant-remove" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'all' && styles.optionTextSelected]}>All Types</Text>
              </View>
              {selectedType === 'all' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'training' && styles.optionSelected]}
              onPress={() => { setSelectedType('training'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="whistle" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'training' && styles.optionTextSelected]}>Training</Text>
              </View>
              {selectedType === 'training' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'game' && styles.optionSelected]}
              onPress={() => { setSelectedType('game'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="trophy-outline" size={20} color={'#E67E22'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'game' && styles.optionTextSelected]}>Game</Text>
              </View>
              {selectedType === 'game' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'tournament' && styles.optionSelected]}
              onPress={() => { setSelectedType('tournament'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="tournament" size={20} color={'#8E44AD'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'tournament' && styles.optionTextSelected]}>Tournament</Text>
              </View>
              {selectedType === 'tournament' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.optionItem, selectedType === 'other' && styles.optionSelected]}
              onPress={() => { setSelectedType('other'); setShowTypeFilter(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-text" size={20} color={'#2ECC71'} style={{ marginRight: 8 }} />
                <Text style={[styles.optionText, selectedType === 'other' && styles.optionTextSelected]}>Other</Text>
              </View>
              {selectedType === 'other' && (
                <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Month Filter Modal */}
      <Modal
        visible={showMonthFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMonthFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity 
                onPress={() => setShowMonthFilter(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {generateMonthOptions().map((monthOption, index) => {
                const isSelected = 
                  monthOption.date.getMonth() === currentMonth.getMonth() && 
                  monthOption.date.getFullYear() === currentMonth.getFullYear();
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionItem, isSelected && styles.optionSelected]}
                    onPress={() => { 
                      setCurrentMonth(monthOption.date);
                      // Also update current week to be in the same month
                      setCurrentWeek(monthOption.date);
                      setShowMonthFilter(false); 
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="calendar-month" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{monthOption.label}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainScrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filtersContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  filterIcon: {
    marginRight: SPACING.xs,
  },
  viewToggleChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 8,
  },
  toggleChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[200],
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginHorizontal: 2,
    height: 32,
  },
  toggleChipSmallActive: {
    backgroundColor: COLORS.primary,
  },
  toggleChipSmallText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 6,
  },
  toggleChipSmallTextActive: {
    color: COLORS.white,
  },
  weekViewContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 8,
    margin: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  weekRangeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  eventsContainer: {
    padding: SPACING.md,
    flex: 1,
    minHeight: 200, // Ensure there's enough space for the "No activities" message
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  eventsContent: {
    paddingBottom: 100, // Extra padding at the bottom for FAB and to ensure scrollability
  },
  eventCard: {
    marginBottom: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTypeText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  eventDate: {
    fontSize: 14,
    color: COLORS.grey[700],
    marginTop: 2,
  },
  noEventsText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.grey[500],
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  repeatIcon: {
    marginLeft: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  optionSelected: {
    backgroundColor: COLORS.grey[100],
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  optionTextSelected: {
    fontWeight: '500',
    color: COLORS.primary,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventScoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventScoreText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.text,
  },
  eventScoreResult: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.grey[700],
  },
  eventTeam: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: 2,
  },
  fabText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
}); 