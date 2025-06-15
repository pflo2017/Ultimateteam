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
  Card
} from '@mantine/core';
import { 
  IconUsers, 
  IconBuildingCommunity, 
  IconCalendarEvent, 
  IconChartBar, 
  IconUserCheck,
  IconAlertTriangle
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

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
      
      // Fetch clubs count
      const { count: clubsCount, error: clubsError } = await supabase
        .from('clubs')
        .select('*', { count: 'exact', head: true });
      
      if (clubsError) throw clubsError;
      
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
      
      // Fetch players count
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });
      
      if (playersError) throw playersError;
      
      // Fetch teams count
      const { count: teamsCount, error: teamsError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
      
      if (teamsError) throw teamsError;
      
      // Fetch coaches count
      const { count: coachesCount, error: coachesError } = await supabase
        .from('coaches')
        .select('*', { count: 'exact', head: true });
      
      if (coachesError) throw coachesError;
      
      // Calculate total users (admins + coaches + parents)
      const { count: adminCount, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*', { count: 'exact', head: true });
        
      if (adminError) throw adminError;
      
      const { count: parentCount, error: parentError } = await supabase
        .from('parents')
        .select('*', { count: 'exact', head: true });
        
      if (parentError) throw parentError;
      
      const totalUsers = (adminCount || 0) + (coachesCount || 0) + (parentCount || 0);
      
      // Set stats
      setStats({
        totalClubs: clubsCount || 0,
        totalUsers: totalUsers,
        totalPlayers: playersCount || 0,
        totalTeams: teamsCount || 0,
        totalCoaches: coachesCount || 0,
        activeClubs: activeClubsCount || 0,
        suspendedClubs: suspendedClubsCount || 0,
        attendanceRate: 78 // Mock data for now
      });
      
      // Mock recent activity
      setRecentActivity([
        { id: '1', club_name: 'FC Barcelona Academy', action: 'New player registered', date: '2023-06-14', user: 'Carlos Rodriguez' },
        { id: '2', club_name: 'Liverpool Youth', action: 'New team created', date: '2023-06-13', user: 'James Wilson' },
        { id: '3', club_name: 'Ajax Academy', action: 'Club suspended', date: '2023-06-12', user: 'Master Admin' },
        { id: '4', club_name: 'FC Barcelona Academy', action: 'New coach added', date: '2023-06-11', user: 'Carlos Rodriguez' },
        { id: '5', club_name: 'Liverpool Youth', action: 'Payment received', date: '2023-06-10', user: 'System' }
      ]);
      
      // Mock top clubs
      setTopClubs([
        { id: '1', name: 'FC Barcelona Academy', player_count: 120, team_count: 8, activity_level: 'high' },
        { id: '2', name: 'Liverpool Youth', player_count: 85, team_count: 6, activity_level: 'medium' },
        { id: '3', name: 'Ajax Academy', player_count: 65, team_count: 4, activity_level: 'low' }
      ]);
      
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
          
          <Group position="center" py="md">
            <RingProgress
              size={160}
              thickness={16}
              roundCaps
              sections={[
                { value: (stats?.activeClubs || 0) / (stats?.totalClubs || 1) * 100, color: 'green' },
                { value: (stats?.suspendedClubs || 0) / (stats?.totalClubs || 1) * 100, color: 'red' }
              ]}
              label={
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" color="dimmed">Active vs Suspended</Text>
                  <Text weight={700} size="lg">{stats?.totalClubs}</Text>
                  <Text size="xs" color="dimmed">Total Clubs</Text>
                </div>
              }
            />
          </Group>
          
          <Group position="apart" px="md">
            <div>
              <Group>
                <div style={{ width: 12, height: 12, backgroundColor: 'green', borderRadius: '50%' }} />
                <Text size="sm">Active Clubs: {stats?.activeClubs}</Text>
              </Group>
            </div>
            <div>
              <Group>
                <div style={{ width: 12, height: 12, backgroundColor: 'red', borderRadius: '50%' }} />
                <Text size="sm">Suspended Clubs: {stats?.suspendedClubs}</Text>
              </Group>
            </div>
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