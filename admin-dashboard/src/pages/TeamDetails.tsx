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
  NumberInput,
  Modal
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
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Filler
} from 'chart.js';

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

interface GameResult {
  id: string;
  title: string;
  date: string;
  homeScore: number;
  awayScore: number;
  homeAway: 'home' | 'away';
  outcome: 'Win' | 'Loss' | 'Draw';
  clubScore: number;
  opponentScore: number;
}

interface MatchReportEvent {
  id: string;
  event_type: 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'man_of_the_match';
  player_id: string;
  player_name: string;
  minute?: number;
  half: 'first' | 'second';
}

interface MatchReport {
  events: MatchReportEvent[];
  summary: {
    totalGoals: number;
    totalAssists: number;
    totalYellowCards: number;
    totalRedCards: number;
    manOfTheMatch?: string;
  };
}

interface PlayerStats {
  player_id: string;
  player_name: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  man_of_match_count: number;
  man_of_match_games: Array<{
    game_id: string;
    game_title: string;
    game_date: string;
  }>;
  total_events: number;
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
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('players');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number }>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [matchReportModalOpen, setMatchReportModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameResult | null>(null);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [matchReportLoading, setMatchReportLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails();
    }
  }, [teamId]);

  useEffect(() => {
    if (activeTab === 'analytics' && teamId) {
      console.log('Analytics tab selected, fetching game results...');
      fetchGameResults();
    }
  }, [activeTab, teamId]);

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
        
        console.log('Payment statuses found:', [...new Set(paymentsWithDetails.map(p => p.status))]);
        
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
          
          // Get current year and month for complete payment tracking
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;
          
          // Calculate total months up to current month for this year
          const totalMonths = currentMonth;
          
          // Count paid months from actual records for current year up to current month
          const paidMonths = playerPayments.filter(p => p.status === 'paid' && p.year === currentYear && p.month <= currentMonth).length;
          const unpaidMonths = playerPayments.filter(p => p.status === 'unpaid' && p.year === currentYear && p.month <= currentMonth).length;
          const overdueMonths = playerPayments.filter(p => p.status === 'overdue' && p.year === currentYear && p.month <= currentMonth).length;
          
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
      const { data: activitiesData, error: attendanceActivitiesError } = await supabase
        .from('activities')
        .select('id, title')
        .eq('team_id', teamId);

      if (attendanceActivitiesError) throw attendanceActivitiesError;

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
      case 'unpaid':
        return <Badge color="red">Unpaid</Badge>;
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'overdue':
        return <Badge color="red">Overdue</Badge>;
      default:
        return <Badge color="gray">{status || 'Unknown'}</Badge>;
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
    // Get current year and month
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Get actual payment records for this player
    const actualPayments = payments.filter(payment => payment.player_id === playerId);
    
    // Create a map of existing payments by month
    const paymentsByMonth = new Map<string, Payment>();
    actualPayments.forEach(payment => {
      const key = `${payment.year}-${payment.month}`;
      paymentsByMonth.set(key, payment);
    });
    
    // Generate complete payment records for all months up to current month
    const completePayments: Payment[] = [];
    
    for (let month = 1; month <= currentMonth; month++) {
      const key = `${currentYear}-${month}`;
      const existingPayment = paymentsByMonth.get(key);
      
      if (existingPayment) {
        // Use existing payment record
        completePayments.push(existingPayment);
      } else {
        // Create virtual payment record for missing month
        completePayments.push({
          id: `virtual-${currentYear}-${month}`,
          player_id: playerId,
          player_name: actualPayments.length > 0 ? actualPayments[0].player_name : 'Unknown Player',
          status: 'unpaid',
          updated_at: '',
          month: month,
          year: currentYear
        });
      }
    }
    
    // Sort by year and month (most recent first)
    return completePayments.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
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

  const fetchGameResults = async () => {
    try {
      setAnalyticsLoading(true);
      console.log('Fetching game results for teamId:', teamId);
      
      if (!teamId) {
        throw new Error('No team ID found');
      }

      // Fetch game activities with scores for this team
      const { data: gamesData, error: gamesError } = await supabase
        .from('activities')
        .select(`
          id,
          title,
          start_time,
          team_id,
          home_away,
          home_score,
          away_score
        `)
        .eq('team_id', teamId)
        .eq('type', 'game')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false });

      if (gamesError) throw gamesError;

      console.log('Raw games data:', gamesData);

      if (gamesData && gamesData.length > 0) {
        const results = gamesData.map((game: any) => {
          const isHome = game.home_away === 'home';
          const clubScore = isHome ? game.home_score : game.away_score;
          const opponentScore = isHome ? game.away_score : game.home_score;
          
          let outcome: 'Win' | 'Loss' | 'Draw';
          if (clubScore > opponentScore) {
            outcome = 'Win';
          } else if (clubScore < opponentScore) {
            outcome = 'Loss';
          } else {
            outcome = 'Draw';
          }

          return {
            id: game.id,
            title: game.title,
            date: new Date(game.start_time).toLocaleDateString(),
            homeScore: game.home_score,
            awayScore: game.away_score,
            homeAway: game.home_away,
            outcome: outcome,
            clubScore: clubScore,
            opponentScore: opponentScore
          };
        });

        console.log('Processed game results:', results);
        setGameResults(results);
        
        // Fetch player statistics after getting game results
        await fetchPlayerStatistics();
      } else {
        console.log('No games data found');
        setGameResults([]);
        setPlayerStats([]);
      }
    } catch (error) {
      console.error('Error fetching game results:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch game results',
        color: 'red'
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchPlayerStatistics = async () => {
    try {
      setPlayerStatsLoading(true);
      
      if (!teamId) return;

      // Get all game activity IDs for this team
      const { data: gamesData, error: gamesError } = await supabase
        .from('activities')
        .select('id, title, start_time')
        .eq('team_id', teamId)
        .eq('type', 'game');

      if (gamesError) throw gamesError;

      if (!gamesData || gamesData.length === 0) {
        setPlayerStats([]);
        return;
      }

      const gameIds = gamesData.map(game => game.id);
      const gamesMap = new Map(gamesData.map(game => [game.id, { title: game.title, date: game.start_time }]));

      // Fetch all events for these games
      const { data: eventsData, error: eventsError } = await supabase
        .from('activity_events')
        .select(`
          id,
          event_type,
          player_id,
          activity_id,
          players:player_id (name)
        `)
        .in('activity_id', gameIds);

      if (eventsError) throw eventsError;

      if (eventsData && eventsData.length > 0) {
        // Group events by player
        const playerStatsMap = new Map<string, PlayerStats>();

        eventsData.forEach((event: any) => {
          const playerId = event.player_id;
          const playerName = event.players?.name || 'Unknown Player';
          
          if (!playerStatsMap.has(playerId)) {
            playerStatsMap.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              goals: 0,
              assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              man_of_match_count: 0,
              man_of_match_games: [],
              total_events: 0
            });
          }

          const stats = playerStatsMap.get(playerId)!;
          stats.total_events++;

          switch (event.event_type) {
            case 'goal':
              stats.goals++;
              break;
            case 'assist':
              stats.assists++;
              break;
            case 'yellow_card':
              stats.yellow_cards++;
              break;
            case 'red_card':
              stats.red_cards++;
              break;
            case 'man_of_the_match':
              stats.man_of_match_count++;
              const gameInfo = gamesMap.get(event.activity_id);
              if (gameInfo) {
                stats.man_of_match_games.push({
                  game_id: event.activity_id,
                  game_title: gameInfo.title,
                  game_date: new Date(gameInfo.date).toLocaleDateString()
                });
              }
              break;
          }
        });

        // Convert to array and sort by total events
        const statsArray = Array.from(playerStatsMap.values())
          .filter(player => player.total_events > 0)
          .sort((a, b) => b.total_events - a.total_events);

        setPlayerStats(statsArray);
      } else {
        setPlayerStats([]);
      }
    } catch (error) {
      console.error('Error fetching player statistics:', error);
      setPlayerStats([]);
    } finally {
      setPlayerStatsLoading(false);
    }
  };

  const handleViewMatchReport = async (gameId: string) => {
    const game = gameResults.find(g => g.id === gameId) || null;
    setSelectedGame(game);
    setMatchReportModalOpen(true);
    setMatchReportLoading(true);
    
    try {
      // Fetch real match report data from activity_events table
      const { data: eventsData, error: eventsError } = await supabase
        .from('activity_events')
        .select(`
          id,
          event_type,
          player_id,
          minute,
          half,
          players:player_id (name)
        `)
        .eq('activity_id', gameId)
        .order('half', { ascending: true })
        .order('minute', { ascending: true });

      if (eventsError) {
        console.error('Error fetching match events:', eventsError);
        setMatchReport(null);
      } else if (eventsData && eventsData.length > 0) {
        // Process the events data
        const events: MatchReportEvent[] = eventsData.map((event: any) => ({
          id: event.id,
          event_type: event.event_type,
          player_id: event.player_id,
          player_name: event.players?.name || 'Unknown Player',
          minute: event.minute,
          half: event.half
        }));

        // Calculate summary
        const summary = {
          totalGoals: events.filter(e => e.event_type === 'goal').length,
          totalAssists: events.filter(e => e.event_type === 'assist').length,
          totalYellowCards: events.filter(e => e.event_type === 'yellow_card').length,
          totalRedCards: events.filter(e => e.event_type === 'red_card').length,
          manOfTheMatch: events.find(e => e.event_type === 'man_of_the_match')?.player_name
        };

        setMatchReport({ events, summary });
      } else {
        setMatchReport(null);
      }
    } catch (error) {
      console.error('Error fetching match report:', error);
      setMatchReport(null);
    } finally {
      setMatchReportLoading(false);
    }
  };

  const handleCloseMatchReport = () => {
    setMatchReportModalOpen(false);
    setSelectedGame(null);
    setMatchReport(null);
    setMatchReportLoading(false);
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
                                              : payment.id.startsWith('virtual-') 
                                                ? 'Not paid' 
                                                : 'Not available'}
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



        <Tabs.Panel value="analytics" pt="md">
          <div>
            <Title order={3} mb="md">Team Performance Analytics</Title>
            
            {(() => {
              console.log('Analytics tab - analyticsLoading:', analyticsLoading, 'gameResults length:', gameResults.length);
              return null;
            })()}
            
            {analyticsLoading ? (
              <Center p="xl">
                <Loader />
              </Center>
            ) : gameResults.length === 0 ? (
              <div>
                <Text align="center" mt="lg" color="dimmed">
                  No game results found. Games with scores will appear here.
                </Text>
                <Text align="center" mt="sm" size="xs" color="dimmed">
                  Debug: teamId = {teamId}, analyticsLoading = {analyticsLoading.toString()}
                </Text>
              </div>
            ) : (
              <div>
                {/* Performance Summary */}
                <Paper p="md" mb="md" withBorder>
                  <Group position="apart">
                    <div>
                      <Text size="sm" color="dimmed">Total Games</Text>
                      <Text weight={700} size="xl">{gameResults.length}</Text>
                    </div>
                    <div>
                      <Text size="sm" color="dimmed">Wins</Text>
                      <Text weight={700} size="xl" color="green">
                        {gameResults.filter(game => game.outcome === 'Win').length}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" color="dimmed">Losses</Text>
                      <Text weight={700} size="xl" color="red">
                        {gameResults.filter(game => game.outcome === 'Loss').length}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" color="dimmed">Draws</Text>
                      <Text weight={700} size="xl" color="yellow">
                        {gameResults.filter(game => game.outcome === 'Draw').length}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" color="dimmed">Win Rate</Text>
                      <Text weight={700} size="xl" color="blue">
                        {gameResults.length > 0 
                          ? Math.round((gameResults.filter(game => game.outcome === 'Win').length / gameResults.length) * 100)
                          : 0}%
                      </Text>
                    </div>
                  </Group>
                </Paper>

                {/* Game Results Table */}
                <Table striped>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Score</th>
                      <th>Result</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameResults.map((game) => (
                      <tr key={game.id}>
                        <td>{game.date}</td>
                        <td>{game.title}</td>
                        <td>
                          <Text>
                            {game.homeScore} - {game.awayScore}
                            <Text size="xs" color="dimmed" ml="xs">
                              ({game.homeAway === 'home' ? 'Home' : 'Away'})
                            </Text>
                          </Text>
                        </td>
                        <td>
                          <Badge 
                            color={
                              game.outcome === 'Win' ? 'green' : 
                              game.outcome === 'Loss' ? 'red' : 'yellow'
                            }
                          >
                            {game.outcome}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="xs" 
                            variant="subtle" 
                            color="blue"
                            onClick={() => handleViewMatchReport(game.id)}
                          >
                            View Match Report
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {/* Player Statistics Section */}
                <Paper p="md" mt="lg" withBorder>
                  <Title order={4} mb="md">Player Statistics</Title>
                  
                  {playerStatsLoading ? (
                    <Center p="xl">
                      <Loader />
                    </Center>
                  ) : playerStats.length === 0 ? (
                    <Text color="dimmed" align="center">
                      No player statistics available yet. Statistics will appear after match events are recorded.
                    </Text>
                  ) : (
                    <div>
                      {/* Top Goal Scorers */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <Text weight={600} size="lg" mb="sm" color="green">Top Goal Scorers</Text>
                        <Table>
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Goals</th>
                              <th>Assists</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerStats
                              .filter(player => player.goals > 0)
                              .sort((a, b) => b.goals - a.goals)
                              .slice(0, 5)
                              .map((player, index) => (
                                <tr key={player.player_id}>
                                  <td>
                                    <Group>
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        backgroundColor: '#228be6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: 'white'
                                      }}>
                                        {index + 1}
                                      </div>
                                      <Text weight={500}>{player.player_name}</Text>
                                    </Group>
                                  </td>
                                  <td>
                                    <Text weight={600} color="green">{player.goals}</Text>
                                  </td>
                                  <td>
                                    <Text color="blue">{player.assists}</Text>
                                  </td>
                                  <td>
                                    <Text weight={600}>{player.goals + player.assists}</Text>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </Table>
                      </div>

                      {/* Most Assists */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <Text weight={600} size="lg" mb="sm" color="blue">Most Assists</Text>
                        <Table>
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Assists</th>
                              <th>Goals</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerStats
                              .filter(player => player.assists > 0)
                              .sort((a, b) => b.assists - a.assists)
                              .slice(0, 5)
                              .map((player, index) => (
                                <tr key={player.player_id}>
                                  <td>
                                    <Group>
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        backgroundColor: '#228be6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: 'white'
                                      }}>
                                        {index + 1}
                                      </div>
                                      <Text weight={500}>{player.player_name}</Text>
                                    </Group>
                                  </td>
                                  <td>
                                    <Text weight={600} color="blue">{player.assists}</Text>
                                  </td>
                                  <td>
                                    <Text color="green">{player.goals}</Text>
                                  </td>
                                  <td>
                                    <Text weight={600}>{player.goals + player.assists}</Text>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </Table>
                      </div>

                      {/* Most Cards */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <Text weight={600} size="lg" mb="sm" color="orange">Most Cards</Text>
                        <Table>
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Yellow Cards</th>
                              <th>Red Cards</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerStats
                              .filter(player => player.yellow_cards > 0 || player.red_cards > 0)
                              .sort((a, b) => (b.yellow_cards + b.red_cards) - (a.yellow_cards + a.red_cards))
                              .slice(0, 5)
                              .map((player, index) => (
                                <tr key={player.player_id}>
                                  <td>
                                    <Group>
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        backgroundColor: '#228be6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: 'white'
                                      }}>
                                        {index + 1}
                                      </div>
                                      <Text weight={500}>{player.player_name}</Text>
                                    </Group>
                                  </td>
                                  <td>
                                    <Text weight={600} color="yellow">{player.yellow_cards}</Text>
                                  </td>
                                  <td>
                                    <Text weight={600} color="red">{player.red_cards}</Text>
                                  </td>
                                  <td>
                                    <Text weight={600} color="orange">{player.yellow_cards + player.red_cards}</Text>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </Table>
                      </div>

                      {/* Man of the Match Winners */}
                      {playerStats.some(player => player.man_of_match_count > 0) && (
                        <div>
                          <Text weight={600} size="lg" mb="sm" color="gold">Man of the Match Winners</Text>
                          <Table>
                            <thead>
                              <tr>
                                <th>Player</th>
                                <th>Man of the Match</th>
                                <th>Game</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {playerStats
                                .filter(player => player.man_of_match_count > 0)
                                .flatMap(player => 
                                  player.man_of_match_games.map((game, index) => ({
                                    player,
                                    game,
                                    isFirst: index === 0
                                  }))
                                )
                                .sort((a, b) => new Date(b.game.game_date).getTime() - new Date(a.game.game_date).getTime())
                                .map(({ player, game, isFirst }, index) => (
                                  <tr key={`${player.player_id}-${game.game_id}`}>
                                    <td>
                                      <Group>
                                        {isFirst && (
                                          <div style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            backgroundColor: '#228be6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px'
                                          }}>
                                            ⭐
                                          </div>
                                        )}
                                        <Text weight={500}>{player.player_name}</Text>
                                      </Group>
                                    </td>
                                    <td>
                                      <Text weight={600} color="gold">{player.man_of_match_count}</Text>
                                    </td>
                                    <td>
                                      <Text>{game.game_title}</Text>
                                    </td>
                                    <td>
                                      <Text size="sm" color="dimmed">{game.game_date}</Text>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </Paper>
                {/* Match Report Modal */}
                <Modal
                  opened={matchReportModalOpen}
                  onClose={handleCloseMatchReport}
                  title={selectedGame ? `Match Report: ${selectedGame.title}` : 'Match Report'}
                  size="lg"
                  styles={{
                    title: { fontSize: '1.2rem', fontWeight: 600 },
                    header: { backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }
                  }}
                >
                  {matchReportLoading ? (
                    <Center p="xl">
                      <Loader />
                    </Center>
                  ) : selectedGame ? (
                    <div>
                      {/* Match Header */}
                      <Paper p="md" mb="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
                        <Group position="apart" mb="sm">
                          <div>
                            <Text size="sm" color="dimmed">Date</Text>
                            <Text weight={500}>{selectedGame.date}</Text>
                          </div>
                          <div>
                            <Text size="sm" color="dimmed">Score</Text>
                            <Text weight={500}>
                              {selectedGame.homeScore} - {selectedGame.awayScore} 
                              <Text size="xs" color="dimmed" ml="xs">
                                ({selectedGame.homeAway === 'home' ? 'Home' : 'Away'})
                              </Text>
                            </Text>
                          </div>
                          <div>
                            <Text size="sm" color="dimmed">Result</Text>
                            <Badge 
                              color={
                                selectedGame.outcome === 'Win' ? 'green' : 
                                selectedGame.outcome === 'Loss' ? 'red' : 'yellow'
                              }
                            >
                              {selectedGame.outcome}
                            </Badge>
                          </div>
                        </Group>
                      </Paper>

                      {matchReport ? (
                        <div>
                          {/* Match Summary */}
                          <Paper p="md" mb="md" withBorder>
                            <Text weight={600} size="lg" mb="md">Match Summary</Text>
                            <Grid>
                              <Grid.Col span={3}>
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xl" weight={700} color="green">
                                    {matchReport.summary.totalGoals}
                                  </Text>
                                  <Text size="sm" color="dimmed">Goals</Text>
                                </div>
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xl" weight={700} color="blue">
                                    {matchReport.summary.totalAssists}
                                  </Text>
                                  <Text size="sm" color="dimmed">Assists</Text>
                                </div>
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xl" weight={700} color="yellow">
                                    {matchReport.summary.totalYellowCards}
                                  </Text>
                                  <Text size="sm" color="dimmed">Yellow Cards</Text>
                                </div>
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xl" weight={700} color="red">
                                    {matchReport.summary.totalRedCards}
                                  </Text>
                                  <Text size="sm" color="dimmed">Red Cards</Text>
                                </div>
                              </Grid.Col>
                            </Grid>
                          </Paper>

                          {/* Man of the Match */}
                          {matchReport.summary.manOfTheMatch && (
                            <Paper p="md" mb="md" withBorder style={{ backgroundColor: '#fff3cd', borderColor: '#ffeaa7' }}>
                              <Group>
                                <div style={{ 
                                  backgroundColor: '#FFD700', 
                                  borderRadius: '50%', 
                                  width: 40, 
                                  height: 40, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center' 
                                }}>
                                  <Text size="lg">⭐</Text>
                                </div>
                                <div>
                                  <Text weight={600} size="sm" color="dimmed">Man of the Match</Text>
                                  <Text weight={700} size="lg">{matchReport.summary.manOfTheMatch}</Text>
                                </div>
                              </Group>
                            </Paper>
                          )}

                          {/* Match Events */}
                          <Paper p="md" withBorder>
                            <Text weight={600} size="lg" mb="md">Match Events</Text>
                            
                            {/* First Half */}
                            {matchReport.events.filter(e => e.half === 'first').length > 0 && (
                              <div style={{ marginBottom: '1rem' }}>
                                <Text weight={600} size="sm" color="dimmed" mb="sm">First Half</Text>
                                {matchReport.events
                                  .filter(e => e.half === 'first')
                                  .map((event, index) => (
                                    <div key={event.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      padding: '0.5rem', 
                                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                                      borderRadius: '0.25rem',
                                      marginBottom: '0.25rem'
                                    }}>
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: '0.75rem',
                                        backgroundColor: 
                                          event.event_type === 'goal' ? '#43a047' :
                                          event.event_type === 'assist' ? '#1976d2' :
                                          event.event_type === 'yellow_card' ? '#fbc02d' :
                                          event.event_type === 'red_card' ? '#d32f2f' : '#FFD700'
                                      }}>
                                        <Text size="xs" color="white" weight={600}>
                                          {event.event_type === 'goal' ? '⚽' :
                                           event.event_type === 'assist' ? '🤝' :
                                           event.event_type === 'yellow_card' ? '🟨' :
                                           event.event_type === 'red_card' ? '🟥' : '⭐'}
                                        </Text>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <Text weight={500}>{event.player_name}</Text>
                                        <Text size="xs" color="dimmed">
                                          {event.event_type === 'man_of_the_match' ? 'Man of the Match' :
                                           `min ${event.minute}`}
                                        </Text>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Second Half */}
                            {matchReport.events.filter(e => e.half === 'second').length > 0 && (
                              <div>
                                <Text weight={600} size="sm" color="dimmed" mb="sm">Second Half</Text>
                                {matchReport.events
                                  .filter(e => e.half === 'second')
                                  .map((event, index) => (
                                    <div key={event.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      padding: '0.5rem', 
                                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                                      borderRadius: '0.25rem',
                                      marginBottom: '0.25rem'
                                    }}>
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: '0.75rem',
                                        backgroundColor: 
                                          event.event_type === 'goal' ? '#43a047' :
                                          event.event_type === 'assist' ? '#1976d2' :
                                          event.event_type === 'yellow_card' ? '#fbc02d' :
                                          event.event_type === 'red_card' ? '#d32f2f' : '#FFD700'
                                      }}>
                                        <Text size="xs" color="white" weight={600}>
                                          {event.event_type === 'goal' ? '⚽' :
                                           event.event_type === 'assist' ? '🤝' :
                                           event.event_type === 'yellow_card' ? '🟨' :
                                           event.event_type === 'red_card' ? '🟥' : '⭐'}
                                        </Text>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <Text weight={500}>{event.player_name}</Text>
                                        <Text size="xs" color="dimmed">
                                          {event.event_type === 'man_of_the_match' ? 'Man of the Match' :
                                           `min ${event.minute}`}
                                        </Text>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {matchReport.events.length === 0 && (
                              <Text color="dimmed" align="center" py="md">
                                No match events recorded yet.
                              </Text>
                            )}
                          </Paper>
                        </div>
                      ) : (
                        <Paper p="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
                          <Text color="dimmed" align="center">
                            No match report available for this game yet.
                          </Text>
                        </Paper>
                      )}
                    </div>
                  ) : null}
                </Modal>
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default TeamDetails; 