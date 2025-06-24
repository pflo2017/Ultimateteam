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
  const [overallStats, setOverallStats] = useState<AttendanceSummary | null>(null);
  const [teamStats, setTeamStats] = useState<TeamAttendanceSummary[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerAttendanceSummary[]>([]);
  const [activityTypeStats, setActivityTypeStats] = useState<{[key: string]: number}>({});
  const [monthlyTrendsData, setMonthlyTrendsData] = useState<{[key: string]: MonthlyTrendData}>({});
  
  // Activity types
  const activityTypes: ActivityType[] = [
    { value: 'all', label: 'All Types' },
    { value: 'training', label: 'Training' },
    { value: 'game', label: 'Game' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'other', label: 'Other' }
  ];

  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Format dates properly for API calls
      const startDate = dateRange[0] ? dateRange[0].toISOString() : undefined;
      const endDate = dateRange[1] ? dateRange[1].toISOString() : undefined;
      
      // Fetch activities for the selected team or all teams in the club
      let activitiesQuery = supabase
        .from('activities')
        .select('id, title, type, start_time, team_id, teams(name)')
        .eq('club_id', clubId)
        .order('start_time', { ascending: false });
      
      // Add date range filters only if dates are defined
      if (startDate) {
        activitiesQuery = activitiesQuery.gte('start_time', startDate);
      }
      
      if (endDate) {
        activitiesQuery = activitiesQuery.lte('start_time', endDate);
      }
      
      // Add team filter if a team is selected
      if (selectedTeam) {
        activitiesQuery = activitiesQuery.eq('team_id', selectedTeam);
      }
      
      const { data: activities, error: activitiesError } = await activitiesQuery;
      
      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
        setError('Failed to fetch activities');
        setLoading(false);
        return;
      }
      
      // Fetch all players for the club or specific team
      let playersQuery = supabase
        .from('players')
        .select('id, first_name, last_name, team_id, teams(name)')
        .eq('club_id', clubId);
      
      if (selectedTeam) {
        playersQuery = playersQuery.eq('team_id', selectedTeam);
      }
      
      const { data: players, error: playersError } = await playersQuery;
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        setError('Failed to fetch players');
        setLoading(false);
        return;
      }
      
      // Get ALL attendance records for the club without filtering
      // We'll filter them client-side to handle date mismatches
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_with_correct_dates')
        .select('*')
        .eq('club_id', clubId);
      
      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        setError('Failed to fetch attendance');
        setLoading(false);
        return;
      }

      // Log data for debugging
      console.log(`Fetched ${activities?.length || 0} activities and ${attendanceRecords?.length || 0} attendance records`);
      
      if (activities && activities.length > 0) {
        // Log sample activity IDs for debugging
        const activityIds = activities.slice(0, 3).map(a => a.id).join(', ');
        console.log(`Activity IDs: ${activityIds}...`);
        
        // Extract base IDs for debugging
        const baseIds = activities.slice(0, 3).map(a => {
          const baseId = a.id.includes('-') ? a.id.split('-')[0] : a.id;
          return baseId.substring(0, 8);
        }).join(', ');
        console.log(`Base IDs: ${baseIds}...`);
      }
      
      if (attendanceRecords && attendanceRecords.length > 0) {
        // Log sample attendance record for debugging
        console.log(`Sample attendance record: ${JSON.stringify(attendanceRecords[0])}`);
      }
      
      // Process the data
      if (activities && players && attendanceRecords) {
        const result = processAttendanceData(activities, players, attendanceRecords);
        setAttendanceData(result);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }, [clubId, dateRange, selectedTeam, supabase]);

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
  
  const processAttendanceData = (activities: any[], players: any[], attendanceRecords: any[]) => {
    // Initialize counters
    let totalAttendance = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    
    // Create maps for team and player stats
    const teamStatsMap = new Map<string, TeamAttendanceSummary>();
    const playerStatsMap = new Map<string, PlayerAttendanceSummary>();
    
    // Initialize activity type stats
    const activityTypeStats: {[key: string]: number} = {};
    
    // Initialize monthly trends
    const monthlyTrendsData: {[key: string]: MonthlyTrendData} = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize team stats for all teams
    const teamMap = new Map<string, string>();
    players.forEach(player => {
      const teamId = player.team_id;
      const teamName = player.teams?.name || 'Unknown Team';
      
      teamMap.set(teamId, teamName);
      
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
    });
    
    // Initialize player stats for all players
    players.forEach(player => {
      const playerId = player.id;
      const playerName = `${player.first_name} ${player.last_name}`;
      const teamId = player.team_id;
      const teamName = player.teams?.name || 'Unknown Team';
      
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
    });
    
    // Create a map of activity IDs to their details for efficient lookup
    // This will help us handle both regular and composite IDs
    const activityMap = new Map<string, any>();
    activities.forEach(activity => {
      // Store the full activity object with both the full ID and the base ID
      activityMap.set(activity.id, activity);
      
      // If it's a composite ID, also store it by the base ID for easier lookup
      if (activity.id.includes('-')) {
        const baseId = activity.id.split('-')[0];
        // Only store if not already present (prioritize non-composite IDs)
        if (!activityMap.has(baseId)) {
          activityMap.set(baseId, activity);
        }
      }
    });
    
    console.log(`Created activity map with ${activityMap.size} entries`);
    
    // Create a map of player attendance by activity
    // Structure: Map<playerId, Map<activityBaseId, status>>
    const playerActivityMap = new Map<string, Map<string, string>>();

    // Process all attendance records first
    attendanceRecords.forEach(record => {
      const playerId = record.player_id;
      const recordActivityId = record.activity_id;
      const status = record.status;
      const actualDate = record.actual_activity_date;
      
      // Skip if player not in our filtered set
      if (!playerStatsMap.has(playerId)) {
        return;
      }
      
      // Get the base activity ID (without date suffix if present)
      const baseActivityId = recordActivityId.includes('-') 
        ? recordActivityId.split('-')[0] 
        : recordActivityId;
      
      // Initialize player's activity map if needed
      if (!playerActivityMap.has(playerId)) {
        playerActivityMap.set(playerId, new Map<string, string>());
      }
      
      // Store attendance status by base activity ID
      const playerActivities = playerActivityMap.get(playerId)!;
      playerActivities.set(baseActivityId, status);
      
      // Update player statistics
      const playerStats = playerStatsMap.get(playerId)!;
      playerStats.total_attendance++;
      
      if (status === 'present') {
        playerStats.present_count++;
        totalPresent++;
      } else if (status === 'absent') {
        playerStats.absent_count++;
        totalAbsent++;
      }
      
      // Update team statistics
      const teamId = playerStats.team_id;
      if (teamStatsMap.has(teamId)) {
        const teamStats = teamStatsMap.get(teamId)!;
        teamStats.total_attendance++;
        
        if (status === 'present') {
          teamStats.present_count++;
        } else if (status === 'absent') {
          teamStats.absent_count++;
        }
      }
      
      totalAttendance++;
      
      // Update activity type stats if available
      const activityType = record.activity_type || 'unknown';
      activityTypeStats[activityType] = (activityTypeStats[activityType] || 0) + 1;
      
      // Update monthly trends based on actual_activity_date
      if (actualDate) {
        const date = new Date(actualDate);
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
    });
    
    // Calculate attendance rates for players
    playerStatsMap.forEach(player => {
      if (player.total_attendance > 0) {
        player.attendance_rate = (player.present_count / player.total_attendance) * 100;
      }
    });
    
    // Calculate attendance rates for teams
    teamStatsMap.forEach(team => {
      if (team.total_attendance > 0) {
        team.attendance_rate = (team.present_count / team.total_attendance) * 100;
      }
    });
    
    // Convert maps to arrays for easier rendering
    const teamStats = Array.from(teamStatsMap.values());
    const playerStats = Array.from(playerStatsMap.values());
    
    // Sort teams by attendance rate (descending)
    teamStats.sort((a, b) => b.attendance_rate - a.attendance_rate);
    
    // Sort players by attendance rate (descending)
    playerStats.sort((a, b) => b.attendance_rate - a.attendance_rate);
    
    // Convert monthly trends to array and sort by date
    const monthlyTrends = Object.values(monthlyTrendsData);
    monthlyTrends.sort((a, b) => {
      const [aMonth, aYear] = a.month.split(' ');
      const [bMonth, bYear] = b.month.split(' ');
      
      if (aYear !== bYear) {
        return parseInt(aYear) - parseInt(bYear);
      }
      
      return months.indexOf(aMonth) - months.indexOf(bMonth);
    });
    
    // Log player statistics for debugging
    console.log('Player statistics:');
    playerStats.slice(0, 10).forEach(player => {
      console.log(`Player ${player.player_name}: ${player.present_count} present, ${player.absent_count} absent, ${player.total_attendance} total, ${player.attendance_rate.toFixed(0)}%`);
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
                        {overallStats?.attendanceRate || 0}%
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
                        {overallStats?.present || 0}
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
                        {overallStats?.absent || 0}
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
                    {Object.keys(monthlyTrendsData).length > 0 ? (
                      <Line
                        data={{
                          labels: Object.keys(monthlyTrendsData),
                          datasets: [
                            {
                              label: 'Attendance Rate (%)',
                              data: Object.entries(monthlyTrendsData).map(([_, data]) => {
                                return data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
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
                    {Object.keys(activityTypeStats).length > 0 ? (
                      <Doughnut
                        data={{
                          labels: Object.keys(activityTypeStats).map(
                            type => type.charAt(0).toUpperCase() + type.slice(1)
                          ),
                          datasets: [
                            {
                              data: Object.values(activityTypeStats),
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
                  {teamStats.length > 0 ? (
                    teamStats.map((team) => (
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
                            <Text>{team.attendance_rate}%</Text>
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
                  {playerStats.length > 0 ? (
                    playerStats.map((player) => (
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
                            <Text>{player.attendance_rate.toFixed(0)}%</Text>
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