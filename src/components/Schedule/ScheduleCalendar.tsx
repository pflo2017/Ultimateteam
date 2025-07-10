import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, SafeAreaView, Modal, TextInput, TouchableWithoutFeedback } from 'react-native';
import { Text, Button, Card, FAB, Chip } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getActivities, getActivitiesByDateRange, ActivityType as ServiceActivityType, Activity } from '../../services/activitiesService';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, setMonth, 
  addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, addDays, getDate, isSameWeek, isWithinInterval, isAfter, isBefore } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TeamFilterModal } from '../../components/Teams/TeamFilterModal';
import { getUserClubId } from '../../services/activitiesService';
import { useTranslation } from 'react-i18next';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScheduleCalendarProps = {
  userRole: 'admin' | 'coach' | 'parent';
  onCreateActivity: () => void;
};

type ViewMode = 'monthly' | 'weekly';

// Helper functions for activity display
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

const getActivityTypeLabel = (type: ServiceActivityType | 'all', t: any) => {
  switch (type) {
    case 'training':
      return t('admin.schedule.training');
    case 'game':
      return t('admin.schedule.game');
    case 'tournament':
      return t('admin.schedule.tournament');
    case 'other':
      return t('admin.schedule.other');
    case 'all':
      return t('admin.schedule.allTypes');
    default:
      return t('admin.schedule.event');
  }
};

