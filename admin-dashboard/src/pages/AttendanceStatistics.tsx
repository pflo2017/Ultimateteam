import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Select,
  Grid,
  Card,
  SimpleGrid,
  RingProgress,
  ThemeIcon,
  Box,
  Divider,
  Tabs,
  Table,
  Badge,
  Center,
  Loader
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconUserCheck,
  IconUserX,
  IconUsers,
  IconCalendarStats,
  IconChartBar,
  IconCalendarTime,
  IconTrophy,
  IconActivity,
  IconCertificate
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { getClubAdminClubId } from '../lib/supabase';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title as ChartTitle, Filler } from 'chart.js';
import { eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement,
  ChartTitle,
  Filler
);

interface AttendanceStats {
  activity_id: string;
  activity_title: string;
  activity_type: string;
  activity_date: string;
  team_id: string;
  team_name: string;
  present_count: number;
  absent_count: number;
  total_players: number;
  attendance_percentage: number;
}

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  name: string;
  team_id: string;
  attendance_rate?: number;
  present_count?: number;
  absent_count?: number;
}

interface ActivityType {
  value: string;
  label: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  attendanceRate: number;
  trendData: Array<{
    date: string;
    rate: number;
  }>;
}

interface TeamAttendanceSummary {
  team_id: string;
  team_name: string;
  total_attendance: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface PlayerAttendanceSummary {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  total_attendance: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface MonthlyTrendData {
  month: string;
  present: number;
  absent: number;
  total: number;
}

interface AttendanceData {
  totalAttendance: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  teamStats: TeamAttendanceSummary[];
  playerStats: PlayerAttendanceSummary[];
  activityTypeStats: {[key: string]: number};
  monthlyTrends: MonthlyTrendData[];
}

// Chart colors
const chartColors = {
  blue: '#228be6',
  green: '#40c057',
  orange: '#fd7e14',
  red: '#fa5252',
  violet: '#7950f2',
  cyan: '#15aabf',
  pink: '#e64980',
  yellow: '#fcc419',
  gray: '#adb5bd'
};

const generateRecurringInstances = (
  activity: any, // Use your Activity type if available
  dateRange: [Date | null, Date | null]
): any[] => {
  // Only generate for recurring activities (if you have a flag, use it; otherwise, generate for all)
  const start = dateRange[0];
  const end = dateRange[1];
  if (!start || !end) return [];
  const days = eachDayOfInterval({ start, end });
  return days.map(day => {
    // Compose composite ID: UUID-YYYYMMDD
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const compositeId = `${activity.id}-${datePart}`;
    // Set the start_time to this day, but keep the time from base activity
    const baseStart = new Date(activity.start_time);
    const instanceDate = new Date(day);
    instanceDate.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds());
    return {
      ...activity,
      id: compositeId,
      start_time: instanceDate.toISOString(),
      is_recurring_instance: true,
      base_activity_id: activity.id,
      composite_date: datePart
    };
  });
};

const AttendanceStatistics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [selectedTeam, setSelectedTeam] = useState<string | null>('all');
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().setMonth(new Date().getMonth() - 6)),
    new Date()
  ]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  
  // Statistics state
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  
  // Activity types
  const activityTypes: ActivityType[] = [
    { value: 'all', label: 'All Types' },
    { value: 'training', label: 'Training' },
    { value: 'game', label: 'Game' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'other', label: 'Other' }
  ];

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Format dates for filtering
      const startDate = dateRange[0] ? dateRange[0].toISOString() : undefined;
      const endDate = dateRange[1] ? dateRange[1].toISOString() : undefined;

      console.log('Fetching attendance data with filters:', {
        startDate,
        endDate,
        selectedTeam,
        selectedActivityType,
        clubId
      });

      // Step 1: Fetch all activities for the club (for enrichment)
      let activitiesQuery = supabase
        .from('activities')
        .select('id, title, type, start_time, team_id')
        .eq('club_id', clubId);

      const { data: activities, error: activitiesError } = await activitiesQuery;
      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
        setError('Failed to fetch activities');
        setLoading(false);
        return;
      }
      console.log('DASHBOARD RAW ACTIVITIES:', activities);

      // Step 2: Fetch ALL attendance records for the club and date range
      let attendanceQuery = supabase
        .from('activity_attendance')
        .select('*, player:player_id (id, name)')
        .eq('club_id', clubId);

      if (startDate) attendanceQuery = attendanceQuery.gte('actual_activity_date', startDate);
      if (endDate) attendanceQuery = attendanceQuery.lte('actual_activity_date', endDate);

      const { data: attendanceRecords, error: attendanceError } = await attendanceQuery;
      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        setError('Failed to fetch attendance');
        setLoading(false);
        return;
      }
      console.log('DASHBOARD RAW ATTENDANCE:', attendanceRecords);

      // Step 3: Fetch teams for enrichment
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId);
      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        setError('Failed to fetch teams');
        setLoading(false);
        return;
      }

      // Step 4: Process the data following mobile app pattern, applying team/type filters after reconstructing activities
      const result = processAttendanceData(
        activities,
        attendanceRecords || [],
        teamsData || [],
        selectedTeam,
        selectedActivityType
      );
      setAttendanceData(result);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }, [dateRange, selectedTeam, selectedActivityType, clubId]);

  useEffect(() => {
    const fetchClubData = async () => {
      try {
        setLoading(true);
        
        // Get the club ID for the logged-in club admin
        const id = await getClubAdminClubId();
        setClubId(id);
        
        if (id) {
          // Fetch teams for this club
          const { data: clubTeamsData, error: clubTeamsError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('club_id', id)
            .eq('is_active', true)
            .order('name');
            
          if (clubTeamsError) throw clubTeamsError;
          
          if (clubTeamsData) {
            setTeams(clubTeamsData);
            
            // If there's only one team, select it by default
            if (clubTeamsData.length === 1) {
              setSelectedTeam(clubTeamsData[0].id);
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
  
  useEffect(() => {
    if (clubId) {
      fetchAttendanceData();
    }
  }, [clubId, fetchAttendanceData]);
  
  const processAttendanceData = (
    activities: any[] = [],
    attendanceRecords: any[] = [],
    teams: any[] = [],
    selectedTeam?: string | null,
    selectedActivityType?: string | null
  ) => {
    // Build team map
    const teamMap = new Map<string, string>();
    teams.forEach(team => teamMap.set(team.id, team.name));
    // Build activity map for quick lookup
    const activityMap = new Map<string, any>();
    activities.forEach(activity => {
      activityMap.set(activity.id, activity);
    });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let totalAttendance = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    const teamStatsMap = new Map<string, TeamAttendanceSummary>();
    const playerStatsMap = new Map<string, PlayerAttendanceSummary>();
    const activityTypeStats: {[key: string]: number} = {};
    const monthlyTrendsData: {[key: string]: MonthlyTrendData} = {};

    // Generate all possible recurring instances for the date range and team
    let allInstances: any[] = [];
    activities.forEach(activity => {
      // Only include activities for the selected team
      if (selectedTeam && selectedTeam !== 'all' && activity.team_id !== selectedTeam) return;
      // Only include activities for the selected type
      if (selectedActivityType && selectedActivityType !== 'all' && activity.type !== selectedActivityType) return;
      // Generate recurring instances for the date range
      allInstances = allInstances.concat(generateRecurringInstances(activity, dateRange));
    });
    // Also include base activities (for non-recurring or single-instance activities)
    allInstances = allInstances.concat(activities);
    // Build a map of all possible activity instances by ID
    const instanceMap = new Map<string, any>();
    allInstances.forEach(instance => {
      instanceMap.set(instance.id, instance);
    });

    attendanceRecords.forEach(record => {
      // Match attendance to the correct activity instance
      let activity = instanceMap.get(record.activity_id);
      if (!activity && record.activity_id && record.activity_id.includes('-')) {
        // Try to match base activity if composite not found
        const baseActivityId = record.activity_id.split('-')[0];
        activity = activityMap.get(baseActivityId);
      }
      if (!activity) {
        // Skip if we can't reconstruct
        return;
      }
      const teamId = activity.team_id;
      const teamName = teamMap.get(teamId) || 'Unknown Team';
      const activityType = activity.type || 'unknown';
      const activityDate = activity.start_time;
      // Apply team/type filters in-memory, after reconstructing the activity
      if (selectedTeam && selectedTeam !== 'all' && teamId !== selectedTeam) return;
      if (selectedActivityType && selectedActivityType !== 'all' && activityType !== selectedActivityType) return;
      const playerId = record.player_id;
      const playerName = record.player?.name || `Player ${playerId.substring(0, 8)}`;
      const status = record.status;
      // Player stats
      if (!playerStatsMap.has(playerId)) {
        playerStatsMap.set(playerId, {
          player_id: playerId,
          player_name: playerName,
          team_id: teamId,
          team_name: teamName,
          total_attendance: 0,
          present_count: 0,
          absent_count: 0,
          attendance_rate: 0
        });
      }
      const playerStats = playerStatsMap.get(playerId)!;
      playerStats.total_attendance++;
      if (status === 'present') {
        playerStats.present_count++;
        totalPresent++;
      } else if (status === 'absent') {
        playerStats.absent_count++;
        totalAbsent++;
      }
      // Team stats
      if (!teamStatsMap.has(teamId)) {
        teamStatsMap.set(teamId, {
          team_id: teamId,
          team_name: teamName,
          total_attendance: 0,
          present_count: 0,
          absent_count: 0,
          attendance_rate: 0
        });
      }
      const teamStats = teamStatsMap.get(teamId)!;
      teamStats.total_attendance++;
      if (status === 'present') {
        teamStats.present_count++;
      } else if (status === 'absent') {
        teamStats.absent_count++;
      }
      // Activity type stats
      activityTypeStats[activityType] = (activityTypeStats[activityType] || 0) + 1;
      // Monthly trends
      if (activityDate) {
        const date = new Date(activityDate);
        const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
        if (!monthlyTrendsData[monthKey]) {
          monthlyTrendsData[monthKey] = {
            month: monthKey,
            present: 0,
            absent: 0,
            total: 0
          };
        }
        monthlyTrendsData[monthKey].total++;
        if (status === 'present') {
          monthlyTrendsData[monthKey].present++;
        } else if (status === 'absent') {
          monthlyTrendsData[monthKey].absent++;
        }
      }
      totalAttendance++;
    });
    // Calculate attendance rates
    playerStatsMap.forEach(player => {
      if (player.total_attendance > 0) {
        player.attendance_rate = (player.present_count / player.total_attendance) * 100;
      }
    });
    teamStatsMap.forEach(team => {
      if (team.total_attendance > 0) {
        team.attendance_rate = (team.present_count / team.total_attendance) * 100;
      }
    });
    // Convert maps to arrays
    const teamStats = Array.from(teamStatsMap.values());
    const playerStats = Array.from(playerStatsMap.values());
    teamStats.sort((a, b) => b.attendance_rate - a.attendance_rate);
    playerStats.sort((a, b) => b.attendance_rate - a.attendance_rate);
    const monthlyTrends = Object.values(monthlyTrendsData);
    monthlyTrends.sort((a, b) => {
      const [aMonth, aYear] = a.month.split(' ');
      const [bMonth, bYear] = b.month.split(' ');
      if (aYear !== bYear) {
        return parseInt(aYear) - parseInt(bYear);
      }
      return months.indexOf(aMonth) - months.indexOf(bMonth);
    });
    return {
      totalAttendance,
      totalPresent,
      totalAbsent,
      attendanceRate: totalAttendance > 0 ? (totalPresent / totalAttendance) * 100 : 0,
      teamStats,
      playerStats,
      activityTypeStats,
      monthlyTrends
    };
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
  
  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 80) return 'green';
    if (rate >= 60) return 'yellow';
    return 'red';
  };

  return (
    <Container size="xl">
      <Title order={2} mb="md">Attendance Statistics</Title>
      
      <Paper p="md" mb="md" radius="md" withBorder>
        <Group position="apart" mb="md">
          <Group>
            <Select
              label="Team"
              value={selectedTeam}
              onChange={setSelectedTeam}
              data={[
                { value: 'all', label: 'All Teams' },
                ...teams.map(team => ({ value: team.id, label: team.name }))
              ]}
              style={{ width: 200 }}
            />
            
            <Select
              label="Activity Type"
              value={selectedActivityType}
              onChange={setSelectedActivityType}
              data={activityTypes}
              style={{ width: 150 }}
            />
          </Group>
          
          <DatePickerInput
            type="range"
            label="Date range"
            value={dateRange}
            onChange={setDateRange}
            style={{ width: 300 }}
          />
        </Group>
        
        <Tabs value={activeTab} onTabChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" icon={<IconChartBar size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="teams" icon={<IconUsers size={16} />}>
              Teams
            </Tabs.Tab>
            <Tabs.Tab value="players" icon={<IconUserCheck size={16} />}>
              Players
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>
      
      {loading ? (
        <Center mt="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <SimpleGrid cols={3} spacing="md" mb="md">
                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Attendance Rate
                      </Text>
                      <Text weight={700} size="xl">
                        {attendanceData?.attendanceRate.toFixed(1) || 0}%
                      </Text>
                    </div>
                    <ThemeIcon color="green" variant="light" size={38} radius="md">
                      <IconUserCheck size={22} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" color="dimmed" mt="xs">
                    Overall attendance rate
                  </Text>
                </Paper>
                
                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Present
                      </Text>
                      <Text weight={700} size="xl">
                        {attendanceData?.totalPresent || 0}
                      </Text>
                    </div>
                    <ThemeIcon color="blue" variant="light" size={38} radius="md">
                      <IconUserCheck size={22} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" color="dimmed" mt="xs">
                    Total presences
                  </Text>
                </Paper>
                
                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Absent
                      </Text>
                      <Text weight={700} size="xl">
                        {attendanceData?.totalAbsent || 0}
                      </Text>
                    </div>
                    <ThemeIcon color="red" variant="light" size={38} radius="md">
                      <IconUserX size={22} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" color="dimmed" mt="xs">
                    Total absences
                  </Text>
                </Paper>
              </SimpleGrid>
              
              <SimpleGrid cols={2} spacing="md" mb="md">
                {/* Attendance Trend */}
                <Card withBorder p="md" radius="md">
                  <Card.Section withBorder inheritPadding py="xs">
                    <Group position="apart">
                      <Text weight={500}>Attendance Trend</Text>
                    </Group>
                  </Card.Section>
                  
                  <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
                    {attendanceData?.monthlyTrends && attendanceData.monthlyTrends.length > 0 ? (
                      <Line
                        data={{
                          labels: attendanceData.monthlyTrends.map(trend => trend.month),
                          datasets: [
                            {
                              label: 'Attendance Rate (%)',
                              data: attendanceData.monthlyTrends.map(trend => {
                                return trend.total > 0 ? Math.round((trend.present / trend.total) * 100) : 0;
                              }),
                              borderColor: chartColors.blue,
                              backgroundColor: `${chartColors.blue}33`,
                              fill: true,
                              tension: 0.4,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                            },
                            tooltip: {
                              mode: 'index',
                              intersect: false,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                              title: {
                                display: true,
                                text: 'Attendance Rate (%)',
                              },
                            },
                          },
                        }}
                      />
                    ) : (
                      <Center style={{ height: '100%' }}>
                        <Text color="dimmed">No attendance data available</Text>
                      </Center>
                    )}
                  </div>
                </Card>
                
                {/* Activity Distribution */}
                <Card withBorder p="md" radius="md">
                  <Card.Section withBorder inheritPadding py="xs">
                    <Group position="apart">
                      <Text weight={500}>Activity Distribution</Text>
                    </Group>
                  </Card.Section>
                  
                  <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
                    {attendanceData?.activityTypeStats && Object.keys(attendanceData.activityTypeStats).length > 0 ? (
                      <Doughnut
                        data={{
                          labels: Object.keys(attendanceData.activityTypeStats).map(
                            type => type.charAt(0).toUpperCase() + type.slice(1)
                          ),
                          datasets: [
                            {
                              data: Object.values(attendanceData.activityTypeStats),
                              backgroundColor: [
                                chartColors.blue,
                                chartColors.orange,
                                chartColors.violet,
                                chartColors.green,
                                chartColors.cyan,
                              ],
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'right',
                            },
                          },
                        }}
                      />
                    ) : (
                      <Center style={{ height: '100%' }}>
                        <Text color="dimmed">No activity data available</Text>
                      </Center>
                    )}
                  </div>
                </Card>
              </SimpleGrid>
            </>
          )}
          
          {activeTab === 'teams' && (
            <Card withBorder p="md" radius="md" mb="md">
              <Card.Section withBorder inheritPadding py="xs">
                <Group position="apart">
                  <Text weight={500}>Team Attendance</Text>
                </Group>
              </Card.Section>
              
              <Table striped highlightOnHover mt="md">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData?.teamStats && attendanceData.teamStats.length > 0 ? (
                    attendanceData.teamStats.map((team) => (
                      <tr key={team.team_id}>
                        <td>{team.team_name}</td>
                        <td>{team.present_count}</td>
                        <td>{team.absent_count}</td>
                        <td>
                          <Group spacing="xs">
                            <RingProgress
                              size={24}
                              thickness={3}
                              sections={[{ value: team.attendance_rate, color: getAttendanceRateColor(team.attendance_rate) }]}
                            />
                            <Text>{team.attendance_rate.toFixed(1)}%</Text>
                          </Group>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        <Text align="center" color="dimmed">No team attendance data available</Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          )}
          
          {activeTab === 'players' && (
            <Card withBorder p="md" radius="md" mb="md">
              <Card.Section withBorder inheritPadding py="xs">
                <Group position="apart">
                  <Text weight={500}>Player Attendance</Text>
                </Group>
              </Card.Section>
              
              <Table striped highlightOnHover mt="md">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Total Activities</th>
                    <th>Attendance Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData?.playerStats && attendanceData.playerStats.length > 0 ? (
                    attendanceData.playerStats.map((player) => (
                      <tr key={player.player_id}>
                        <td>{player.player_name}</td>
                        <td>{player.team_name}</td>
                        <td>{player.present_count}</td>
                        <td>{player.absent_count}</td>
                        <td>{player.total_attendance}</td>
                        <td>
                          <Group spacing="xs">
                            <RingProgress
                              size={24}
                              thickness={3}
                              sections={[{ value: player.attendance_rate, color: getAttendanceRateColor(player.attendance_rate) }]}
                            />
                            <Text>{player.attendance_rate.toFixed(1)}%</Text>
                          </Group>
                        </td>
                        <td>
                          {player.attendance_rate >= 80 ? (
                            <Badge color="green">Good</Badge>
                          ) : player.attendance_rate >= 60 ? (
                            <Badge color="yellow">Average</Badge>
                          ) : player.total_attendance > 0 ? (
                            <Badge color="red">Poor</Badge>
                          ) : (
                            <Badge color="gray">No data</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <Text align="center" color="dimmed">No player attendance data available</Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Container>
  );
};

export default AttendanceStatistics; 