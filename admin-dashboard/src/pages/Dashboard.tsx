import React, { useState, useEffect } from 'react';
import { 
  Title, 
  SimpleGrid, 
  Paper, 
  Text, 
  Group, 
  ThemeIcon, 
  Center, 
  Loader,
  Table,
  Badge,
  RingProgress,
  Card,
  Box
} from '@mantine/core';
import { 
  IconUsers, 
  IconBuildingCommunity, 
  IconChartBar, 
  IconUserCheck
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale } from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

interface DashboardStats {
  totalClubs: number;
  totalUsers: number;
  totalPlayers: number;
  totalTeams: number;
  totalCoaches: number;
  activeClubs: number;
  suspendedClubs: number;
  attendanceRate: number;
}

interface RecentActivity {
  id: string;
  club_name: string;
  action: string;
  date: string;
  user: string;
}

interface ActivityData {
  id: string;
  club_name: string | null;
  action: string;
  created_at: string;
  user_name: string;
}

interface TopClub {
  id: string;
  name: string;
  player_count: number;
  team_count: number;
  activity_level: 'high' | 'medium' | 'low';
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topClubs, setTopClubs] = useState<TopClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // In a real app, we'd fetch this data from Supabase
      // For now, we'll use mock data
      
      // Fetch active clubs count
      const { count: activeClubsCount, error: activeClubsError } = await supabase
        .from('clubs')
        .select('*', { count: 'exact', head: true })
        .eq('is_suspended', false);
      
      if (activeClubsError) throw activeClubsError;
      
      // Fetch suspended clubs count
      const { count: suspendedClubsCount, error: suspendedClubsError } = await supabase
        .from('clubs')
        .select('*', { count: 'exact', head: true })
        .eq('is_suspended', true);
      
      if (suspendedClubsError) throw suspendedClubsError;
      
      // Fetch active players count
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (playersError) throw playersError;
      
      // Fetch active teams count
      // Fetch full team details to debug why count is wrong
      const { data: teamsData, error: teamsDataError } = await supabase
        .from('teams')
        .select('id, name, club_id, is_active')
        .eq('is_active', true);
      
      if (teamsDataError) throw teamsDataError;

      console.log('All active teams:', teamsData);
      
      // Filter teams with club_id to get accurate count
      const validTeams = teamsData?.filter(team => team.club_id !== null) || [];
      console.log('Valid teams (with club_id):', validTeams);
      console.log('Valid teams count:', validTeams.length);
      
      // Use the filtered count instead of the query count
      const teamsCount = validTeams.length;
      
      // Fetch coaches count
      const { count: coachesCount, error: coachesError } = await supabase
        .from('coaches')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (coachesError) throw coachesError;
      
      // Calculate total users (admins + coaches + parents)
      const { count: adminCount, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*', { count: 'exact', head: true });
        
      if (adminError) throw adminError;
      
      const { count: parentCount, error: parentError } = await supabase
        .from('parents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
        
      if (parentError) throw parentError;
      
      const totalUsers = (adminCount || 0) + (coachesCount || 0) + (parentCount || 0);
      
      // Set stats
      setStats({
        totalClubs: activeClubsCount || 0, // Only count active clubs in the total
        totalUsers: totalUsers,
        totalPlayers: playersCount || 0,
        totalTeams: teamsCount,
        totalCoaches: coachesCount || 0,
        activeClubs: activeClubsCount || 0,
        suspendedClubs: suspendedClubsCount || 0,
        attendanceRate: 78 // Mock data for now
      });
      
      // Fetch recent activities
      try {
        // Get recent activities using the get_recent_activities function
        const { data: activitiesData, error: activitiesError } = await supabase
          .rpc('get_recent_activities');
          
        if (activitiesError) throw activitiesError;
        
        if (activitiesData && activitiesData.length > 0) {
          // Transform data to match our interface
          const formattedActivities = activitiesData.map((activity: ActivityData) => ({
            id: activity.id,
            club_name: activity.club_name || 'System',
            action: activity.action,
            date: new Date(activity.created_at).toISOString().split('T')[0],
            user: activity.user_name
          }));
          
          setRecentActivity(formattedActivities);
        } else {
          // If no activities found, use empty array
          setRecentActivity([]);
        }
      } catch (activitiesError) {
        console.error('Error fetching recent activities:', activitiesError);
        // Use empty array as fallback
        setRecentActivity([]);
      }
      
      // Fetch top clubs data
      try {
        // Get top clubs data using the get_top_clubs function
        const { data: topClubsData, error: topClubsError } = await supabase
          .rpc('get_top_clubs');
          
        if (topClubsError) throw topClubsError;
        
        if (topClubsData && topClubsData.length > 0) {
          setTopClubs(topClubsData);
        } else {
          // If no clubs found, use empty array
          setTopClubs([]);
        }
      } catch (clubsDataError) {
        console.error('Error fetching top clubs data:', clubsDataError);
        // Use empty array as fallback
        setTopClubs([]);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Use mock data as fallback
      setStats({
        totalClubs: 3,
        totalUsers: 25,
        totalPlayers: 270,
        totalTeams: 18,
        totalCoaches: 15,
        activeClubs: 2,
        suspendedClubs: 1,
        attendanceRate: 78
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Title order={2} mb="md">Master Admin Dashboard</Title>
      
      {/* Stats Cards */}
      <SimpleGrid cols={4} spacing="md" mb="md">
        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Total Clubs
              </Text>
              <Text weight={700} size="xl">
                {stats?.totalClubs}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={38} radius="md">
              <IconBuildingCommunity size={22} />
            </ThemeIcon>
          </Group>
          <Group position="apart" mt="xs">
            <Text size="xs" color="green">
              Active: {stats?.activeClubs}
            </Text>
            <Text size="xs" color="red">
              Suspended: {stats?.suspendedClubs}
            </Text>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Total Players
              </Text>
              <Text weight={700} size="xl">
                {stats?.totalPlayers}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size={38} radius="md">
              <IconUsers size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Active players across all clubs
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Total Teams
              </Text>
              <Text weight={700} size="xl">
                {stats?.totalTeams}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={38} radius="md">
              <IconUserCheck size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Teams across all clubs
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Attendance Rate
              </Text>
              <Text weight={700} size="xl">
                {stats?.attendanceRate}%
              </Text>
            </div>
            <ThemeIcon color="violet" variant="light" size={38} radius="md">
              <IconChartBar size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Average across all clubs
          </Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={2} spacing="md">
        {/* Club Status Overview */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Club Status Overview</Text>
            </Group>
          </Card.Section>
          
          <Group position="center" py="md" style={{ height: 260, position: 'relative' }}>
            <Doughnut
              data={{
                labels: ['Active Clubs', 'Suspended Clubs'],
                datasets: [
                  {
                    label: 'Club Status',
                    data: [stats?.activeClubs || 0, stats?.suspendedClubs || 0],
                    backgroundColor: [
                      'rgba(75, 192, 112, 0.8)',
                      'rgba(255, 99, 132, 0.8)',
                    ],
                    borderColor: [
                      'rgba(75, 192, 112, 1)',
                      'rgba(255, 99, 132, 1)',
                    ],
                    borderWidth: 1,
                    hoverOffset: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                      boxWidth: 10,
                      padding: 20,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      title: (items) => items[0].label,
                      label: (item) => `${item.formattedValue} clubs (${((item.parsed / (stats?.totalClubs || 1)) * 100).toFixed(1)}%)`,
                    },
                  },
                },
                cutout: '65%',
              }}
            />
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <Text weight={700} size="xl">{stats?.totalClubs}</Text>
              <Text size="xs" color="dimmed">Total Clubs</Text>
            </div>
          </Group>
          
          <Group position="apart" mt="sm" px="md">
            <Card withBorder p="xs" radius="md" style={{ background: 'rgba(75, 192, 112, 0.1)', borderColor: 'rgba(75, 192, 112, 0.5)', width: '48%' }}>
              <Group position="apart">
                <Text size="sm" weight={600}>Active</Text>
                <Badge color="green" size="lg" radius="sm" variant="filled">
                  {stats?.activeClubs}
                </Badge>
              </Group>
            </Card>
            <Card withBorder p="xs" radius="md" style={{ background: 'rgba(255, 99, 132, 0.1)', borderColor: 'rgba(255, 99, 132, 0.5)', width: '48%' }}>
              <Group position="apart">
                <Text size="sm" weight={600}>Suspended</Text>
                <Badge color="red" size="lg" radius="sm" variant="filled">
                  {stats?.suspendedClubs}
                </Badge>
              </Group>
            </Card>
          </Group>
        </Card>
        
        {/* Top Clubs */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Top Clubs by Player Count</Text>
            </Group>
          </Card.Section>
          
          <Table>
            <thead>
              <tr>
                <th>Club Name</th>
                <th>Players</th>
                <th>Teams</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {topClubs.map((club) => (
                <tr key={club.id}>
                  <td>{club.name}</td>
                  <td>{club.player_count}</td>
                  <td>{club.team_count}</td>
                  <td>
                    <Badge 
                      color={
                        club.activity_level === 'high' ? 'green' : 
                        club.activity_level === 'medium' ? 'blue' : 'gray'
                      }
                    >
                      {club.activity_level}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </SimpleGrid>
      
      {/* Recent Activity */}
      <Paper withBorder p="md" radius="md" mt="md">
        <Title order={4} mb="md">Recent Activity</Title>
        <Table>
          <thead>
            <tr>
              <th>Club</th>
              <th>Action</th>
              <th>User</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((activity) => (
              <tr key={activity.id}>
                <td>{activity.club_name}</td>
                <td>{activity.action}</td>
                <td>{activity.user}</td>
                <td>{activity.date}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Paper>
    </>
  );
};

export default Dashboard; 