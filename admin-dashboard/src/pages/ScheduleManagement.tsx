import React, { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Tabs,
  Button,
  Group,
  Text,
  Select,
  Grid,
  Card,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Stack,
  Checkbox,
  MultiSelect,
  Box,
  Flex,
  Center,
  Divider,
  ScrollArea
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { 
  IconCalendarEvent, 
  IconPlus, 
  IconTrash, 
  IconEdit,
  IconCalendarTime,
  IconMapPin,
  IconUsers,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconCalendarWeek,
  IconTrophy,
  IconSnowman,
  IconCertificate,
  IconCalendarStats,
  IconActivity
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { getClubAdminClubId } from '../lib/supabase';
import { format, addMonths, subMonths, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks, isToday, isSameWeek } from 'date-fns';

interface Team {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  title: string;
  location: string;
  start_time: string;
  end_time?: string;
  duration: string;
  type: 'training' | 'game' | 'tournament' | 'other';
  team_id: string;
  team_name?: string;
  is_repeating?: boolean;
  repeat_type?: 'daily' | 'weekly' | 'monthly';
  repeat_days?: number[];
  repeat_until?: string;
}

interface Player {
  id: string;
  name: string;
}

const ScheduleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string | null>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>('all');
  const [teams, setTeams] = useState<Team[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'month'>('day');
  
  // Activity creation state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [activityType, setActivityType] = useState<'training' | 'game' | 'tournament' | 'other'>('training');
  const [activityDate, setActivityDate] = useState<Date | null>(new Date());
  const [activityTime, setActivityTime] = useState('18:00');
  const [activityDuration, setActivityDuration] = useState('1h');
  const [activityTeam, setActivityTeam] = useState<string | null>(null);
  const [activityNotes, setActivityNotes] = useState('');
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [repeatUntil, setRepeatUntil] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() + 1))
  );
  
  // Game specific fields
  const [homeAway, setHomeAway] = useState<'home' | 'away'>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  // Keep track of all month activities (for markers) and filtered activities (for display)
  const [allMonthActivities, setAllMonthActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        setLoading(true);
        
        // Get the club ID for the logged-in club admin
        const id = await getClubAdminClubId();
        setClubId(id);
        
        if (id) {
          // Fetch teams for this club
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('club_id', id)
            .eq('is_active', true)
            .order('name');
            
          if (teamsError) throw teamsError;
          
          if (teamsData) {
            setTeams(teamsData);
            
            // If there's only one team, select it by default
            if (teamsData.length === 1) {
              setSelectedTeam(teamsData[0].id);
              setActivityTeam(teamsData[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching club data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClubData();
  }, []);
  
  // Load activities when team or date changes
  useEffect(() => {
    if (selectedTeam) {
      fetchActivities();
    }
  }, [selectedTeam, selectedDate, selectedType, activeTab]);
  
  // Load players when team changes for game lineup selection
  useEffect(() => {
    if (activityTeam && activityType === 'game') {
      fetchPlayersForTeam(activityTeam);
    }
  }, [activityTeam, activityType]);
  
  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on active tab
      let startDate: Date = new Date();
      let endDate: Date = new Date();
      
      if (activeTab === 'calendar') {
        // For month view: start of month to end of month
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      } else if (activeTab === 'week') {
        // For week view: start of week to end of week
        startDate = startOfWeek(selectedDate, { weekStartsOn: 0 }); // 0 = Sunday
        endDate = endOfWeek(selectedDate, { weekStartsOn: 0 });
      }
      
      // Format dates for query
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      // Build query
      let query = supabase
        .from('activities')
        .select(`
          id, title, location, start_time, end_time, duration, type,
          team_id, teams(name), is_repeating, repeat_type, repeat_days, repeat_until
        `)
        // Get both:
        // 1. Activities with start_time within the current range
        // 2. Recurring activities that might start before the range but repeat into it
        .or(`and(start_time.gte.${startDateStr},start_time.lte.${endDateStr}),and(is_repeating.eq.true,repeat_until.gte.${startDateStr})`)
      
      // Filter by team if selected
      if (selectedTeam && selectedTeam !== 'all') {
        query = query.eq('team_id', selectedTeam);
      } else if (clubId) {
        // If no team selected, filter by club
        query = query.eq('club_id', clubId);
      }
      
      // Filter by type if selected
      if (selectedType && selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process data to include team name and handle recurring events
      let processedActivities: Activity[] = [];
      
      data.forEach((activity: any) => {
        // Add the original activity
        const baseActivity = {
          ...activity,
          team_name: activity.teams?.name
        };
        
        // Add the original activity to the list
        processedActivities.push(baseActivity);
        
        // If activity is recurring, calculate all instances in current range
        if (activity.is_repeating && activity.repeat_until) {
          const activityStartDate = new Date(activity.start_time);
          const repeatUntilDate = new Date(activity.repeat_until);
          
          // Only process if the repeat until date is after the start of the range
          if (repeatUntilDate >= startDate) {
            // Calculate recurrence based on repeat_type
            switch (activity.repeat_type) {
              case 'daily':
                // Daily recurrence
                let dailyDate = new Date(activityStartDate);
                // Start from the next day after the original activity
                dailyDate.setDate(dailyDate.getDate() + 1);
                
                while (dailyDate <= repeatUntilDate && dailyDate <= endDate) {
                  // Skip if the date is before the start of the month
                  if (dailyDate >= startDate) {
                    const recurrenceId = `${activity.id}-${format(dailyDate, 'yyyyMMdd')}`;
                    processedActivities.push({
                      ...baseActivity,
                      id: recurrenceId,
                      start_time: new Date(
                        dailyDate.getFullYear(),
                        dailyDate.getMonth(),
                        dailyDate.getDate(),
                        activityStartDate.getHours(),
                        activityStartDate.getMinutes()
                      ).toISOString()
                    });
                  }
                  dailyDate.setDate(dailyDate.getDate() + 1);
                }
                break;
                
              case 'weekly':
                // Weekly recurrence
                if (activity.repeat_days && activity.repeat_days.length > 0) {
                  // Get the day of week of the original activity (0-6, where 0 is Sunday)
                  const originalDayOfWeek = activityStartDate.getDay();
                  
                  // For each selected day of the week
                  activity.repeat_days.forEach((dayOfWeek: number) => {
                    // Skip the original activity's day of week as it's already included
                    if (dayOfWeek === originalDayOfWeek && 
                        activityStartDate.getMonth() === selectedDate.getMonth() &&
                        activityStartDate.getFullYear() === selectedDate.getFullYear()) {
                      return;
                    }
                    
                    // Calculate days to add to get to this day of week
                    let daysToAdd = (dayOfWeek - originalDayOfWeek + 7) % 7;
                    if (daysToAdd === 0) daysToAdd = 7; // For the same day next week
                    
                    // Calculate the first occurrence of this day
                    let weeklyDate = new Date(activityStartDate);
                    weeklyDate.setDate(weeklyDate.getDate() + daysToAdd);
                    
                    // Now add weekly occurrences
                    while (weeklyDate <= repeatUntilDate && weeklyDate <= endDate) {
                      // Skip if the date is before the start of the month
                      if (weeklyDate >= startDate) {
                        const recurrenceId = `${activity.id}-${format(weeklyDate, 'yyyyMMdd')}`;
                        processedActivities.push({
                          ...baseActivity,
                          id: recurrenceId,
                          start_time: new Date(
                            weeklyDate.getFullYear(),
                            weeklyDate.getMonth(),
                            weeklyDate.getDate(),
                            activityStartDate.getHours(),
                            activityStartDate.getMinutes()
                          ).toISOString()
                        });
                      }
                      // Add 7 days for next week's occurrence
                      weeklyDate.setDate(weeklyDate.getDate() + 7);
                    }
                  });
                  
                  // Also handle subsequent weeks for the original day
                  let nextWeekDate = new Date(activityStartDate);
                  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
                  
                  while (nextWeekDate <= repeatUntilDate && nextWeekDate <= endDate) {
                    // Skip if the date is before the start of the month
                    if (nextWeekDate >= startDate) {
                      const recurrenceId = `${activity.id}-${format(nextWeekDate, 'yyyyMMdd')}`;
                      processedActivities.push({
                        ...baseActivity,
                        id: recurrenceId,
                        start_time: new Date(
                          nextWeekDate.getFullYear(),
                          nextWeekDate.getMonth(),
                          nextWeekDate.getDate(),
                          activityStartDate.getHours(),
                          activityStartDate.getMinutes()
                        ).toISOString()
                      });
                    }
                    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
                  }
                }
                break;
                
              case 'monthly':
                // Monthly recurrence - same day each month
                let monthlyDate = new Date(activityStartDate);
                // Move to next month for first recurrence
                monthlyDate.setMonth(monthlyDate.getMonth() + 1);
                
                while (monthlyDate <= repeatUntilDate && monthlyDate <= endDate) {
                  // Skip if the date is before the start of the month
                  if (monthlyDate >= startDate) {
                    const recurrenceId = `${activity.id}-${format(monthlyDate, 'yyyyMMdd')}`;
                    processedActivities.push({
                      ...baseActivity,
                      id: recurrenceId,
                      start_time: new Date(
                        monthlyDate.getFullYear(),
                        monthlyDate.getMonth(),
                        monthlyDate.getDate(),
                        activityStartDate.getHours(),
                        activityStartDate.getMinutes()
                      ).toISOString()
                    });
                  }
                  monthlyDate.setMonth(monthlyDate.getMonth() + 1);
                }
                break;
            }
          }
        }
      });
      
      // Sort all activities chronologically
      processedActivities = sortActivitiesChronologically(processedActivities);
      
      // Store all activities for the current view
      if (activeTab === 'calendar') {
        setAllMonthActivities(processedActivities);
      } else if (activeTab === 'week') {
        setWeekActivities(processedActivities);
      }
      
      // Filter for the selected day in calendar view
      if (activeTab === 'calendar') {
        if (calendarViewMode === 'day') {
          const selectedDay = format(selectedDate, 'yyyy-MM-dd');
          const filteredForDay = processedActivities.filter(activity => {
            const activityDate = format(new Date(activity.start_time), 'yyyy-MM-dd');
            return activityDate === selectedDay;
          });
          // Keep chronological order for day view
          setFilteredActivities(filteredForDay);
        } else {
          // In month view, show all activities for the month
          setFilteredActivities(processedActivities);
        }
      } else {
        // In week view, show all activities for the week
        setFilteredActivities(processedActivities);
      }
      
      setActivities(processedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPlayersForTeam = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('name');
        
      if (error) throw error;
      
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };
  
  const handleCreateActivity = async () => {
    try {
      if (!activityTitle || !activityLocation || !activityDate || !activityTeam) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Combine date and time
      const dateObj = new Date(activityDate as Date);
      const [hours, minutes] = activityTime.split(':').map(Number);
      dateObj.setHours(hours, minutes);
      
      // Create activity object
      const newActivity = {
        title: activityTitle,
        location: activityLocation,
        start_time: dateObj.toISOString(),
        duration: activityDuration,
        type: activityType,
        team_id: activityTeam,
        club_id: clubId,
        additional_info: activityNotes,
        is_public: true,
        created_by: 'web-admin',
        // Add repeating fields if applicable
        is_repeating: isRepeating,
        repeat_type: isRepeating ? repeatType : null,
        repeat_days: isRepeating ? repeatDays.map(Number) : null,
        repeat_until: isRepeating && repeatUntil ? repeatUntil.toISOString() : null,
        // Add game specific fields if applicable
        home_away: activityType === 'game' ? homeAway : null,
        lineup_players: activityType === 'game' ? selectedPlayers : null
      };
      
      // Insert activity
      const { data, error } = await supabase
        .from('activities')
        .insert(newActivity)
        .select();
        
      if (error) throw error;
      
      // Close modal and reset form
      setCreateModalOpen(false);
      resetForm();
      
      // Refresh activities
      fetchActivities();
      
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Failed to create activity. Please try again.');
    }
  };
  
  const resetForm = () => {
    setActivityTitle('');
    setActivityLocation('');
    setActivityType('training');
    setActivityDate(new Date());
    setActivityTime('18:00');
    setActivityDuration('1h');
    setActivityNotes('');
    setIsRepeating(false);
    setRepeatType('weekly');
    setRepeatDays([]);
    setRepeatUntil(new Date(new Date().setMonth(new Date().getMonth() + 1)));
    setHomeAway('home');
    setSelectedPlayers([]);
  };
  
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${format(date, 'HH:mm')}`;
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${format(date, 'EEE, d MMM')} • ${format(date, 'h')}h`;
  };
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'training':
        return 'cyan';
      case 'game':
        return 'orange';
      case 'tournament':
        return 'violet';
      default:
        return 'green';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <IconActivity size={20} />;
      case 'game':
        return <IconTrophy size={20} />;
      case 'tournament':
        return <IconCertificate size={20} />;
      default:
        return <IconCalendarStats size={20} />;
    }
  };

  const isActivityEnded = (activity: Activity) => {
    const now = new Date();
    const activityDate = new Date(activity.start_time);
    
    // Add duration to activity start time
    let hours = 1;
    let minutes = 0;
    
    if (activity.duration) {
      const durationMatch = activity.duration.match(/(\d+)h(?:\s*(\d+)m)?/);
      if (durationMatch) {
        hours = parseInt(durationMatch[1]) || 0;
        minutes = parseInt(durationMatch[2] || '0') || 0;
      }
    }
    
    const endTime = new Date(activityDate);
    endTime.setHours(endTime.getHours() + hours);
    endTime.setMinutes(endTime.getMinutes() + minutes);
    
    return now > endTime;
  };
  
  // Check if a date has activities
  const hasActivitiesOnDate = (date: Date): boolean => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return allMonthActivities.some(activity => {
      const activityDate = format(new Date(activity.start_time), 'yyyy-MM-dd');
      return activityDate === dayStr;
    });
  };
  
  // Get count of activities for a specific date
  const getActivityCountForDate = (date: Date): number => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return allMonthActivities.filter(activity => {
      const activityDate = format(new Date(activity.start_time), 'yyyy-MM-dd');
      return activityDate === dayStr;
    }).length;
  };
  
  // Add a helper to identify recurring instances
  const isRecurringInstance = (activityId: string): boolean => {
    // Use a more specific check - recurring instances have a dash followed by date format YYYYMMDD
    return activityId.includes('-') && /\-\d{8}$/.test(activityId);
  };

  // Get information about recurring instance
  const getRecurringInfo = (activity: Activity): string => {
    if (!isRecurringInstance(activity.id)) {
      return activity.is_repeating 
        ? `Original (repeats ${activity.repeat_type})`
        : '';
    } 
    return 'Recurring instance';
  };
  
  // Return to today's date
  const goToToday = () => {
    setSelectedDate(new Date());
  };
  
  // Navigate to previous month or week
  const goToPrevious = () => {
    if (activeTab === 'calendar') {
      setSelectedDate(subMonths(selectedDate, 1));
    } else if (activeTab === 'week') {
      setSelectedDate(subWeeks(selectedDate, 1));
    }
  };
  
  // Navigate to next month or week
  const goToNext = () => {
    if (activeTab === 'calendar') {
      setSelectedDate(addMonths(selectedDate, 1));
    } else if (activeTab === 'week') {
      setSelectedDate(addWeeks(selectedDate, 1));
    }
  };

  // Sort activities chronologically
  const sortActivitiesChronologically = (activities: Activity[]): Activity[] => {
    return [...activities].sort((a, b) => {
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Group activities by day for week view - starting with current day
  const getActivitiesByDay = () => {
    // Get the current date
    const now = new Date();
    
    // Start with today if in current week, otherwise start with the selected day
    const startDay = isSameWeek(selectedDate, now) ? now : selectedDate;
    
    // Create an array of 7 days starting from the start day
    const daysInWeek = Array(7).fill(0).map((_, index) => {
      const date = addDays(startDay, index);
      const activitiesForDay = weekActivities.filter(activity => 
        isSameDay(new Date(activity.start_time), date)
      );
      
      // Sort activities for each day chronologically
      const sortedActivities = sortActivitiesChronologically(activitiesForDay);
      
      return {
        date,
        activities: sortedActivities
      };
    });
    
    return daysInWeek;
  };
  
  return (
    <Container size="xl">
      <Title order={2} mb="md">Schedule Management</Title>
      
      <Paper p="md" mb="md" radius="md" withBorder>
        <Tabs value={activeTab} onTabChange={(tab) => {
          setActiveTab(tab);
          // Refresh activities when switching tabs to apply proper filtering
          setTimeout(() => fetchActivities(), 0);
        }}>
          <Tabs.List>
            <Tabs.Tab value="calendar" icon={<IconCalendarEvent size={16} />}>
              Monthly
            </Tabs.Tab>
            <Tabs.Tab value="week" icon={<IconCalendarWeek size={16} />}>
              Weekly
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        
        {/* Calendar Header */}
        <Box mt="md" mb="md">
          <Flex justify="space-between" align="center">
            <Button variant="subtle" onClick={goToPrevious} px={5}>
              <IconChevronLeft size={20} />
            </Button>
            
            <Text fw={600} size="lg" style={{ flexGrow: 1, textAlign: 'center' }}>
              {activeTab === 'calendar' 
                ? format(selectedDate, 'MMMM yyyy')
                : `${format(getActivitiesByDay()[0].date, 'MMM d')} - ${format(getActivitiesByDay()[6].date, 'MMM d, yyyy')}`
              }
            </Text>
            
            <Button variant="subtle" onClick={goToNext} px={5}>
              <IconChevronRight size={20} />
            </Button>
          </Flex>
          
          {/* Filter controls at the top of the page */}
          <Flex justify="space-between" align="center" mt="md" mb="md">
            <Group>
              <Select
                placeholder="Team"
                value={selectedTeam}
                onChange={setSelectedTeam}
                data={[
                  { value: 'all', label: 'All Teams' },
                  ...teams.map(team => ({ value: team.id, label: team.name }))
                ]}
                w={150}
              />
              
              <Select
                placeholder="Type"
                value={selectedType}
                onChange={setSelectedType}
                data={[
                  { value: 'all', label: 'All Types' },
                  { value: 'training', label: 'Training' },
                  { value: 'game', label: 'Game' },
                  { value: 'tournament', label: 'Tournament' },
                  { value: 'other', label: 'Other' }
                ]}
                w={150}
                icon={<IconFilter size={16} />}
              />
            </Group>
            
            <Group>
              {activeTab === 'calendar' && (
                <Button.Group>
                  <Button 
                    variant={calendarViewMode === 'day' ? 'filled' : 'light'} 
                    compact 
                    onClick={() => setCalendarViewMode('day')}
                  >
                    Day
                  </Button>
                  <Button 
                    variant={calendarViewMode === 'month' ? 'filled' : 'light'} 
                    compact 
                    onClick={() => setCalendarViewMode('month')}
                  >
                    Month
                  </Button>
                </Button.Group>
              )}
              <Button variant="light" compact onClick={goToToday}>
                Today
              </Button>
              
              <Button 
                leftIcon={<IconPlus size={16} />}
                onClick={() => setCreateModalOpen(true)}
              >
                New Activity
              </Button>
            </Group>
          </Flex>
          
          {activeTab === 'calendar' && (
            <>
              {/* Day of week headers */}
              <Grid mt="md" mb="xs" gutter={0}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <Grid.Col span={1.7} key={day}>
                    <Center>
                      <Text size="sm" fw={500} c="dimmed">
                        {day}
                      </Text>
                    </Center>
                  </Grid.Col>
                ))}
              </Grid>
              
              {/* Calendar grid */}
              <Box style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
                marginBottom: '20px'
              }}>
                {Array(42).fill(0).map((_, index) => {
                  // Calculate the date for this cell
                  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday
                  
                  const day = index - startingDayOfWeek + 1;
                  const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                  
                  const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                  const isCurrentDay = isToday(date);
                  
                  const isSelected = 
                    date.getDate() === selectedDate.getDate() && 
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();
                  
                  const hasEvents = isCurrentMonth && hasActivitiesOnDate(date);
                  const activityCount = hasEvents ? getActivityCountForDate(date) : 0;
                  
                  return (
                    <Box 
                      key={index}
                      onClick={() => isCurrentMonth && setSelectedDate(date)}
                      sx={(theme) => ({
                        height: '50px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        cursor: isCurrentMonth ? 'pointer' : 'default',
                        borderRadius: theme.radius.sm,
                        ...(isSelected && {
                          backgroundColor: theme.colors.blue[6],
                          color: theme.white,
                        }),
                        ...(isCurrentDay && !isSelected && {
                          border: `2px solid ${theme.colors.blue[6]}`,
                        }),
                        ...(!isCurrentMonth && {
                          color: theme.colors.gray[4],
                        }),
                        '&:hover': isCurrentMonth && !isSelected ? {
                          backgroundColor: theme.colors.gray[1],
                        } : {}
                      })}
                    >
                      <Text size="sm" fw={500}>
                        {date.getDate()}
                      </Text>
                      
                      {hasEvents && (
                        <Box 
                          sx={(theme) => ({
                            marginTop: '2px',
                            width: activityCount > 9 ? '18px' : '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? theme.white : theme.colors.blue[6],
                            color: isSelected ? theme.colors.blue[6] : theme.white,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 'bold',
                          })}
                        >
                          {activityCount}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
          
          {activeTab === 'week' && (
            <Box mt="md">
              {getActivitiesByDay().map((day, index) => (
                <Box 
                  key={index} 
                  mb="xl"
                  sx={(theme) => ({
                    borderRadius: theme.radius.md,
                    backgroundColor: isToday(day.date) 
                      ? theme.colors.blue[0] 
                      : 'transparent',
                    overflow: 'hidden',
                  })}
                >
                  <Flex 
                    p="xs" 
                    align="center" 
                    justify="space-between"
                    sx={(theme) => ({
                      borderBottom: isToday(day.date) ? `1px solid ${theme.colors.blue[2]}` : 'none',
                      backgroundColor: isSameDay(day.date, selectedDate) 
                        ? theme.colors.gray[1]
                        : 'transparent',
                      cursor: 'pointer',
                    })}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <Text fw={600} size="lg">
                      {format(day.date, 'EEEE, MMMM d')}
                      {isToday(day.date) && (
                        <Badge ml="xs" color="blue">TODAY</Badge>
                      )}
                    </Text>
                  </Flex>
                  
                  {day.activities.length === 0 ? (
                    <Text c="dimmed" size="sm" p="md">No activities</Text>
                  ) : (
                    <Box p="xs">
                      <Grid gutter="xs">
                        {day.activities.map(activity => {
                          const isEnded = isActivityEnded(activity);
                          
                          return (
                            <Grid.Col key={activity.id} span={4}>
                              <Box 
                                sx={(theme) => ({
                                  borderRadius: theme.radius.md,
                                  border: `1px solid ${theme.colors.gray[3]}`,
                                  overflow: 'hidden',
                                  borderLeft: `4px solid ${theme.colors[getActivityColor(activity.type)][6]}`,
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                })}
                              >
                                <Box p="xs">
                                  <Flex justify="space-between" align="center" mb="xs">
                                    <Group spacing="xs">
                                      <Box c={getActivityColor(activity.type)}>
                                        {getActivityIcon(activity.type)}
                                      </Box>
                                      <Text c={getActivityColor(activity.type)} fw={500} size="sm">
                                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                      </Text>
                                    </Group>
                                    
                                    <Group spacing="xs">
                                      {isEnded && (
                                        <Badge color="gray" variant="filled" size="xs">
                                          ended
                                        </Badge>
                                      )}
                                      <Text fw={600}>
                                        {formatDateTime(activity.start_time)}
                                      </Text>
                                    </Group>
                                  </Flex>
                                  
                                  <Text fw={700} size="lg" mb="xs" lineClamp={1}>
                                    {activity.title}
                                  </Text>
                                  
                                  <Text size="sm" c="dimmed" lineClamp={1}>
                                    {activity.team_name}
                                  </Text>
                                  
                                  <Text size="xs" c="dimmed" mb="xs">
                                    {format(new Date(activity.start_time), 'EEE, MMM d, yyyy')}
                                  </Text>
                                  
                                  {(activity.is_repeating || isRecurringInstance(activity.id)) && (
                                    <Badge color="gray" size="xs">
                                      {getRecurringInfo(activity)}
                                    </Badge>
                                  )}
                                </Box>
                              </Box>
                            </Grid.Col>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
          
          {/* Selected date header */}
          {activeTab === 'calendar' && (
            <Box mb="md">
              <Divider mb="md" />
              <Text fw={600} size="lg">
                {calendarViewMode === 'day' 
                  ? format(selectedDate, 'EEEE, MMMM d, yyyy') 
                  : `All Activities for ${format(selectedDate, 'MMMM yyyy')}`
                }
              </Text>
            </Box>
          )}
        </Box>
      </Paper>
      
      {loading ? (
        <Center mt="xl">
          <Text>Loading activities...</Text>
        </Center>
      ) : activeTab === 'calendar' && filteredActivities.length === 0 ? (
        <Center mt="xl">
          <Text>No activities found for {format(selectedDate, 'MMMM d, yyyy')}.</Text>
        </Center>
      ) : activeTab === 'calendar' ? (
        <Box mt="md">
          <Text size="xl" fw={600} mb="md">Activities</Text>
          
          <Grid gutter="md">
            {filteredActivities.map(activity => {
              const isEnded = isActivityEnded(activity);
              
              return (
                <Grid.Col key={activity.id} span={4}>
                  <Box 
                    sx={(theme) => ({
                      borderRadius: theme.radius.md,
                      border: `1px solid ${theme.colors.gray[3]}`,
                      overflow: 'hidden',
                      borderLeft: `4px solid ${theme.colors[getActivityColor(activity.type)][6]}`,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    })}
                  >
                    <Box p="xs">
                      <Flex justify="space-between" align="center" mb="xs">
                        <Group spacing="xs">
                          <Box c={getActivityColor(activity.type)}>
                            {getActivityIcon(activity.type)}
                          </Box>
                          <Text c={getActivityColor(activity.type)} fw={500} size="sm">
                            {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                          </Text>
                        </Group>
                        
                        <Group spacing="xs">
                          {isEnded && (
                            <Badge color="gray" variant="filled" size="xs">
                              ended
                            </Badge>
                          )}
                          <Text fw={600}>
                            {formatDateTime(activity.start_time)}
                          </Text>
                        </Group>
                      </Flex>
                      
                      <Text fw={700} size="lg" mb="xs" lineClamp={1}>
                        {activity.title}
                      </Text>
                      
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {activity.team_name}
                      </Text>
                      
                      <Text size="xs" c="dimmed" mb="xs">
                        {format(new Date(activity.start_time), 'EEE, MMM d, yyyy')}
                      </Text>
                      
                      {(activity.is_repeating || isRecurringInstance(activity.id)) && (
                        <Badge color="gray" mt="xs" size="xs">
                          {getRecurringInfo(activity)}
                        </Badge>
                      )}
                      
                      <Flex justify="flex-end" mt="xs">
                        <Group spacing="xs">
                          <Button variant="light" color="blue" compact size="xs" leftIcon={<IconEdit size={14} />}>
                            Edit
                          </Button>
                          <Button variant="light" color="red" compact size="xs" leftIcon={<IconTrash size={14} />}>
                            Delete
                          </Button>
                        </Group>
                      </Flex>
                    </Box>
                  </Box>
                </Grid.Col>
              );
            })}
          </Grid>
        </Box>
      ) : null}
      
      {/* Create Activity Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Activity"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Title"
            placeholder="Activity title"
            required
            value={activityTitle}
            onChange={(e) => setActivityTitle(e.currentTarget.value)}
          />
          
          <TextInput
            label="Location"
            placeholder="Activity location"
            required
            value={activityLocation}
            onChange={(e) => setActivityLocation(e.currentTarget.value)}
          />
          
          <Select
            label="Activity Type"
            placeholder="Select type"
            required
            value={activityType}
            onChange={(value) => setActivityType(value as 'training' | 'game' | 'tournament' | 'other')}
            data={[
              { value: 'training', label: 'Training' },
              { value: 'game', label: 'Game' },
              { value: 'tournament', label: 'Tournament' },
              { value: 'other', label: 'Other' }
            ]}
          />
          
          {activityType === 'game' && (
            <Select
              label="Home/Away"
              placeholder="Select home or away"
              value={homeAway}
              onChange={(value) => setHomeAway(value as 'home' | 'away')}
              data={[
                { value: 'home', label: 'Home' },
                { value: 'away', label: 'Away' }
              ]}
            />
          )}
          
          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Date"
                required
                value={activityDate}
                onChange={setActivityDate}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TimeInput
                label="Time"
                required
                value={activityTime}
                onChange={(e) => setActivityTime(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Duration"
                placeholder="e.g. 1h"
                required
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
          
          <Select
            label="Team"
            placeholder="Select team"
            required
            value={activityTeam}
            onChange={setActivityTeam}
            data={teams.map(team => ({ value: team.id, label: team.name }))}
          />
          
          {activityType === 'game' && players.length > 0 && (
            <MultiSelect
              label="Lineup Players"
              placeholder="Select players for lineup"
              data={players.map(player => ({ value: player.id, label: player.name }))}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          )}
          
          <Textarea
            label="Additional Notes"
            placeholder="Any additional information"
            minRows={3}
            value={activityNotes}
            onChange={(e) => setActivityNotes(e.currentTarget.value)}
          />
          
          <Checkbox
            label="Repeat this activity"
            checked={isRepeating}
            onChange={(e) => setIsRepeating(e.currentTarget.checked)}
            mt="md"
          />
          
          {isRepeating && (
            <>
              <Select
                label="Repeat Type"
                placeholder="Select repeat type"
                value={repeatType}
                onChange={(value) => setRepeatType(value as 'daily' | 'weekly' | 'monthly')}
                data={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' }
                ]}
              />
              
              {repeatType === 'weekly' && (
                <MultiSelect
                  label="Repeat Days"
                  placeholder="Select days"
                  data={[
                    { value: '0', label: 'Sunday' },
                    { value: '1', label: 'Monday' },
                    { value: '2', label: 'Tuesday' },
                    { value: '3', label: 'Wednesday' },
                    { value: '4', label: 'Thursday' },
                    { value: '5', label: 'Friday' },
                    { value: '6', label: 'Saturday' }
                  ]}
                  value={repeatDays}
                  onChange={setRepeatDays}
                />
              )}
              
              <DatePickerInput
                label="Repeat Until"
                value={repeatUntil}
                onChange={setRepeatUntil}
              />
            </>
          )}
          
          <Group position="right" mt="md">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateActivity}>Create Activity</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default ScheduleManagement; 