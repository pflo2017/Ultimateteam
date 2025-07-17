import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Tabs,
  Group,
  Text,
  Badge,
  Button,
  Paper,
  Loader,
  Center,
  Table,
  ScrollArea,
  Stack,
  Card,
  Grid,
  RingProgress,
  Select,
  NumberInput
} from '@mantine/core';
import {
  IconUsers,
  IconCreditCard,
  IconCalendar,
  IconChartBar,
  IconArrowLeft,
  IconEye,
  IconEdit
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

interface Team {
  id: string;
  name: string;
  club_id: string;
  club_name?: string;
  player_count: number;
  coach_count: number;
  coach_names?: string[];
  is_active: boolean;
  created_at: string;
}

interface Player {
  id: string;
  name: string;
  team_id: string;
  parent_id: string;
  is_active: boolean;
  medical_visa_status: string;
  medical_visa_issue_date: string | null;
  payment_status: string;
  team_name: string;
  parent_name: string;
  current_payment_status?: string;
  club_name?: string;
  last_payment_date?: string | null;
  club_join_date?: string | null;
  birthdate?: string | null;
}

interface Payment {
  id: string;
  player_id: string;
  player_name: string;
  status: string;
  updated_at: string;
  month: number;
  year: number;
}

interface PlayerPaymentSummary {
  player_id: string;
  player_name: string;
  total_months: number;
  paid_months: number;
  unpaid_months: number;
  overdue_months: number;
  last_payment_date?: string;
  current_status: 'paid' | 'unpaid' | 'overdue' | 'partial';
  payment_rate: number; // percentage of months paid
}

interface Attendance {
  id: string;
  player_id: string;
  player_name: string;
  activity_id: string;
  activity_name: string;
  status: 'present' | 'absent' | 'late';
  date: string;
}

interface PlayerAttendanceSummary {
  player_id: string;
  player_name: string;
  total_activities: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
  last_attendance_date?: string;
  current_status: 'excellent' | 'good' | 'fair' | 'poor';
}

const TeamDetails: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummaries, setPaymentSummaries] = useState<PlayerPaymentSummary[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<PlayerAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('players');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number }>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails();
    }
  }, [teamId]);

  const fetchTeamDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          id, 
          name, 
          club_id,
          is_active,
          created_at,
          coach_id,
          clubs:club_id (name)
        `)
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      if (teamData) {
        // Get player count
        const { count: playerCount } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamData.id)
          .eq('is_active', true);

        // Get coach information
        let coachNames: string[] = [];
        if (teamData.coach_id) {
          const { data: directCoach } = await supabase
            .from('coaches')
            .select('name')
            .eq('id', teamData.coach_id)
            .single();
          
          if (directCoach?.name) {
            coachNames.push(directCoach.name);
          }
        }

        // Get coaches from team_coaches table
        const { data: teamCoachesData } = await supabase
          .from('team_coaches')
          .select('coach_id')
          .eq('team_id', teamData.id);

        if (teamCoachesData && teamCoachesData.length > 0) {
          const coachIds = teamCoachesData.map(item => item.coach_id);
          const { data: coachesData } = await supabase
            .from('coaches')
            .select('name')
            .in('id', coachIds);
          
          if (coachesData) {
            const names = coachesData.map((coach: any) => coach.name);
            coachNames = [...coachNames, ...names];
          }
        }

        const teamWithDetails: Team = {
          ...teamData,
          club_name: (teamData.clubs as any)?.name || 'Unknown Club',
          player_count: playerCount || 0,
          coach_count: coachNames.length,
          coach_names: coachNames
        };

        setTeam(teamWithDetails);
      }
    } catch (error) {
      console.error('Error fetching team details:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load team details',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id, 
          name, 
          team_id, 
          parent_id, 
          is_active, 
          medical_visa_status, 
          medical_visa_issue_date,
          payment_status,
          last_payment_date,
          club_join_date,
          club_id,
          birth_date,
          teams:team_id (name),
          parents:parent_id (name),
          clubs:club_id (name)
        `)
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (error) throw error;

      if (data) {
        const playersWithDetails: Player[] = data.map((player: any) => {
          let formattedBirthdate = null;
          let formattedLastPaymentDate = null;
          let formattedClubJoinDate = null;
          let formattedMedicalVisaDate = null;
          
          try {
            if (player.birth_date) {
              formattedBirthdate = new Date(player.birth_date).toLocaleDateString();
            }
            if (player.last_payment_date) {
              formattedLastPaymentDate = new Date(player.last_payment_date).toLocaleDateString();
            }
            if (player.club_join_date) {
              formattedClubJoinDate = new Date(player.club_join_date).toLocaleDateString();
            }
            if (player.medical_visa_issue_date) {
              formattedMedicalVisaDate = new Date(player.medical_visa_issue_date).toLocaleDateString();
            }
          } catch (e) {
            console.error('Error formatting dates:', e);
          }
          
          return {
            id: player.id,
            name: player.name,
            team_id: player.team_id,
            parent_id: player.parent_id,
            is_active: player.is_active,
            medical_visa_status: player.medical_visa_status,
            medical_visa_issue_date: formattedMedicalVisaDate,
            payment_status: player.payment_status,
            team_name: player.teams?.name || 'Unknown Team',
            parent_name: player.parents?.name || 'Unknown Parent',
            club_name: player.clubs?.name || 'Unknown Club',
            last_payment_date: formattedLastPaymentDate,
            club_join_date: formattedClubJoinDate,
            birthdate: formattedBirthdate
          };
        });
        
        setPlayers(playersWithDetails);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      // First, get all players for this team
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (playersError) throw playersError;

      if (!playersData || playersData.length === 0) {
        setPayments([]);
        setPaymentSummaries([]);
        return;
      }

      // Get player IDs
      const playerIds = playersData.map(player => player.id);

      // Fetch payments for these players
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('*')
        .in('player_id', playerIds);

      if (paymentsError) throw paymentsError;

      if (paymentsData) {
        // Create a map of player names
        const playerNameMap: Record<string, string> = {};
        playersData.forEach(player => {
          playerNameMap[player.id] = player.name;
        });

        const paymentsWithDetails: Payment[] = paymentsData.map((payment: any) => ({
          id: payment.id,
          player_id: payment.player_id,
          player_name: playerNameMap[payment.player_id] || 'Unknown Player',
          status: payment.status,
          updated_at: payment.updated_at,
          month: payment.month,
          year: payment.year
        }));
        
        setPayments(paymentsWithDetails);

        // Create payment summaries for each player
        const playerPaymentMap: Record<string, Payment[]> = {};
        paymentsWithDetails.forEach(payment => {
          if (!playerPaymentMap[payment.player_id]) {
            playerPaymentMap[payment.player_id] = [];
          }
          playerPaymentMap[payment.player_id].push(payment);
        });

        const summaries: PlayerPaymentSummary[] = playersData.map(player => {
          const playerPayments = playerPaymentMap[player.id] || [];
          const totalMonths = playerPayments.length;
          const paidMonths = playerPayments.filter(p => p.status === 'paid').length;
          const unpaidMonths = playerPayments.filter(p => p.status === 'unpaid').length;
          const overdueMonths = playerPayments.filter(p => p.status === 'overdue').length;
          
          // Get last payment date
          const paidPayments = playerPayments.filter(p => p.status === 'paid');
          const lastPaymentDate = paidPayments.length > 0 
            ? paidPayments.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
            : undefined;

          // Determine current status
          let currentStatus: 'paid' | 'unpaid' | 'overdue' | 'partial' = 'unpaid';
          if (overdueMonths > 0) {
            currentStatus = 'overdue';
          } else if (paidMonths === totalMonths && totalMonths > 0) {
            currentStatus = 'paid';
          } else if (paidMonths > 0 && paidMonths < totalMonths) {
            currentStatus = 'partial';
          }

          const paymentRate = totalMonths > 0 ? Math.round((paidMonths / totalMonths) * 100) : 0;

          return {
            player_id: player.id,
            player_name: player.name,
            total_months: totalMonths,
            paid_months: paidMonths,
            unpaid_months: unpaidMonths,
            overdue_months: overdueMonths,
            last_payment_date: lastPaymentDate,
            current_status: currentStatus,
            payment_rate: paymentRate
          };
        });

        setPaymentSummaries(summaries);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      // First, get all players for this team
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (playersError) throw playersError;

      if (!playersData || playersData.length === 0) {
        setAttendance([]);
        setAttendanceSummaries([]);
        return;
      }

      // Get player IDs
      const playerIds = playersData.map(player => player.id);

      // Fetch all activities for the team to get activity names
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('id, title')
        .eq('team_id', teamId);

      if (activitiesError) throw activitiesError;

      console.log('Activities fetched for team:', activitiesData);

      // Create activity name mapping
      const activityNameMap: { [key: string]: string } = {};
      if (activitiesData) {
        activitiesData.forEach(activity => {
          activityNameMap[activity.id] = activity.title;
        });
      }
      
      console.log('Activity name mapping:', activityNameMap);

      // Calculate date range for the selected month
      const startDate = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
      const endDate = new Date(selectedMonth.year, selectedMonth.month, 0); // Last day of the month
      
      // Fetch attendance records for these players in the selected month
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select(`
          id,
          player_id,
          activity_id,
          status,
          actual_activity_date,
          player:player_id (name)
        `)
        .in('player_id', playerIds)
        .gte('actual_activity_date', startDate.toISOString())
        .lte('actual_activity_date', endDate.toISOString());

      if (attendanceError) throw attendanceError;

      console.log('Attendance data fetched:', attendanceData);
      console.log('Sample activity IDs from attendance:', attendanceData?.slice(0, 3).map(r => r.activity_id));

      if (attendanceData) {
        // Create a map of player names
        const playerNameMap: Record<string, string> = {};
        playersData.forEach(player => {
          playerNameMap[player.id] = player.name;
        });

        // Get activity IDs to fetch activity names
        // Use the activity name mapping we already created from the first query
        // No need to fetch activities again since we already have them

        const attendanceWithDetails: Attendance[] = attendanceData.map((record: any) => {
          // Handle recurring instance IDs by extracting the base activity ID
          let baseActivityId = record.activity_id;
          if (record.activity_id && record.activity_id.includes('-')) {
            // Try to find the base activity ID by checking if it's a valid UUID
            const parts = record.activity_id.split('-');
            // UUID format: 8-4-4-4-12 characters
            // Try different combinations to find a valid UUID
            for (let i = 1; i <= parts.length - 1; i++) {
              const candidate = parts.slice(0, i).join('-');
              if (activityNameMap[candidate]) {
                baseActivityId = candidate;
                break;
              }
            }
          }
          
          const activityName = activityNameMap[baseActivityId];
          console.log(`Mapping activity: ${record.activity_id} -> base: ${baseActivityId} -> name: ${activityName || 'Unknown Activity'}`);
          
          return {
            id: record.id,
            player_id: record.player_id,
            player_name: record.player?.name || 'Unknown Player',
            activity_id: record.activity_id,
            activity_name: activityName || 'Unknown Activity',
            status: record.status,
            date: record.actual_activity_date
          };
        });
        
        setAttendance(attendanceWithDetails);

        // Create attendance summaries for each player
        const playerAttendanceMap: Record<string, Attendance[]> = {};
        attendanceWithDetails.forEach(attendance => {
          if (!playerAttendanceMap[attendance.player_id]) {
            playerAttendanceMap[attendance.player_id] = [];
          }
          playerAttendanceMap[attendance.player_id].push(attendance);
        });

        const summaries: PlayerAttendanceSummary[] = playersData.map(player => {
          const playerAttendance = playerAttendanceMap[player.id] || [];
          const totalActivities = playerAttendance.length;
          const presentCount = playerAttendance.filter(a => a.status === 'present').length;
          const absentCount = playerAttendance.filter(a => a.status === 'absent').length;
          const lateCount = playerAttendance.filter(a => a.status === 'late').length;
          
          // Get last attendance date
          const lastAttendanceDate = playerAttendance.length > 0 
            ? playerAttendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
            : undefined;

          // Calculate attendance rate
          const attendanceRate = totalActivities > 0 ? Math.round((presentCount / totalActivities) * 100) : 0;

          // Determine current status
          let currentStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
          if (attendanceRate >= 90) {
            currentStatus = 'excellent';
          } else if (attendanceRate >= 75) {
            currentStatus = 'good';
          } else if (attendanceRate >= 50) {
            currentStatus = 'fair';
          }

          return {
            player_id: player.id,
            player_name: player.name,
            total_activities: totalActivities,
            present_count: presentCount,
            absent_count: absentCount,
            late_count: lateCount,
            attendance_rate: attendanceRate,
            last_attendance_date: lastAttendanceDate,
            current_status: currentStatus
          };
        });

        setAttendanceSummaries(summaries);
        console.log('Attendance summaries created:', summaries);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'players') {
      fetchPlayers();
    } else if (activeTab === 'payments') {
      fetchPayments();
    } else if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab, teamId, selectedMonth]);

  const getMedicalVisaBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge color="green">Valid</Badge>;
      case 'expired':
        return <Badge color="red">Expired</Badge>;
      case 'missing':
        return <Badge color="orange">Missing</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge color="green">Paid</Badge>;
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'overdue':
        return <Badge color="red">Overdue</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getPlayerPaymentStatusBadge = (status: 'paid' | 'unpaid' | 'overdue' | 'partial') => {
    switch (status) {
      case 'paid':
        return <Badge color="green">Fully Paid</Badge>;
      case 'partial':
        return <Badge color="yellow">Partially Paid</Badge>;
      case 'overdue':
        return <Badge color="red">Overdue</Badge>;
      case 'unpaid':
        return <Badge color="gray">Unpaid</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getPlayerDetailedPayments = (playerId: string) => {
    return payments.filter(payment => payment.player_id === playerId);
  };

  const formatMonthYear = (month: number, year: number) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[month - 1]} ${year}`;
  };

  const getAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge color="green">Present</Badge>;
      case 'absent':
        return <Badge color="red">Absent</Badge>;
      case 'late':
        return <Badge color="yellow">Late</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getPlayerAttendanceStatusBadge = (status: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (status) {
      case 'excellent':
        return <Badge color="green">Excellent</Badge>;
      case 'good':
        return <Badge color="blue">Good</Badge>;
      case 'fair':
        return <Badge color="yellow">Fair</Badge>;
      case 'poor':
        return <Badge color="red">Poor</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getPlayerDetailedAttendance = (playerId: string) => {
    return attendance.filter(att => att.player_id === playerId);
  };

  if (loading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  if (!team) {
    return (
      <Center p="xl">
        <Text>Team not found</Text>
      </Center>
    );
  }

  return (
    <div>
      {/* Header */}
      <Group position="apart" mb="lg">
        <Group>
          <Button
            variant="subtle"
            leftIcon={<IconArrowLeft size={16} />}
            onClick={() => navigate('/admin/teams')}
          >
            Back to Teams
          </Button>
          <Title order={2}>{team.name}</Title>
          <Badge color={team.is_active ? 'green' : 'gray'}>
            {team.is_active ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        </Group>
        <Group>
          <Button leftIcon={<IconEdit size={16} />}>
            Edit Team
          </Button>
        </Group>
      </Group>

      {/* Team Info Card */}
      <Paper p="md" mb="lg">
        <Grid>
          <Grid.Col span={3}>
            <Text size="sm" color="dimmed">Club</Text>
            <Text weight={500}>{team.club_name}</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" color="dimmed">Players</Text>
            <Text weight={500}>{team.player_count}</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" color="dimmed">Coaches</Text>
            <Text weight={500}>{team.coach_count}</Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" color="dimmed">Created</Text>
            <Text weight={500}>
              {new Date(team.created_at).toLocaleDateString()}
            </Text>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onTabChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="players" icon={<IconUsers size={16} />}>
            Players ({players.length})
          </Tabs.Tab>
          <Tabs.Tab value="payments" icon={<IconCreditCard size={16} />}>
            Payments
          </Tabs.Tab>
          <Tabs.Tab value="attendance" icon={<IconCalendar size={16} />}>
            Attendance ({attendance.length})
          </Tabs.Tab>
          <Tabs.Tab value="statistics" icon={<IconChartBar size={16} />}>
            Statistics
          </Tabs.Tab>
          <Tabs.Tab value="analytics" icon={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="players" pt="md">
          <ScrollArea h={400}>
            <Table>
              <thead>
                <tr>
                  <th>Player Name</th>
                  <th>Parent</th>
                  <th>Payment Status</th>
                  <th>Medical Visa</th>
                  <th>Birth Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <Text weight={500}>{player.name}</Text>
                    </td>
                    <td>
                      <Text size="sm">{player.parent_name}</Text>
                    </td>
                    <td>
                      {getPaymentStatusBadge(player.payment_status)}
                    </td>
                    <td>
                      {getMedicalVisaBadge(player.medical_visa_status)}
                    </td>
                    <td>
                      <Text size="sm">
                        {player.birthdate || 'N/A'}
                      </Text>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <Button size="xs" variant="subtle">
                          View Details
                        </Button>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <ScrollArea h={400}>
            <Table>
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Player</th>
                  <th>Status</th>
                  <th>Payment Rate</th>
                  <th>Months Paid</th>
                  <th>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {paymentSummaries.map((summary) => {
                  const isExpanded = expandedPlayerId === summary.player_id;
                  const detailedPayments = getPlayerDetailedPayments(summary.player_id);
                  
                  return (
                    <React.Fragment key={summary.player_id}>
                      <tr 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedPlayerId(isExpanded ? null : summary.player_id)}
                      >
                        <td>
                          <Text size="sm" color="dimmed">
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        </td>
                        <td>
                          <Text weight={500}>{summary.player_name}</Text>
                        </td>
                        <td>
                          {getPlayerPaymentStatusBadge(summary.current_status)}
                        </td>
                        <td>
                          <Group spacing="xs">
                            <RingProgress
                              size={40}
                              thickness={4}
                              sections={[
                                { value: summary.payment_rate, color: summary.payment_rate >= 80 ? 'green' : summary.payment_rate >= 50 ? 'yellow' : 'red' }
                              ]}
                            />
                            <Text size="sm">{summary.payment_rate}%</Text>
                          </Group>
                        </td>
                        <td>
                          <Text size="sm">
                            {summary.paid_months}/{summary.total_months} months
                          </Text>
                        </td>
                        <td>
                          <Text size="sm">
                            {summary.last_payment_date ? new Date(summary.last_payment_date).toLocaleDateString() : 'No payments'}
                          </Text>
                        </td>
                      </tr>
                      
                      {/* Expanded detailed view */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <Paper p="md" m="xs" withBorder>
                              <Text weight={500} size="sm" mb="xs">
                                Monthly Payment Details for {summary.player_name}
                              </Text>
                              <Table>
                                <thead>
                                  <tr>
                                    <th>Month/Year</th>
                                    <th>Status</th>
                                    <th>Paid Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailedPayments.length > 0 ? (
                                    detailedPayments.map((payment) => (
                                      <tr key={payment.id}>
                                        <td>
                                          <Text size="sm">
                                            {formatMonthYear(payment.month, payment.year)}
                                          </Text>
                                        </td>
                                        <td>
                                          {getPaymentStatusBadge(payment.status)}
                                        </td>
                                        <td>
                                          <Text size="sm">
                                            {payment.status === 'paid' && payment.updated_at 
                                              ? new Date(payment.updated_at).toLocaleDateString() 
                                              : 'Not paid'}
                                          </Text>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={3}>
                                        <Text size="sm" color="dimmed" align="center">
                                          No payment records found
                                        </Text>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </Paper>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="attendance" pt="md">
          <Group position="apart" mb="md">
            <Group>
              <Select
                label="Month"
                value={selectedMonth.month.toString()}
                onChange={(value: string | null) => setSelectedMonth(prev => ({ ...prev, month: parseInt(value || '1') }))}
                data={[
                  { value: '1', label: 'January' },
                  { value: '2', label: 'February' },
                  { value: '3', label: 'March' },
                  { value: '4', label: 'April' },
                  { value: '5', label: 'May' },
                  { value: '6', label: 'June' },
                  { value: '7', label: 'July' },
                  { value: '8', label: 'August' },
                  { value: '9', label: 'September' },
                  { value: '10', label: 'October' },
                  { value: '11', label: 'November' },
                  { value: '12', label: 'December' }
                ]}
                style={{ width: 150 }}
              />
              <NumberInput
                label="Year"
                value={selectedMonth.year}
                onChange={(value: number | '') => setSelectedMonth(prev => ({ ...prev, year: value || new Date().getFullYear() }))}
                min={2020}
                max={2030}
                style={{ width: 100 }}
              />
            </Group>
            <Text size="sm" color="dimmed">
              Showing attendance for {formatMonthYear(selectedMonth.month, selectedMonth.year)}
            </Text>
          </Group>
          <ScrollArea h={400}>
            <Table>
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Player</th>
                  <th>Status</th>
                  <th>Attendance Rate</th>
                  <th>Activities</th>
                  <th>Last Attendance</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSummaries.map((summary) => {
                  const isExpanded = expandedPlayerId === summary.player_id;
                  const detailedAttendance = getPlayerDetailedAttendance(summary.player_id);
                  
                  return (
                    <React.Fragment key={summary.player_id}>
                      <tr 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedPlayerId(isExpanded ? null : summary.player_id)}
                      >
                        <td>
                          <Text size="sm" color="dimmed">
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        </td>
                        <td>
                          <Text weight={500}>{summary.player_name}</Text>
                        </td>
                        <td>
                          {getPlayerAttendanceStatusBadge(summary.current_status)}
                        </td>
                        <td>
                          <Group spacing="xs">
                            <RingProgress
                              size={40}
                              thickness={4}
                              sections={[
                                { value: summary.attendance_rate, color: summary.attendance_rate >= 90 ? 'green' : summary.attendance_rate >= 75 ? 'blue' : summary.attendance_rate >= 50 ? 'yellow' : 'red' }
                              ]}
                            />
                            <Text size="sm">{summary.attendance_rate}%</Text>
                          </Group>
                        </td>
                        <td>
                          <Text size="sm">
                            {summary.present_count}/{summary.total_activities} present
                          </Text>
                        </td>
                        <td>
                          <Text size="sm">
                            {summary.last_attendance_date ? new Date(summary.last_attendance_date).toLocaleDateString() : 'No attendance'}
                          </Text>
                        </td>
                      </tr>
                      
                      {/* Expanded detailed view */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <Paper p="md" m="xs" withBorder>
                              <Text weight={500} size="sm" mb="xs">
                                Attendance Details for {summary.player_name}
                              </Text>
                              <Table>
                                <thead>
                                  <tr>
                                    <th>Activity</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailedAttendance.length > 0 ? (
                                    detailedAttendance.map((record) => (
                                      <tr key={record.id}>
                                        <td>
                                          <Text size="sm">
                                            {record.activity_name}
                                          </Text>
                                        </td>
                                        <td>
                                          {getAttendanceStatusBadge(record.status)}
                                        </td>
                                        <td>
                                          <Text size="sm">
                                            {new Date(record.date).toLocaleDateString()}
                                          </Text>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={3}>
                                        <Text size="sm" color="dimmed" align="center">
                                          No attendance records found
                                        </Text>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </Paper>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="statistics" pt="md">
          <Grid>
            <Grid.Col span={4}>
              <Card p="md">
                <Text size="lg" weight={500} mb="md">Payment Overview</Text>
                <RingProgress
                  sections={[
                    { value: 70, color: 'green' },
                    { value: 20, color: 'yellow' },
                    { value: 10, color: 'red' }
                  ]}
                  label={
                    <Text size="xs" align="center">
                      70% Paid
                    </Text>
                  }
                />
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card p="md">
                <Text size="lg" weight={500} mb="md">Attendance Rate</Text>
                <RingProgress
                  sections={[
                    { value: 85, color: 'green' },
                    { value: 10, color: 'yellow' },
                    { value: 5, color: 'red' }
                  ]}
                  label={
                    <Text size="xs" align="center">
                      85% Present
                    </Text>
                  }
                />
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card p="md">
                <Text size="lg" weight={500} mb="md">Medical Visa Status</Text>
                <RingProgress
                  sections={[
                    { value: 90, color: 'green' },
                    { value: 5, color: 'orange' },
                    { value: 5, color: 'red' }
                  ]}
                  label={
                    <Text size="xs" align="center">
                      90% Valid
                    </Text>
                  }
                />
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="analytics" pt="md">
          <Grid>
            <Grid.Col span={6}>
              <Card p="md">
                <Text size="lg" weight={500} mb="md">Monthly Payments Trend</Text>
                {/* Placeholder for chart component */}
                <Center h={200}>
                  <Text color="dimmed">Chart will be implemented here</Text>
                </Center>
              </Card>
            </Grid.Col>
            <Grid.Col span={6}>
              <Card p="md">
                <Text size="lg" weight={500} mb="md">Attendance Trend</Text>
                {/* Placeholder for chart component */}
                <Center h={200}>
                  <Text color="dimmed">Chart will be implemented here</Text>
                </Center>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default TeamDetails; 