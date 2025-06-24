import React, { useState, useEffect, useCallback } from 'react';
import { 
  Title, 
  SimpleGrid, 
  Paper, 
  Text, 
  Group, 
  ThemeIcon, 
  Center, 
  Loader,
  Card,
  Select,
  Stack,
  Divider,
  Badge,
  Grid,
  SegmentedControl,
  useMantineTheme
} from '@mantine/core';
import { 
  IconUsers, 
  IconCalendarStats, 
  IconChartBar, 
  IconCash,
  IconClock,
  IconUserCheck,
  IconChartPie,
  IconCalendarTime,
  IconActivity,
  IconTrophy
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  ChartTitle
);

// Types
interface AnalyticsData {
  attendanceRate: number;
  paymentComplianceRate: number;
  playersByTeam: { [teamName: string]: number };
  attendanceByMonth: { [month: string]: number };
  paymentsByMonth: { [month: string]: number };
  activityDistribution: { [type: string]: number };
  medicalVisaStatus: { valid: number; pending: number; expired: number };
  playerGrowth: { [month: string]: number };
  teamPerformance: { [teamName: string]: { attendance: number; payment: number } };
  gameAnalytics: GameAnalytics;
}

interface GameAnalytics {
  summary: {
    totalGames: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    winRate: number;
  };
  games: GameResult[];
  gamesByTeam: { [teamName: string]: GameAnalytics };
}

interface GameResult {
  id: string;
  title: string;
  date: string;
  teamName: string;
  homeScore: number;
  awayScore: number;
  homeAway: 'home' | 'away';
  outcome: 'Win' | 'Loss' | 'Draw';
  clubScore: number;
  opponentScore: number;
}

interface Team {
  id: string;
  name: string;
}

// Define activity interface for TypeScript
interface Activity {
  id: string;
  title: string;
  type: string;
  start_time: string;
  team_id: string;
  is_repeating: boolean;
  repeat_type?: 'daily' | 'weekly' | 'monthly';
  repeat_until?: string;
  is_recurring_instance?: boolean;
  [key: string]: any; // Allow additional properties
}