const getActivityColor = (type: ServiceActivityType) => {
  switch (type) {
    case 'training':
      return '#4AADCC';
    case 'game':
      return '#E67E22'; // Orange
    case 'tournament':
      return '#8E44AD'; // Purple
    default:
      return '#2ECC71'; // Green
  }
};

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
  
  // Floating Filter FAB
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterType, setSelectedFilterType] = useState<ServiceActivityType | 'all'>('all');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]); // To be fetched
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]); // All selected by default
  
  // Add state for the proper team filter modal with data isolation
  const [showTeamFilterModal, setShowTeamFilterModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string; is_active?: boolean; club_id?: string; } | null>(null);
  
  // Add state for coach's teams
  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([]);
  
  // Use focus effect to reload activities when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Schedule screen focused - reloading activities');
      loadActivities();
      return () => {
        // Cleanup if needed
      };
    }, [viewMode === 'monthly' ? currentMonth : currentWeek, coachTeamIds, selectedTeam])
  );
  
  // Initial load
  useEffect(() => {
    loadActivities();
  }, [viewMode === 'monthly' ? currentMonth : currentWeek, coachTeamIds, selectedTeam]);
  
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        if (userRole === 'admin') {
          // Get club_id using the reliable utility function
          const clubId = await getUserClubId();
          
          if (!clubId) {
            console.error('Error fetching teams: No club ID found for admin');
            return;
          }
          
          console.log('Admin club ID for teams:', clubId);
          
          const { data: teamsData, error } = await supabase
            .from('teams')
            .select('id, name')
            .eq('club_id', clubId)
            .eq('is_active', true)
            .order('name');
            
          if (error) {
            console.error('Error fetching teams:', error);
            return;
          }
          
          if (teamsData) {
            setTeams(teamsData);
          }
        } else if (userRole === 'coach' && coachTeamIds.length > 0) {
          // Fetch team details for coach's teams
          const { data: teamsData, error } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', coachTeamIds)
            .eq('is_active', true)
            .order('name');
          if (!error && teamsData) {
            setTeams(teamsData);
            // Also select all teams by default
            setSelectedTeamIds(teamsData.map(team => team.id));
          }
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    };
    
    fetchTeams();
  }, [userRole, coachTeamIds]);
  
  // Add useEffect to fetch coach's teams when userRole is "coach"
  useEffect(() => {
    const fetchCoachTeams = async () => {
      if (userRole !== 'coach') return;
      
      try {
        // Get coach data from AsyncStorage
        const coachData = await AsyncStorage.getItem('coach_data');
        if (!coachData) return;
        
        const coach = JSON.parse(coachData);
        
        // Get teams using the get_coach_teams function
        const { data: teamsData, error: teamsError } = await supabase
          .rpc('get_coach_teams', { p_coach_id: coach.id });
          
        if (teamsError) {
          console.error('Error fetching coach teams:', teamsError);
          return;
        }
        
        if (!teamsData || teamsData.length === 0) {
          console.log('No teams found for coach');
          return;
        }
        
        // Extract team IDs
        const teamIds = teamsData.map((team: any) => team.team_id);
        console.log('Coach teams fetched:', teamIds);
        setCoachTeamIds(teamIds);
      } catch (error) {
        console.error('Error fetching coach teams:', error);
      }
    };
    
    fetchCoachTeams();
  }, [userRole]);
  
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
      
      console.log(`Loading activities from ${start} to ${end}`);
      
      // Filter by team if selected
      let teamId = undefined;
      if (selectedTeam) {
        teamId = selectedTeam.id;
        console.log(`Filtering activities by team: ${teamId}`);
      } else if (userRole === 'coach' && coachTeamIds.length > 0) {
        // For coaches, filter by their teams if no specific team is selected
        teamId = undefined; // Let the backend handle coach team filtering
      }
      
      // Different approach based on user role
      if (userRole === 'admin') {
        // Admin sees all activities for their club (data isolation enforced by backend)
        const { data, error } = await getActivitiesByDateRange(start, end, teamId);
        if (error) {
          console.error('Error loading activities:', error);
          setActivities([]);
        } else if (data) {
          // Filter by type if needed
          let filteredActivities = data;
          if (selectedFilterType !== 'all') {
            filteredActivities = data.filter(activity => activity.type === selectedFilterType);
          }
          
          console.log(`Loaded ${filteredActivities.length} activities for admin`);
          setActivities(filteredActivities);
        }
      } else if (userRole === 'coach') {
        // Coach sees only activities for their teams
        const { data, error } = await getActivitiesByDateRange(start, end, teamId);
        
        if (error) {
          console.error('Error loading activities for coach:', error);
          setActivities([]);
        } else if (data) {
          // Filter by type if needed
          let filteredActivities = data;
          if (selectedFilterType !== 'all') {
            filteredActivities = data.filter(activity => activity.type === selectedFilterType);
          }
          
          console.log(`Loaded ${filteredActivities.length} activities for coach`);
          setActivities(filteredActivities);
        }
      } else {
        // Parent sees only activities for their children's teams
        const { data, error } = await getActivitiesByDateRange(start, end, teamId);
        
        if (error) {
          console.error('Error loading activities for parent:', error);
          setActivities([]);
        } else if (data) {
          // Filter by type if needed
          let filteredActivities = data;
          if (selectedFilterType !== 'all') {
            filteredActivities = data.filter(activity => activity.type === selectedFilterType);
          }
          
          console.log(`Loaded ${filteredActivities.length} activities for parent`);
          setActivities(filteredActivities);
        }
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
      const activityDate = format(parseISO(activity.start_time), 'yyyy-MM-dd');
      
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
  
  // Get activities for the selected date
  const getActivitiesForSelectedDate = () => {
    // First filter by selected date
    const dateActivities = activities.filter(activity => {
      const activityDate = format(parseISO(activity.start_time), 'yyyy-MM-dd');
      return activityDate === selectedDate;
    });
    
    // Then filter by selected type if needed
    return selectedType === 'all' 
      ? dateActivities 
      : dateActivities.filter(activity => activity.type === selectedType);
  };
  
  // Get activities for the selected week (for weekly view)
  const getActivitiesForSelectedWeek = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
    
    // Filter activities that fall within the selected week
    const weekActivities = activities.filter(activity => {
      const activityDate = parseISO(activity.start_time);
      return (
        (isAfter(activityDate, weekStart) || isSameDay(activityDate, weekStart)) &&
        (isBefore(activityDate, weekEnd) || isSameDay(activityDate, weekEnd))
      );
    });
    // Sort by start_time ascending
    const sortedWeekActivities = [...weekActivities].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    // Then filter by selected type if needed
    return selectedType === 'all' 
      ? sortedWeekActivities
      : sortedWeekActivities.filter(activity => activity.type === selectedType);
  };
  
  const handleMonthChange = (month: DateData) => {
    const newMonth = new Date(month.timestamp);
    setCurrentMonth(newMonth);
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

  const { t } = useTranslation();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Make the entire page scrollable */}
      <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Replace the header/filter/tabs row with a new row containing horizontal tabs and the filter button */}
          <View style={styles.tabsRow}>
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => setViewMode('monthly')}
              >
                <Text style={[styles.tabText, viewMode === 'monthly' && styles.tabTextActive]}>{t('admin.schedule.monthly')}</Text>
                {viewMode === 'monthly' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => setViewMode('weekly')}
              >
                <Text style={[styles.tabText, viewMode === 'weekly' && styles.tabTextActive]}>{t('admin.schedule.weekly')}</Text>
                {viewMode === 'weekly' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.filterIconButton}
              onPress={() => setShowFilterModal(true)}
            >
              <MaterialCommunityIcons name="filter" size={24} color={COLORS.primary} />
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
              <Text style={styles.eventsTitle}>{t('admin.schedule.activities')}</Text>
              {isLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            
            <View style={styles.eventsContent}>
              {!isLoading && ((viewMode === 'monthly' ? getActivitiesForSelectedDate() : getActivitiesForSelectedWeek())).length > 0 ? (
                (viewMode === 'monthly' ? getActivitiesForSelectedDate() : getActivitiesForSelectedWeek()).map(activity => (
                  <EventCard key={activity.id} activity={activity} isWeeklyView={viewMode === 'weekly'} />
                ))
              ) : (
                !isLoading && (
                  <Text style={styles.noEventsText}>
                    {t('admin.schedule.noActivities')} {viewMode === 'monthly' ? t('admin.schedule.thisDate') : t('admin.schedule.thisWeek')}
                  </Text>
                )
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      
      {userRole !== 'parent' && (
        <TouchableOpacity style={styles.fab} onPress={onCreateActivity} activeOpacity={0.85}>
          <Text style={styles.fabTextNews}>+</Text>
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
              <Text style={styles.modalTitle}>{t('admin.schedule.selectActivityType')}</Text>
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
                <Text style={[styles.optionText, selectedType === 'all' && styles.optionTextSelected]}>{t('admin.schedule.allTypes')}</Text>
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
                <Text style={[styles.optionText, selectedType === 'training' && styles.optionTextSelected]}>{t('admin.schedule.training')}</Text>
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
                <Text style={[styles.optionText, selectedType === 'game' && styles.optionTextSelected]}>{t('admin.schedule.game')}</Text>
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
                <Text style={[styles.optionText, selectedType === 'tournament' && styles.optionTextSelected]}>{t('admin.schedule.tournament')}</Text>
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
                <Text style={[styles.optionText, selectedType === 'other' && styles.optionTextSelected]}>{t('admin.schedule.other')}</Text>
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
              <Text style={styles.modalTitle}>{t('admin.schedule.selectMonth')}</Text>
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
      
      {/* Filter Modal/Bottom Sheet */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.filterModalContent}>
                <ScrollView>
                  <Text style={styles.filterModalTitle}>{t('admin.schedule.filterActivities')}</Text>
                  <Text style={styles.filterModalSection}>{t('admin.schedule.activityType')}</Text>
                  <View style={styles.filterChipRow}>
                    {(['all', 'training', 'game', 'tournament', 'other'] as (ServiceActivityType | 'all')[]).map((type) => {
                      const isSelected = selectedFilterType === type;
                      let selectedColor = COLORS.primary;
                      if (type === 'training') selectedColor = '#4AADCC';
                      else if (type === 'game') selectedColor = '#E67E22';
                      else if (type === 'tournament') selectedColor = '#8E44AD';
                      else if (type === 'other') selectedColor = '#2ECC71';
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.chip,
                            isSelected && { backgroundColor: selectedColor, borderColor: selectedColor }
                          ]}
                          onPress={() => setSelectedFilterType(type as ServiceActivityType)}
                        >
                          <MaterialCommunityIcons
                            name={getActivityIcon(type as ServiceActivityType)}
                            size={16}
                            color={isSelected ? '#fff' : selectedColor}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.chipText,
                            isSelected && { color: '#fff' }
                          ]}>
                            {getActivityTypeLabel(type as ServiceActivityType, t)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.filterModalSection}>{t('admin.schedule.teams')}</Text>
                  
                  {/* Replace the team chips with a button to open the FilterTeamsModal */}
                  <TouchableOpacity
                    style={styles.teamSelectorButton}
                    onPress={() => {
                      setShowFilterModal(false);
                      setTimeout(() => setShowTeamFilterModal(true), 300);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.teamSelectorText}>
                        {selectedTeam ? selectedTeam.name : t('admin.schedule.allTeams')}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.grey[400]} />
                  </TouchableOpacity>
                  
                  <Button mode="contained" onPress={() => setShowFilterModal(false)} style={styles.filterApplyButton}>
                    {t('admin.schedule.applyFilters')}
                  </Button>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Add the FilterTeamsModal component for proper data isolation */}
      <TeamFilterModal
        visible={showTeamFilterModal}
        onClose={() => setShowTeamFilterModal(false)}
        onSelectTeam={(team) => {
          setSelectedTeam(team);
          // If a team is selected, update selectedTeamIds to only include this team
          if (team) {
            setSelectedTeamIds([team.id]);
          } else {
            // If "All Teams" is selected, include all teams
            setSelectedTeamIds(teams.map(t => t.id));
          }
          // Re-open the filter modal after selection
          setTimeout(() => setShowFilterModal(true), 300);
        }}
        selectedTeam={selectedTeam}
        styles={styles}
      />
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
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
    flex: 1,
  },
  tabButton: {
    alignItems: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 16,
    color: COLORS.grey[600],
    fontWeight: '400',
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 2,
    height: 4,
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  filterIconButton: {
    padding: SPACING.xs,
    marginLeft: 8,
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
  fabTextNews: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    minHeight: 320,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterModalSection: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 32,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  filterApplyButton: {
    marginTop: 16,
  },
  teamSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  teamSelectorText: {
    fontSize: 16,
    color: COLORS.text,
  },
});

export const EventCard = ({ activity, isWeeklyView }: { activity: Activity, isWeeklyView?: boolean }) => {
  const { t } = useTranslation();
  const startTime = parseISO(activity.start_time);
  const cardNavigation = useNavigation<NavigationProp>();
  const activityColor = getActivityColor(activity.type);

  // Parse duration (e.g., '1h', '90m', '1h 30m')
  let durationMinutes = 0;
  if (activity.duration) {
    const hourMatch = activity.duration.match(/(\d+)h/);
    const minMatch = activity.duration.match(/(\d+)m/);
    if (hourMatch) durationMinutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) durationMinutes += parseInt(minMatch[1], 10);
  }
  // End time = start + duration
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  // Ended threshold = end + 1 hour
  const endedThreshold = new Date(endTime.getTime() + 60 * 60000);
  const isEnded = Date.now() > endedThreshold.getTime();

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
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      {isWeeklyView && (
        <View style={{ width: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
          <Text style={{ color: COLORS.grey[600], fontSize: 14, fontWeight: '500', lineHeight: 18 }}>
            {format(startTime, 'EEE')}
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: 'bold', lineHeight: 26 }}>
            {format(startTime, 'd')}
          </Text>
        </View>
      )}
      <Card 
        style={[styles.eventCard, { borderLeftWidth: 4, borderLeftColor: activityColor, minHeight: 88, flex: 1, justifyContent: 'center' }]} 
        onPress={handlePress}
      >
        <Card.Content style={{ justifyContent: 'center' }}>
          <View style={styles.eventHeader}>
            <View style={styles.eventType}>
              <MaterialCommunityIcons 
                name={getActivityIcon(activity.type)} 
                size={18} 
                color={activityColor} 
              />
              <Text style={[styles.eventTypeText, { color: activityColor }]}> 
                {getActivityTypeLabel(activity.type, t)}
              </Text>
              {activity.is_repeating && (
                <MaterialCommunityIcons name="repeat" size={14} color={activityColor} style={styles.repeatIcon} />
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isEnded && (
                <View style={{ backgroundColor: COLORS.grey[400], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4 }}>
                  <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 'bold' }}>ended</Text>
                </View>
              )}
              <Text style={styles.eventTime}>
                {format(startTime, 'HH:mm')}
              </Text>
            </View>
          </View>
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
    </View>
  );
}; 