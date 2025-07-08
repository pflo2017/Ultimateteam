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
import { useNavigate } from 'react-router-dom';

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
  currentMonthPaid: number;
  currentMonthUnpaid: number;
  paymentRate: number;
  revenueThisMonth: number;
  overduePayments: number;
  newPlayersThisMonth: number;
  medicalVisaValid: number;
  medicalVisaExpired: number;
  medicalVisaPending: number;
  paymentRemindersSent: number;
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

interface PaymentReminder {
  id: string;
  player_name: string;
  parent_name: string;
  sent_date: string;
  status: 'sent' | 'pending';
}

interface NewPlayer {
  id: string;
  name: string;
  team_name: string;
  join_date: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [topClubs, setTopClubs] = useState<TopClub[]>([]);
  const [paymentReminders, setPaymentReminders] = useState<PaymentReminder[]>([]);
  const [newPlayers, setNewPlayers] = useState<NewPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user role and club ID from localStorage
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    
    if (role === 'clubAdmin') {
      setClubId(localStorage.getItem('clubId'));
      setClubName(localStorage.getItem('clubName'));
    }
    
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const role = localStorage.getItem('userRole');
      const clubId = localStorage.getItem('clubId');
      
      if (role === 'clubAdmin' && clubId) {
        // Club admin view - fetch data only for this club
        await fetchClubAdminData(clubId);
      } else {
        // Master admin view - fetch data for all clubs
        await fetchMasterAdminData();
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Use mock data as fallback
      setStats({
        totalClubs: 1,
        totalUsers: 10,
        totalPlayers: 50,
        totalTeams: 3,
        totalCoaches: 5,
        activeClubs: 1,
        suspendedClubs: 0,
        attendanceRate: 78,
        currentMonthPaid: 0,
        currentMonthUnpaid: 0,
        paymentRate: 0,
        revenueThisMonth: 0,
        overduePayments: 0,
        newPlayersThisMonth: 0,
        medicalVisaValid: 0,
        medicalVisaExpired: 0,
        medicalVisaPending: 0,
        paymentRemindersSent: 0
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClubAdminData = async (clubId: string) => {
    try {
      // Fetch players count for this club
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('club_id', clubId);
      
      if (playersError) throw playersError;
      
      // Fetch teams count for this club
      const { data: teamsData, error: teamsDataError } = await supabase
        .from('teams')
        .select('id, name, club_id, is_active')
        .eq('is_active', true)
        .eq('club_id', clubId);
      
      if (teamsDataError) throw teamsDataError;
      
      const teamsCount = teamsData?.length || 0;
      
      // Fetch coaches count for this club
      const { count: coachesCount, error: coachesError } = await supabase
        .from('coaches')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('club_id', clubId);
      
      if (coachesError) throw coachesError;
      
      // Fetch attendance rate for this club (mock data for now)
      const attendanceRate = 82; // We would calculate this from actual attendance records
      
      // Set stats for club admin view
      setStats({
        totalClubs: 1, // Club admin only manages one club
        totalUsers: coachesCount || 0, // Only count coaches as users for club admin
        totalPlayers: playersCount || 0,
        totalTeams: teamsCount,
        totalCoaches: coachesCount || 0,
        activeClubs: 1,
        suspendedClubs: 0,
        attendanceRate: attendanceRate,
        currentMonthPaid: 0,
        currentMonthUnpaid: 0,
        paymentRate: 0,
        revenueThisMonth: 0,
        overduePayments: 0,
        newPlayersThisMonth: 0,
        medicalVisaValid: 0,
        medicalVisaExpired: 0,
        medicalVisaPending: 0,
        paymentRemindersSent: 0
      });
      
      // Fetch financial overview data
      try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        // Get all active players for the club
        const { data: playerIdsData, error: playerIdsError } = await supabase
          .from('players')
          .select('id')
          .eq('club_id', clubId)
          .eq('is_active', true);
        if (!playerIdsError && playerIdsData) {
          const playerIds = playerIdsData.map(p => p.id);
          // Get all monthly_payments for these players for the current month
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('monthly_payments')
            .select('player_id, status')
            .eq('year', currentYear)
            .eq('month', currentMonth)
            .in('player_id', playerIds);
          // Map player_id to payment record
          const paymentMap: Record<string, any> = {};
          if (paymentsData) {
            paymentsData.forEach((payment: any) => {
              paymentMap[payment.player_id] = payment;
            });
          }
          // For each player, check if they have a payment record
          let paidCount = 0;
          let unpaidCount = 0;
          playerIds.forEach((id: string) => {
            if (paymentMap[id] && paymentMap[id].status === 'paid') {
              paidCount++;
            } else {
              unpaidCount++;
            }
          });
          const paymentRate = playerIds.length > 0 ? (paidCount / playerIds.length) * 100 : 0;
          setStats(prev => prev ? {
            ...prev,
            currentMonthPaid: paidCount,
            currentMonthUnpaid: unpaidCount,
            paymentRate: Math.round(paymentRate),
            overduePayments: unpaidCount
          } : null);
        }
      } catch (error) {
        console.error('Error fetching financial data:', error);
      }
      
      // Fetch new players this month
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: newPlayersData, error: newPlayersError } = await supabase
          .from('players')
          .select('id, name, club_join_date, teams:team_id(name)')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .gte('club_join_date', startOfMonth.toISOString());
        
        if (!newPlayersError && newPlayersData) {
          const formattedNewPlayers = newPlayersData.map((player: any) => ({
            id: player.id,
            name: player.name,
            team_name: player.teams?.name || 'No Team',
            join_date: new Date(player.club_join_date).toLocaleDateString()
          }));
          
          setNewPlayers(formattedNewPlayers);
          setStats(prev => prev ? {
            ...prev,
            newPlayersThisMonth: newPlayersData.length
          } : null);
        }
      } catch (error) {
        console.error('Error fetching new players:', error);
      }
      
      // Fetch medical visa status
      try {
        const { data: medicalData, error: medicalError } = await supabase
          .from('players')
          .select('medical_visa_status')
          .eq('club_id', clubId)
          .eq('is_active', true);
        
        if (!medicalError && medicalData) {
          const valid = medicalData.filter(p => p.medical_visa_status === 'valid').length;
          const expired = medicalData.filter(p => p.medical_visa_status === 'expired').length;
          const pending = medicalData.filter(p => p.medical_visa_status === 'pending').length;
          
          setStats(prev => prev ? {
            ...prev,
            medicalVisaValid: valid,
            medicalVisaExpired: expired,
            medicalVisaPending: pending
          } : null);
        }
      } catch (error) {
        console.error('Error fetching medical visa data:', error);
      }
      
      // Fetch payment reminders (mock data for now - you can implement actual reminder tracking)
      try {
        // This would typically come from a payment_reminders table
        // For now, we'll use mock data
        const mockReminders = [
          { id: '1', player_name: 'John Doe', parent_name: 'Jane Doe', sent_date: '2025-01-15', status: 'sent' as const },
          { id: '2', player_name: 'Mike Smith', parent_name: 'Sarah Smith', sent_date: '2025-01-14', status: 'sent' as const }
        ];
        
        setPaymentReminders(mockReminders);
        setStats(prev => prev ? {
          ...prev,
          paymentRemindersSent: mockReminders.length
        } : null);
      } catch (error) {
        console.error('Error fetching payment reminders:', error);
      }
      
      // Fetch recent activities for this club
      try {
        // Get recent activities for this specific club
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activity_logs')
          .select('id, club_id, action, created_at, user_name, clubs(name)')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (activitiesError) throw activitiesError;
        
        if (activitiesData && activitiesData.length > 0) {
          // Transform data to match our interface
          const formattedActivities = activitiesData.map((activity: any) => ({
            id: activity.id,
            club_name: activity.clubs?.name || 'Your Club',
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
        setRecentActivity([]);
      }
      
      // For club admin, we don't need top clubs data
      setTopClubs([]);
      
    } catch (error) {
      console.error('Error fetching club admin dashboard data:', error);
      throw error;
    }
  };
  
  const fetchMasterAdminData = async () => {
    try {
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
        attendanceRate: 78, // Mock data for now
        currentMonthPaid: 0,
        currentMonthUnpaid: 0,
        paymentRate: 0,
        revenueThisMonth: 0,
        overduePayments: 0,
        newPlayersThisMonth: 0,
        medicalVisaValid: 0,
        medicalVisaExpired: 0,
        medicalVisaPending: 0,
        paymentRemindersSent: 0
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
      console.error('Error fetching master admin dashboard data:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <>
      <Title order={2} mb="md">
        {userRole === 'clubAdmin' && clubName ? `${clubName} Dashboard` : 'Master Admin Dashboard'}
      </Title>
      
      {/* Stats Cards */}
      <SimpleGrid cols={4} spacing="md" mb="md">
        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                {userRole === 'clubAdmin' ? 'Your Club' : 'Total Clubs'}
              </Text>
              <Text weight={700} size="xl">
                {stats?.totalClubs}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={38} radius="md">
              <IconBuildingCommunity size={22} />
            </ThemeIcon>
          </Group>
          {userRole !== 'clubAdmin' && (
            <Group position="apart" mt="xs">
              <Text size="xs" color="green">
                Active: {stats?.activeClubs}
              </Text>
              <Text size="xs" color="red">
                Suspended: {stats?.suspendedClubs}
              </Text>
            </Group>
          )}
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 0 0 rgba(0,0,0,0)' }} onClick={() => navigate('/players')} onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')} onMouseOut={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)')}>
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
            {userRole === 'clubAdmin' ? 'Active players in your club' : 'Active players across all clubs'}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 0 0 rgba(0,0,0,0)' }} onClick={() => navigate('/teams')} onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')} onMouseOut={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)')}>
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
            {userRole === 'clubAdmin' ? 'Teams in your club' : 'Teams across all clubs'}
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 0 0 rgba(0,0,0,0)' }} onClick={() => navigate('/coaches')} onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')} onMouseOut={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)')}>
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                {userRole === 'clubAdmin' ? 'Coaches' : 'Attendance Rate'}
              </Text>
              <Text weight={700} size="xl">
                {userRole === 'clubAdmin' ? stats?.totalCoaches : `${stats?.attendanceRate}%`}
              </Text>
            </div>
            <ThemeIcon color="violet" variant="light" size={38} radius="md">
              <IconChartBar size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            {userRole === 'clubAdmin' ? 'Active coaches in your club' : 'Average across all clubs'}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Financial Overview Cards */}
      <SimpleGrid cols={4} spacing="md" mb="md">
        {/* Paid Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 0 0 rgba(0,0,0,0)' }} onClick={() => navigate(`/payments?status=paid&year=${currentYear}&month=${currentMonth}`)} onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')} onMouseOut={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)')}>
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Paid This Month
              </Text>
              <Text weight={700} size="xl" color="green">
                {stats?.currentMonthPaid}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size={38} radius="md">
              <IconUserCheck size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Players who paid
          </Text>
        </Paper>
        {/* Unpaid Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 0 0 rgba(0,0,0,0)' }} onClick={() => navigate(`/payments?status=unpaid&year=${currentYear}&month=${currentMonth}`)} onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')} onMouseOut={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)')}>
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Unpaid This Month
              </Text>
              <Text weight={700} size="xl" color="red">
                {stats?.currentMonthUnpaid}
              </Text>
            </div>
            <ThemeIcon color="red" variant="light" size={38} radius="md">
              <IconUserCheck size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Players who haven't paid
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Payment Rate
              </Text>
              <Text weight={700} size="xl">
                {stats?.paymentRate}%
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={38} radius="md">
              <IconChartBar size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Percentage of players paid
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Payment Reminders
              </Text>
              <Text weight={700} size="xl">
                {stats?.paymentRemindersSent}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={38} radius="md">
              <IconUserCheck size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Reminders sent this month
          </Text>
        </Paper>
      </SimpleGrid>

      {/* New Players and Medical Visa Cards */}
      <SimpleGrid cols={2} spacing="md" mb="md">
        {/* New Players This Month */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>New Players This Month</Text>
              <Badge color="blue" size="lg">{stats?.newPlayersThisMonth}</Badge>
            </Group>
          </Card.Section>
          
          <Table>
            <thead>
              <tr>
                <th>Player Name</th>
                <th>Team</th>
                <th>Join Date</th>
              </tr>
            </thead>
            <tbody>
              {newPlayers.slice(0, 5).map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.team_name}</td>
                  <td>{player.join_date}</td>
                </tr>
              ))}
              {newPlayers.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>
                    No new players this month
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        
        {/* Medical Visa Status */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Medical Visa Status</Text>
            </Group>
          </Card.Section>
          
          <Group position="apart" mt="md">
            <Card withBorder p="xs" radius="md" style={{ background: 'rgba(75, 192, 112, 0.1)', borderColor: 'rgba(75, 192, 112, 0.5)', width: '30%' }}>
              <Group position="apart">
                <Text size="sm" weight={600}>Valid</Text>
                <Badge color="green" size="lg" radius="sm" variant="filled">
                  {stats?.medicalVisaValid}
                </Badge>
              </Group>
            </Card>
            <Card withBorder p="xs" radius="md" style={{ background: 'rgba(255, 99, 132, 0.1)', borderColor: 'rgba(255, 99, 132, 0.5)', width: '30%' }}>
              <Group position="apart">
                <Text size="sm" weight={600}>Expired</Text>
                <Badge color="red" size="lg" radius="sm" variant="filled">
                  {stats?.medicalVisaExpired}
                </Badge>
              </Group>
            </Card>
            <Card withBorder p="xs" radius="md" style={{ background: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.5)', width: '30%' }}>
              <Group position="apart">
                <Text size="sm" weight={600}>Pending</Text>
                <Badge color="yellow" size="lg" radius="sm" variant="filled">
                  {stats?.medicalVisaPending}
                </Badge>
              </Group>
            </Card>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Payment Reminders Table */}
      <Card withBorder p="md" radius="md" mb="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Group position="apart">
            <Text weight={500}>Recent Payment Reminders</Text>
          </Group>
        </Card.Section>
        
        <Table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Parent</th>
              <th>Sent Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paymentReminders.length > 0 ? (
              paymentReminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td>{reminder.player_name}</td>
                  <td>{reminder.parent_name}</td>
                  <td>{reminder.sent_date}</td>
                  <td>
                    <Badge color={reminder.status === 'sent' ? 'green' : 'yellow'}>
                      {reminder.status}
                    </Badge>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                  No payment reminders sent
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* Club admin doesn't need to see the club status overview */}
      {userRole !== 'clubAdmin' && (
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
      )}
    </>
  );
};

export default Dashboard; 