// Define StatsCard component before it's used
interface StatsCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, description, icon, color }) => {
  return (
    <Paper withBorder p="md" radius="md" shadow="md">
      <Group position="apart" noWrap spacing="xl">
        <div>
          <Text size="xs" color="dimmed" transform="uppercase">
            {title}
          </Text>
          <Text weight={700} size="xl">
            {value}
          </Text>
          <Text size="xs" color="dimmed" mt={5}>
            {description}
          </Text>
        </div>
        <ThemeIcon
          color={color}
          variant="light"
          size={60}
          radius="md"
        >
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
};

const Analytics: React.FC = () => {
  const theme = useMantineTheme();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('3months');
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalTrainings: 0,
    totalGames: 0,
    totalPlayers: 0,
    totalPresences: 0,
    totalAbsences: 0,
    attendanceRate: 0
  });
  
  // Colors for charts
  const chartColors = {
    blue: theme.colors.blue[6],
    green: theme.colors.green[6],
    red: theme.colors.red[6],
    yellow: theme.colors.yellow[6],
    violet: theme.colors.violet[6],
    cyan: theme.colors.cyan[6],
    orange: theme.colors.orange[6],
    pink: theme.colors.pink[6],
  };

  // Define fetchAnalyticsData using useCallback to avoid dependency issues
  const fetchAnalyticsData = useCallback(async (
    clubId: string | null, 
    teamId: string | null, 
    timeRange: string
  ) => {
    if (!clubId) return;
    
    setLoading(true);
    
    try {
      // Calculate date range based on timeRange
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case '1month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case '12months':
          startDate.setMonth(now.getMonth() - 12);
          break;
        default:
          startDate.setMonth(now.getMonth() - 3);
      }
      
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = now.toISOString().split('T')[0];
      
      console.log('Fetching analytics data with filters:', { 
        clubId, 
        teamId, 
        timeRange,
        dateRange: { start: formattedStartDate, end: formattedEndDate }
      });
      
      // 1. Fetch players data
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, team_id, payment_status, medical_visa_status, created_at, teams(name)')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      if (playersError) throw playersError;
      console.log('Players data fetched:', playersData?.length || 0);
      
      // 2. Fetch activities data - improved to include all past activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('id, title, type, start_time, team_id, is_repeating, repeat_type, repeat_until')
        .eq('club_id', clubId)
        .or(`start_time.gte.${formattedStartDate},repeat_until.gte.${formattedStartDate}`)
        .order('start_time');
      
      if (activitiesError) throw activitiesError;
      console.log('Activities data fetched:', activitiesData?.length || 0);
      
      // Process the activities data to handle recurring activities correctly
      // For recurring activities, we need to count all instances that occurred
      let processedActivities = [...activitiesData];
      
      // Handle recurring activities by expanding them to include all instances
      activitiesData.forEach(activity => {
        if (activity.is_repeating && activity.repeat_until) {
          // Get the original activity date
          const now = new Date();
          const startDate = new Date(activity.start_time);
          const repeatUntil = new Date(activity.repeat_until);
          const rangeStart = new Date(formattedStartDate);
          const rangeEnd = new Date(formattedEndDate);
          
          // Track generated dates to avoid duplicates
          const generatedDates = new Set<string>();
          
          // Add the original activity date to the set to prevent duplicates
          const originalDateStr = startDate.toISOString().split('T')[0];
          generatedDates.add(originalDateStr);
          
          // If it's a recurring activity, calculate how many instances should have occurred
          const msPerDay = 24 * 60 * 60 * 1000;
          const msPerWeek = 7 * msPerDay;
          
          // Create instances based on repeat type
          if (activity.repeat_type === 'weekly') {
            // Calculate weeks between start date and now (or repeat_until, whichever is earlier)
            const endPoint = new Date(Math.min(now.getTime(), repeatUntil.getTime(), rangeEnd.getTime()));
            let current = new Date(startDate);
            current.setDate(current.getDate() + 7); // Start from next week
            
            while (current <= endPoint) {
              // Only add if within our date range
              if (current >= rangeStart && current <= rangeEnd) {
                const dateStr = current.toISOString().split('T')[0];
                if (!generatedDates.has(dateStr)) {
                  const newActivity = {
                    ...activity,
                    id: `${activity.id}-${dateStr.replace(/-/g, '')}`,
                    start_time: current.toISOString()
                  };
                  // Add as a separate property that won't cause TypeScript errors
                  (newActivity as any).is_recurring_instance = true;
                  processedActivities.push(newActivity);
                  generatedDates.add(dateStr);
                }
              }
              current.setDate(current.getDate() + 7); // Move to next week
            }
          } else if (activity.repeat_type === 'daily') {
            // Calculate days between start date and now (or repeat_until, whichever is earlier)
            const endPoint = new Date(Math.min(now.getTime(), repeatUntil.getTime(), rangeEnd.getTime()));
            let current = new Date(startDate);
            current.setDate(current.getDate() + 1); // Start from next day
            
            while (current <= endPoint) {
              // Only add if within our date range
              if (current >= rangeStart && current <= rangeEnd) {
                const dateStr = current.toISOString().split('T')[0];
                if (!generatedDates.has(dateStr)) {
                  const newActivity = {
                    ...activity,
                    id: `${activity.id}-${dateStr.replace(/-/g, '')}`,
                    start_time: current.toISOString()
                  };
                  // Add as a separate property that won't cause TypeScript errors
                  (newActivity as any).is_recurring_instance = true;
                  processedActivities.push(newActivity);
                  generatedDates.add(dateStr);
                }
              }
              current.setDate(current.getDate() + 1); // Move to next day
            }
          } else if (activity.repeat_type === 'monthly') {
            // Calculate months between start date and now (or repeat_until, whichever is earlier)
            const endPoint = new Date(Math.min(now.getTime(), repeatUntil.getTime(), rangeEnd.getTime()));
            let current = new Date(startDate);
            current.setMonth(current.getMonth() + 1); // Start from next month
            
            while (current <= endPoint) {
              // Only add if within our date range
              if (current >= rangeStart && current <= rangeEnd) {
                const dateStr = current.toISOString().split('T')[0];
                if (!generatedDates.has(dateStr)) {
                  const newActivity = {
                    ...activity,
                    id: `${activity.id}-${dateStr.replace(/-/g, '')}`,
                    start_time: current.toISOString()
                  };
                  // Add as a separate property that won't cause TypeScript errors
                  (newActivity as any).is_recurring_instance = true;
                  processedActivities.push(newActivity);
                  generatedDates.add(dateStr);
                }
              }
              current.setMonth(current.getMonth() + 1); // Move to next month
            }
          }
        }
      });
      
      console.log('Total activities after processing recurring events:', processedActivities.length);
      
      // Apply team filtering if needed
      const filteredActivities = teamId
        ? processedActivities.filter((activity: any) => activity.team_id === teamId)
        : processedActivities;
      
      // Apply team filtering to players if needed
      const filteredPlayers = teamId 
        ? playersData.filter((player: any) => player.team_id === teamId)
        : playersData;
      
      console.log('Total activities (including recurring):', filteredActivities.length);
      console.log('Filtered players:', filteredPlayers.length);
      
      // 3. Fetch attendance data - improved query
      let attendanceRecords: any[] = [];

      try {
        console.log('Fetching attendance records...');
        
        // Use direct approach - fetch all attendance records for the club
        const { data, error } = await supabase
          .from('activity_attendance')
          .select('*')
          .eq('club_id', clubId);
        
        if (error) throw error;
        attendanceRecords = data || [];
        console.log(`Found ${attendanceRecords.length} attendance records with club_id`);
        
        // If no records found, try without club_id filter (fallback)
        if (attendanceRecords.length === 0) {
          console.log('No records found with club_id, trying without filter');
          const { data: allData, error: allError } = await supabase
            .from('activity_attendance')
            .select('*');
          
          if (allError) throw allError;
          attendanceRecords = allData || [];
          console.log(`Found ${attendanceRecords.length} total attendance records`);
        }
      } catch (attendanceError) {
        console.error('Error fetching attendance records:', attendanceError);
      }

      // 4. Fetch monthly payments data
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('monthly_payments')
        .select('player_id, year, month, status, updated_at')
        .order('year, month');

      if (paymentsError) throw paymentsError;
      console.log('Payments data fetched:', paymentsData?.length || 0);

      // 5. Fetch game activities with scores for game analytics
      console.log('Fetching games with filters:', {
        clubId,
        type: 'game',
        home_score: 'not null',
        away_score: 'not null',
        start_time_gte: formattedStartDate,
        start_time_lte: formattedEndDate
      });
      
      // Build full ISO strings for date filtering
      const startDateTime = formattedStartDate + 'T00:00:00.000Z';
      const endDateTime = formattedEndDate + 'T23:59:59.999Z';
      const { data: gamesDataRaw, error: gamesError } = await supabase
        .from('activities')
        .select('id, title, start_time, team_id, home_away, home_score, away_score')
        .eq('club_id', clubId)
        .eq('type', 'game')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .gte('start_time', startDateTime)
        .lte('start_time', endDateTime)
        .order('start_time', { ascending: false });

      const gamesData = gamesDataRaw || [];
      if (gamesError) {
        console.error('Games fetch error:', gamesError);
      }
      
      console.log('Fetched gamesData (full array):', gamesData);
      console.log('Games data fetched (count):', gamesData.length);
      
      // Log each game in detail
      gamesData.forEach((game: any, index: number) => {
        console.log(`Game ${index + 1}:`, {
          id: game.id,
          title: game.title,
          team_id: game.team_id,
          home_score: game.home_score,
          away_score: game.away_score,
          start_time: game.start_time,
          home_away: game.home_away
        });
      });

      // Create a list of activity IDs for matching attendance records
      const activityIds = filteredActivities.map((activity: any) => activity.id);
      console.log('Activity IDs for attendance matching:', activityIds.length);

      // Filter attendance records based on activity IDs - improved matching
      const relevantAttendance = attendanceRecords.filter((record: any) => {
        try {
          // Extract base activity ID from attendance record
          const recordActivityId = record.activity_id && record.activity_id.toString();
          if (!recordActivityId) return false;
          
          // Check if player is in our filtered players list
          const isRelevantPlayer = filteredPlayers.some(player => 
            player.id === record.player_id
          );
          
          if (!isRelevantPlayer) return false;
          
          // Match against our activity IDs
          const matchingActivity = activityIds.some(actId => {
            if (!actId) return false;
            const activityIdStr = actId.toString();
            
            // Check for exact match
            if (recordActivityId === activityIdStr) return true;
            
            // Check if the activity ID is a prefix of the record ID (for recurring activities with date suffix)
            if (recordActivityId.startsWith(activityIdStr + '-')) return true;
            
            return false;
          });
          
          return matchingActivity;
        } catch (err) {
          console.error('Error matching attendance record:', err, record);
          return false;
        }
      });

      console.log('Relevant attendance records after matching:', relevantAttendance.length);

      // Filter monthly payments by the current month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const currentMonthPayments = paymentsData.filter((payment: any) => {
        const playerInScope = filteredPlayers.some((player: any) => player.id === payment.player_id);
        return playerInScope && payment.month === currentMonth && payment.year === currentYear;
      });

      const paidCount = currentMonthPayments.filter((payment: any) => payment.status === 'paid').length;
      const paymentComplianceRate = filteredPlayers.length > 0 
        ? (paidCount / filteredPlayers.length) * 100 
        : 0;

      // Calculate attendance rate from all marked attendances
      const totalAttendanceRecords = relevantAttendance.length;
      const presentCount = relevantAttendance.filter((record: any) => 
        record.status === 'present'
      ).length;

      // Calculate attendance rate based on real attendance data
      let attendanceRate = 0;
      if (totalAttendanceRecords > 0) {
        attendanceRate = (presentCount / totalAttendanceRecords) * 100;
      }

      console.log('Attendance calculation:', { 
        totalRecords: totalAttendanceRecords, 
        presentCount, 
        rate: attendanceRate.toFixed(2) 
      });
      
      // Calculate players by team
      const playersByTeam: { [teamName: string]: number } = {};
      filteredPlayers.forEach((player: any) => {
        const teamName = player.teams?.name || 'Unknown Team';
        playersByTeam[teamName] = (playersByTeam[teamName] || 0) + 1;
      });
      
      // Calculate attendance by month
      const attendanceByMonth: { [month: string]: number } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Process each attendance record and match it with an activity
      relevantAttendance.forEach((record: any) => {
        try {
          // Find the corresponding activity for this attendance record
          const activity = filteredActivities.find((a: any) => {
            const activityId = a.id.toString();
            const recordId = record.activity_id.toString();
            return activityId === recordId || recordId.startsWith(activityId + '-');
          });
          
          if (activity && record.status === 'present') {
            const date = new Date(activity.start_time);
            const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
            attendanceByMonth[monthKey] = (attendanceByMonth[monthKey] || 0) + 1;
          }
        } catch (err) {
          console.error('Error processing attendance record for chart:', err);
        }
      });
      
      // Calculate payments by month
      const paymentsByMonth: { [month: string]: number } = {};
      
      paymentsData.forEach((payment: any) => {
        const playerInScope = filteredPlayers.some((player: any) => player.id === payment.player_id);
        if (playerInScope && payment.status === 'paid') {
          const monthKey = `${months[payment.month - 1]} ${payment.year}`;
          paymentsByMonth[monthKey] = (paymentsByMonth[monthKey] || 0) + 1;
        }
      });
      
      // Calculate activity distribution
      const activityDistribution: { [type: string]: number } = {};
      
      filteredActivities.forEach((activity: any) => {
        const type = activity.type || 'other';
        activityDistribution[type] = (activityDistribution[type] || 0) + 1;
      });
      
      console.log('Activity distribution by type:', activityDistribution);
      
      // Calculate medical visa status
      const medicalVisaStatus = {
        valid: filteredPlayers.filter((player: any) => player.medical_visa_status === 'valid').length,
        pending: filteredPlayers.filter((player: any) => player.medical_visa_status === 'pending').length,
        expired: filteredPlayers.filter((player: any) => player.medical_visa_status === 'expired').length,
      };
      
      // Calculate player growth by month
      const playerGrowth: { [month: string]: number } = {};
      
      filteredPlayers.forEach((player: any) => {
        const joinDate = new Date(player.created_at);
        const monthKey = `${months[joinDate.getMonth()]} ${joinDate.getFullYear()}`;
        playerGrowth[monthKey] = (playerGrowth[monthKey] || 0) + 1;
      });
      
      // Calculate team performance
      const teamPerformance: { [teamName: string]: { attendance: number; payment: number } } = {};
      
      // Group players by team
      const playersByTeamId: { [teamId: string]: any[] } = {};
      filteredPlayers.forEach((player: any) => {
        if (!playersByTeamId[player.team_id]) {
          playersByTeamId[player.team_id] = [];
        }
        playersByTeamId[player.team_id].push(player);
      });
      
      // Calculate attendance and payment rates per team
      Object.entries(playersByTeamId).forEach(([teamId, teamPlayers]) => {
        const teamActivities = filteredActivities.filter((activity: any) => activity.team_id === teamId);
        const teamActivityIds = teamActivities.map((activity: any) => activity.id);
        
        const teamAttendance = relevantAttendance.filter((record: any) => 
          teamActivityIds.some(id => id.toString() === record.activity_id.toString()) && 
          teamPlayers.some((player: any) => player.id === record.player_id)
        );
        
        const teamPresentCount = teamAttendance.filter((record: any) => record.status === 'present').length;
        const teamAttendanceRate = teamAttendance.length > 0 
          ? (teamPresentCount / teamAttendance.length) * 100 
          : 0;
        
        const teamCurrentMonthPayments = paymentsData.filter((payment: any) => {
          const playerInTeam = teamPlayers.some((player: any) => player.id === payment.player_id);
          return playerInTeam && payment.month === currentMonth && payment.year === currentYear;
        });
        
        const teamPaidCount = teamCurrentMonthPayments.filter((payment: any) => payment.status === 'paid').length;
        const teamPaymentRate = teamPlayers.length > 0 
          ? (teamPaidCount / teamPlayers.length) * 100 
          : 0;
        
        // Find team name
        const team = teams.find((t) => t.id === teamId);
        const teamName = team ? team.name : 'Unknown Team';
        
        teamPerformance[teamName] = {
          attendance: teamAttendanceRate,
          payment: teamPaymentRate
        };
      });
      
      // 6. Process game analytics
      const gameResults: GameResult[] = [];
      const gamesByTeam: { [teamName: string]: GameAnalytics } = {};
      
      // Initialize team-specific analytics
      teams.forEach(team => {
        gamesByTeam[team.name] = {
          summary: { totalGames: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0 },
          games: [],
          gamesByTeam: {}
        };
      });
      
      // Process each game
      gamesData.forEach((game: any) => {
        const homeScore = game.home_score || 0;
        const awayScore = game.away_score || 0;
        const homeAway = game.home_away || 'home';
        // Map team name manually using the teams array
        const teamName = teams.find(t => t.id === game.team_id)?.name || 'Unknown Team';
        // Determine club's score and opponent's score based on home/away
        let clubScore: number;
        let opponentScore: number;
        let outcome: 'Win' | 'Loss' | 'Draw';
        if (homeAway === 'home') {
          clubScore = homeScore;
          opponentScore = awayScore;
          if (homeScore > awayScore) outcome = 'Win';
          else if (homeScore < awayScore) outcome = 'Loss';
          else outcome = 'Draw';
        } else {
          clubScore = awayScore;
          opponentScore = homeScore;
          if (awayScore > homeScore) outcome = 'Win';
          else if (awayScore < homeScore) outcome = 'Loss';
          else outcome = 'Draw';
        }
        const gameResult: GameResult = {
          id: game.id,
          title: game.title,
          date: game.start_time,
          teamName,
          homeScore,
          awayScore,
          homeAway,
          outcome,
          clubScore,
          opponentScore
        };
        gameResults.push(gameResult);
        // Update team-specific analytics
        if (gamesByTeam[teamName]) {
          gamesByTeam[teamName].games.push(gameResult);
          gamesByTeam[teamName].summary.totalGames++;
          switch (outcome) {
            case 'Win':
              gamesByTeam[teamName].summary.totalWins++;
              break;
            case 'Loss':
              gamesByTeam[teamName].summary.totalLosses++;
              break;
            case 'Draw':
              gamesByTeam[teamName].summary.totalDraws++;
              break;
          }
        }
      });
      // --- Add frontend filtering for selected team ---
      let filteredGameResults = gameResults;
      let filteredGamesByTeam = gamesByTeam;
      if (teamId) {
        const selectedTeamName = teams.find(t => t.id === teamId)?.name;
        filteredGameResults = gameResults.filter(game => game.teamName === selectedTeamName);
        filteredGamesByTeam = {};
        if (selectedTeamName && gamesByTeam[selectedTeamName]) {
          filteredGamesByTeam[selectedTeamName] = gamesByTeam[selectedTeamName];
        }
      }
      // --- End frontend filtering ---
      // Calculate overall summary
      const totalGames = filteredGameResults.length;
      const totalWins = filteredGameResults.filter(game => game.outcome === 'Win').length;
      const totalLosses = filteredGameResults.filter(game => game.outcome === 'Loss').length;
      const totalDraws = filteredGameResults.filter(game => game.outcome === 'Draw').length;
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
      // Calculate win rates for each team
      Object.keys(filteredGamesByTeam).forEach(teamName => {
        const teamData = filteredGamesByTeam[teamName];
        if (teamData.summary.totalGames > 0) {
          teamData.summary.winRate = (teamData.summary.totalWins / teamData.summary.totalGames) * 100;
        }
      });
      const gameAnalytics: GameAnalytics = {
        summary: {
          totalGames,
          totalWins,
          totalLosses,
          totalDraws,
          winRate
        },
        games: filteredGameResults,
        gamesByTeam: filteredGamesByTeam
      };
      
      console.log('Game analytics processed:', {
        totalGames,
        totalWins,
        totalLosses,
        totalDraws,
        winRate: winRate.toFixed(1) + '%'
      });
      
      // Set analytics data
      setAnalyticsData({
        attendanceRate,
        paymentComplianceRate,
        playersByTeam,
        attendanceByMonth,
        paymentsByMonth,
        activityDistribution,
        medicalVisaStatus,
        playerGrowth,
        teamPerformance,
        gameAnalytics
      });
      
      // Update statistics display
      setStats({
        totalActivities: filteredActivities.length,
        totalTrainings: filteredActivities.filter((activity: any) => activity.type === 'training').length,
        totalGames: filteredActivities.filter((activity: any) => activity.type === 'game').length,
        totalPlayers: filteredPlayers.length,
        totalPresences: presentCount,
        totalAbsences: totalAttendanceRecords - presentCount,
        attendanceRate: attendanceRate
      });
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, [teams]); // Add teams as a dependency since it's used inside the function
  
  // Define fetchTeams using useCallback
  const fetchTeams = useCallback(async (clubId: string | null) => {
    if (!clubId) return;
    
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, []);
  
  useEffect(() => {
    // Get club ID from localStorage
    const storedClubId = localStorage.getItem('clubId');
    const storedClubName = localStorage.getItem('clubName');
    setClubId(storedClubId);
    setClubName(storedClubName);
    
    if (storedClubId) {
      fetchTeams(storedClubId);
      // Don't call fetchAnalyticsData here
    }
  }, [fetchTeams]); // Only depend on fetchTeams
  
  useEffect(() => {
    if (clubId) {
      fetchAnalyticsData(clubId, selectedTeam, timeRange);
    }
  }, [clubId, selectedTeam, timeRange, fetchAnalyticsData]);

  if (loading) {
    return (
      <Center p="xl">
        <Loader size="lg" />
        <Text mt="md">Loading analytics data...</Text>
      </Center>
    );
  }

  return (
    <>
      <Title order={2} mb="md">
        {clubName ? `${clubName} Analytics` : 'Club Analytics'}
      </Title>
      
      <Group position="apart" mb="md">
        <Select
          label="Filter by team"
          placeholder="All teams"
          clearable
          data={teams.map((team) => ({ value: team.id, label: team.name }))}
          value={selectedTeam}
          onChange={setSelectedTeam}
          style={{ width: 250 }}
        />
        
        <SegmentedControl
          value={timeRange}
          onChange={setTimeRange}
          data={[
            { label: '1 Month', value: '1month' },
            { label: '3 Months', value: '3months' },
            { label: '6 Months', value: '6months' },
            { label: '12 Months', value: '12months' },
          ]}
        />
      </Group>
      
      {/* Key Metrics */}
      <SimpleGrid cols={4} spacing="md" mb="md">
        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Total Players
              </Text>
              <Text weight={700} size="xl">
                {analyticsData ? Object.values(analyticsData.playersByTeam).reduce((sum, count) => sum + count, 0) : 0}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={38} radius="md">
              <IconUsers size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Active players in your club
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Attendance Rate
              </Text>
              <Text weight={700} size="xl">
                {analyticsData ? `${Math.round(analyticsData.attendanceRate)}%` : '0%'}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size={38} radius="md">
              <IconUserCheck size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Average attendance rate
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Payment Rate
              </Text>
              <Text weight={700} size="xl">
                {analyticsData ? `${Math.round(analyticsData.paymentComplianceRate)}%` : '0%'}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={38} radius="md">
              <IconCash size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            Current month payment compliance
          </Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group position="apart">
            <div>
              <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                Win Rate
              </Text>
              <Text weight={700} size="xl">
                {analyticsData ? `${analyticsData.gameAnalytics.summary.winRate.toFixed(1)}%` : '0%'}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size={38} radius="md">
              <IconTrophy size={22} />
            </ThemeIcon>
          </Group>
          <Text size="xs" color="dimmed" mt="xs">
            {analyticsData ? `${analyticsData.gameAnalytics.summary.totalGames} games played` : '0 games played'}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Charts Section */}
      <SimpleGrid cols={2} spacing="md" mb="md">
        {/* Attendance Trend */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Attendance Trend</Text>
            </Group>
          </Card.Section>
          
          <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
            {analyticsData && Object.keys(analyticsData.attendanceByMonth).length > 0 ? (
              <Line
                data={{
                  labels: Object.keys(analyticsData.attendanceByMonth),
                  datasets: [
                    {
                      label: 'Presences',
                      data: Object.values(analyticsData.attendanceByMonth),
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
                      title: {
                        display: true,
                        text: 'Number of Presences',
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
        
        {/* Payment Trend */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Payment Trend</Text>
            </Group>
          </Card.Section>
          
          <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
            {analyticsData && Object.keys(analyticsData.paymentsByMonth).length > 0 ? (
              <Bar
                data={{
                  labels: Object.keys(analyticsData.paymentsByMonth),
                  datasets: [
                    {
                      label: 'Paid Players',
                      data: Object.values(analyticsData.paymentsByMonth),
                      backgroundColor: chartColors.green,
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
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Number of Players',
                      },
                    },
                  },
                }}
              />
            ) : (
              <Center style={{ height: '100%' }}>
                <Text color="dimmed">No payment data available</Text>
              </Center>
            )}
          </div>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={2} spacing="md" mb="md">
        {/* Activity Distribution */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Activity Distribution</Text>
            </Group>
          </Card.Section>
          
          <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
            {analyticsData && Object.keys(analyticsData.activityDistribution).length > 0 ? (
              <Doughnut
                data={{
                  labels: Object.keys(analyticsData.activityDistribution).map(
                    type => type.charAt(0).toUpperCase() + type.slice(1)
                  ),
                  datasets: [
                    {
                      data: Object.values(analyticsData.activityDistribution),
                      backgroundColor: [
                        chartColors.blue,
                        chartColors.green,
                        chartColors.orange,
                        chartColors.violet,
                        chartColors.cyan,
                        chartColors.pink,
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
        
        {/* Medical Visa Status */}
        <Card withBorder p="md" radius="md">
          <Card.Section withBorder inheritPadding py="xs">
            <Group position="apart">
              <Text weight={500}>Medical Visa Status</Text>
            </Group>
          </Card.Section>
          
          <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
            {analyticsData && (
              analyticsData.medicalVisaStatus.valid > 0 || 
              analyticsData.medicalVisaStatus.pending > 0 || 
              analyticsData.medicalVisaStatus.expired > 0
            ) ? (
              <Pie
                data={{
                  labels: ['Valid', 'Pending', 'Expired'],
                  datasets: [
                    {
                      data: [
                        analyticsData.medicalVisaStatus.valid,
                        analyticsData.medicalVisaStatus.pending,
                        analyticsData.medicalVisaStatus.expired,
                      ],
                      backgroundColor: [
                        chartColors.green,
                        chartColors.yellow,
                        chartColors.red,
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
                <Text color="dimmed">No medical visa data available</Text>
              </Center>
            )}
          </div>
        </Card>
      </SimpleGrid>

      {/* Team Performance */}
      <Card withBorder p="md" radius="md" mb="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Group position="apart">
            <Text weight={500}>Team Performance</Text>
          </Group>
        </Card.Section>
        
        <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
          {analyticsData && Object.keys(analyticsData.teamPerformance).length > 0 ? (
            <Bar
              data={{
                labels: Object.keys(analyticsData.teamPerformance),
                datasets: [
                  {
                    label: 'Attendance Rate',
                    data: Object.values(analyticsData.teamPerformance).map(team => team.attendance),
                    backgroundColor: chartColors.blue,
                  },
                  {
                    label: 'Payment Rate',
                    data: Object.values(analyticsData.teamPerformance).map(team => team.payment),
                    backgroundColor: chartColors.green,
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
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                      display: true,
                      text: 'Rate (%)',
                    },
                  },
                },
              }}
            />
          ) : (
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">No team performance data available</Text>
            </Center>
          )}
        </div>
      </Card>

      {/* Players by Team */}
      <Card withBorder p="md" radius="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Group position="apart">
            <Text weight={500}>Players by Team</Text>
          </Group>
        </Card.Section>
        
        <div style={{ height: 300, position: 'relative', marginTop: 20 }}>
          {analyticsData && Object.keys(analyticsData.playersByTeam).length > 0 ? (
            <Bar
              data={{
                labels: Object.keys(analyticsData.playersByTeam),
                datasets: [
                  {
                    label: 'Number of Players',
                    data: Object.values(analyticsData.playersByTeam),
                    backgroundColor: chartColors.violet,
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
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Number of Players',
                    },
                  },
                },
              }}
            />
          ) : (
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">No player distribution data available</Text>
            </Center>
          )}
        </div>
      </Card>

      <SimpleGrid cols={2} spacing="md" mb={20}>
        <StatsCard
          title="Activities"
          value={stats.totalActivities.toString()}
          description={`${stats.totalTrainings} Trainings, ${stats.totalGames} Games (including recurring)`}
          icon={<IconActivity size={24} />}
          color="blue"
        />
        <StatsCard
          title="Attendance"
          value={`${Math.round(stats.attendanceRate)}%`}
          description={`${stats.totalPresences} Presences, ${stats.totalAbsences} Absences`}
          icon={<IconUsers size={24} />}
          color="green"
        />
      </SimpleGrid>

      {/* Game Analytics Section */}
      {analyticsData && (
        analyticsData.gameAnalytics.summary.totalGames > 0 ? (
          <>
            {/* Game Performance Summary */}
            <Card withBorder p="md" radius="md" mb="md">
              <Card.Section withBorder inheritPadding py="xs">
                <Group position="apart">
                  <Text weight={500}>Game Performance Summary</Text>
                  <Badge color="blue" size="lg">
                    {analyticsData.gameAnalytics.summary.totalGames} Games
                  </Badge>
                </Group>
              </Card.Section>
              
              <SimpleGrid cols={4} spacing="md" mt="md">
                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Total Wins
                      </Text>
                      <Text weight={700} size="xl" color="green">
                        {analyticsData.gameAnalytics.summary.totalWins}
                      </Text>
                    </div>
                    <ThemeIcon color="green" variant="light" size={38} radius="md">
                      <IconTrophy size={22} />
                    </ThemeIcon>
                  </Group>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Total Losses
                      </Text>
                      <Text weight={700} size="xl" color="red">
                        {analyticsData.gameAnalytics.summary.totalLosses}
                      </Text>
                    </div>
                    <ThemeIcon color="red" variant="light" size={38} radius="md">
                      <IconChartBar size={22} />
                    </ThemeIcon>
                  </Group>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Total Draws
                      </Text>
                      <Text weight={700} size="xl" color="yellow">
                        {analyticsData.gameAnalytics.summary.totalDraws}
                      </Text>
                    </div>
                    <ThemeIcon color="yellow" variant="light" size={38} radius="md">
                      <IconChartPie size={22} />
                    </ThemeIcon>
                  </Group>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group position="apart">
                    <div>
                      <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Win Rate
                      </Text>
                      <Text weight={700} size="xl" color="blue">
                        {analyticsData.gameAnalytics.summary.winRate.toFixed(1)}%
                      </Text>
                    </div>
                    <ThemeIcon color="blue" variant="light" size={38} radius="md">
                      <IconChartBar size={22} />
                    </ThemeIcon>
                  </Group>
                </Paper>
              </SimpleGrid>
            </Card>

            {/* Game Results List */}
            <Card withBorder p="md" radius="md" mb="md">
              <Card.Section withBorder inheritPadding py="xs">
                <Group position="apart">
                  <Text weight={500}>Game Results</Text>
                  <Text size="sm" color="dimmed">
                    {analyticsData.gameAnalytics.games.length} games in selected period
                  </Text>
                </Group>
              </Card.Section>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {analyticsData.gameAnalytics.games.map((game) => (
                  <Paper 
                    key={game.id} 
                    withBorder 
                    p="md" 
                    radius="md" 
                    mb="xs"
                    sx={(theme) => ({
                      borderLeft: `4px solid ${
                        game.outcome === 'Win' 
                          ? theme.colors.green[6] 
                          : game.outcome === 'Loss' 
                          ? theme.colors.red[6] 
                          : theme.colors.yellow[6]
                      }`
                    })}
                  >
                    <Group position="apart" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Text weight={600} size="sm" mb="xs">
                          {game.title}
                        </Text>
                        <Group spacing="md" mb="xs">
                          <Text size="xs" color="dimmed">
                            {new Date(game.date).toLocaleDateString()}
                          </Text>
                          <Text size="xs" color="dimmed">
                            {game.teamName}
                          </Text>
                          <Badge 
                            size="xs" 
                            color={game.homeAway === 'home' ? 'blue' : 'orange'}
                          >
                            {game.homeAway === 'home' ? 'Home Game' : 'Away Game'}
                          </Badge>
                        </Group>
                        <Text size="lg" weight={700}>
                          {game.clubScore} - {game.opponentScore}
                        </Text>
                      </div>
                      
                      <Badge 
                        size="lg"
                        color={
                          game.outcome === 'Win' 
                            ? 'green' 
                            : game.outcome === 'Loss' 
                            ? 'red' 
                            : 'yellow'
                        }
                        variant="filled"
                      >
                        {game.outcome}
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </div>
            </Card>

            {/* Team Performance by Games */}
            {Object.keys(analyticsData.gameAnalytics.gamesByTeam).length > 0 && (
              <Card withBorder p="md" radius="md" mb="md">
                <Card.Section withBorder inheritPadding py="xs">
                  <Text weight={500}>Team Performance by Games</Text>
                </Card.Section>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {Object.entries(analyticsData.gameAnalytics.gamesByTeam)
                    .filter(([teamName, data]) => data.summary.totalGames > 0)
                    .map(([teamName, data]) => (
                      <Paper key={teamName} withBorder p="md" radius="md" mb="xs">
                        <Group position="apart" align="center">
                          <div>
                            <Text weight={600} size="sm" mb="xs">
                              {teamName}
                            </Text>
                            <Group spacing="lg">
                              <Text size="xs" color="dimmed">
                                Games: {data.summary.totalGames}
                              </Text>
                              <Text size="xs" color="green">
                                Wins: {data.summary.totalWins}
                              </Text>
                              <Text size="xs" color="red">
                                Losses: {data.summary.totalLosses}
                              </Text>
                              <Text size="xs" color="yellow">
                                Draws: {data.summary.totalDraws}
                              </Text>
                            </Group>
                          </div>
                          
                          <div style={{ textAlign: 'right' }}>
                            <Text weight={700} size="lg" color="blue">
                              {data.summary.winRate.toFixed(1)}%
                            </Text>
                            <Text size="xs" color="dimmed">
                              Win Rate
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card withBorder p="md" radius="md" mb="md">
            <Text align="center" color="dimmed">
              No games found for the selected team in this period.
            </Text>
          </Card>
        )
      )}

      <SimpleGrid cols={2} spacing="md" mb={20}>
        <StatsCard
          title="Activities"
          value={stats.totalActivities.toString()}
          description={`${stats.totalTrainings} Trainings, ${stats.totalGames} Games (including recurring)`}
          icon={<IconActivity size={24} />}
          color="blue"
        />
        <StatsCard
          title="Attendance"
          value={`${Math.round(stats.attendanceRate)}%`}
          description={`${stats.totalPresences} Presences, ${stats.totalAbsences} Absences`}
          icon={<IconUsers size={24} />}
          color="green"
        />
      </SimpleGrid>
    </>
  );
};

export default Analytics; 