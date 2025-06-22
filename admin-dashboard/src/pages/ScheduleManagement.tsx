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
  MultiSelect
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { 
  IconCalendarEvent, 
  IconPlus, 
  IconTrash, 
  IconEdit,
  IconCalendarTime,
  IconMapPin,
  IconUsers
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { getClubAdminClubId } from '../lib/supabase';

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
  }, [selectedTeam, selectedDate, selectedType]);
  
  // Load players when team changes for game lineup selection
  useEffect(() => {
    if (activityTeam && activityType === 'game') {
      fetchPlayersForTeam(activityTeam);
    }
  }, [activityTeam, activityType]);
  
  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // Calculate date range (start of month to end of month)
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      
      // Format dates for query
      const startDateStr = startOfMonth.toISOString();
      const endDateStr = endOfMonth.toISOString();
      
      // Build query
      let query = supabase
        .from('activities')
        .select(`
          id, title, location, start_time, end_time, duration, type,
          team_id, teams(name), is_repeating, repeat_type, repeat_days, repeat_until
        `)
        .gte('start_time', startDateStr)
        .lte('start_time', endDateStr);
      
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
      
      // Process data to include team name
      const processedData = data.map((activity: any) => ({
        ...activity,
        team_name: activity.teams?.name
      }));
      
      setActivities(processedData);
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
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'training':
        return 'blue';
      case 'game':
        return 'orange';
      case 'tournament':
        return 'violet';
      default:
        return 'green';
    }
  };
  
  return (
    <Container size="xl">
      <Title order={2} mb="md">Schedule Management</Title>
      
      <Paper p="md" mb="md">
        <Tabs value={activeTab} onTabChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="calendar" icon={<IconCalendarEvent size={16} />}>
              Calendar
            </Tabs.Tab>
            <Tabs.Tab value="list" icon={<IconCalendarTime size={16} />}>
              List View
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        
        <Group position="apart" mt="md">
          <Group>
            <DatePickerInput
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              label="Month"
              mx="auto"
              maw={400}
              w={200}
              valueFormat="MMMM YYYY"
              clearable={false}
            />
            
            <Select
              label="Team"
              placeholder="Select team"
              value={selectedTeam}
              onChange={setSelectedTeam}
              data={[
                { value: 'all', label: 'All Teams' },
                ...teams.map(team => ({ value: team.id, label: team.name }))
              ]}
              w={200}
            />
            
            <Select
              label="Activity Type"
              placeholder="Select type"
              value={selectedType}
              onChange={setSelectedType}
              data={[
                { value: 'all', label: 'All Types' },
                { value: 'training', label: 'Training' },
                { value: 'game', label: 'Game' },
                { value: 'tournament', label: 'Tournament' },
                { value: 'other', label: 'Other' }
              ]}
              w={200}
            />
          </Group>
          
          <Button 
            leftIcon={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            New Activity
          </Button>
        </Group>
      </Paper>
      
      {loading ? (
        <Text>Loading activities...</Text>
      ) : activities.length === 0 ? (
        <Text>No activities found for the selected criteria.</Text>
      ) : (
        <Grid>
          {activities.map(activity => (
            <Grid.Col span={4} key={activity.id}>
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group position="apart" mb="xs">
                  <Text fw={500}>{activity.title}</Text>
                  <Badge color={getActivityColor(activity.type)}>
                    {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                  </Badge>
                </Group>
                
                <Text size="sm" c="dimmed" mb="md">
                  {formatDateTime(activity.start_time)}
                </Text>
                
                <Group spacing="xs">
                  <IconMapPin size={16} />
                  <Text size="sm">{activity.location}</Text>
                </Group>
                
                <Group spacing="xs" mt="xs">
                  <IconUsers size={16} />
                  <Text size="sm">{activity.team_name}</Text>
                </Group>
                
                {activity.is_repeating && (
                  <Badge color="gray" mt="xs">Recurring</Badge>
                )}
                
                <Group position="right" mt="md">
                  <Button variant="light" color="blue" compact leftIcon={<IconEdit size={16} />}>
                    Edit
                  </Button>
                  <Button variant="light" color="red" compact leftIcon={<IconTrash size={16} />}>
                    Delete
                  </Button>
                </Group>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}
      
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