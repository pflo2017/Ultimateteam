import React, { useState, useEffect } from 'react';
import { 
  Title, 
  Table, 
  Group, 
  Text, 
  Badge, 
  ScrollArea, 
  TextInput, 
  Select,
  LoadingOverlay,
  Paper,
  Grid,
  Card,
  Button,
  ActionIcon,
  Tooltip,
  Center,
  Pagination,
  Alert,
  NativeSelect,
  Box
} from '@mantine/core';
import { IconSearch, IconFilter, IconDownload, IconEye, IconAlertCircle } from '@tabler/icons-react';
import { supabase, adminSupabase } from '../lib/supabase';
import { useDisclosure } from '@mantine/hooks';

// Add a function to check if a table exists in Supabase
const checkTableExists = async (client: any, tableName: string): Promise<boolean> => {
  try {
    const { data, error } = await client.rpc('check_table_exists', { table_name: tableName });
    
    if (error) {
      console.error('Error checking if table exists:', error);
      // Try alternative method if RPC fails
      const { data: tables, error: tablesError } = await client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
      
      if (tablesError) {
        console.error('Error checking tables:', tablesError);
        return false;
      }
      
      return tables && tables.length > 0;
    }
    
    return !!data;
  } catch (e) {
    console.error('Exception checking if table exists:', e);
    return false;
  }
};

// Function to create the monthly_payments table
const createMonthlyPaymentsTable = async (client: any): Promise<boolean> => {
  try {
    // Create table with UUID extension if needed
    const createTableSQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS monthly_payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_paid',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID REFERENCES auth.users(id),
        UNIQUE(player_id, year, month)
      );
      
      -- Add RLS policies
      ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow read access for authenticated users" 
        ON monthly_payments 
        FOR SELECT 
        TO authenticated 
        USING (true);
      
      CREATE POLICY "Allow insert for authenticated users" 
        ON monthly_payments 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
      
      CREATE POLICY "Allow update for authenticated users" 
        ON monthly_payments 
        FOR UPDATE 
        TO authenticated 
        USING (true);
    `;
    
    // Try using the run_sql RPC function
    const { error: createError } = await client.rpc('run_sql', { sql: createTableSQL });
    
    if (createError) {
      console.error('Error creating table via RPC:', createError);
      
      // Try direct SQL if RPC fails (requires service key)
      if (adminSupabase) {
        const { error: directError } = await adminSupabase.from('monthly_payments').select('id').limit(1);
        
        if (directError && directError.code === '42P01') { // Table doesn't exist
          console.error('Table does not exist and could not be created automatically');
          return false;
        }
      } else {
        console.error('No admin client available to create table');
        return false;
      }
    }
    
    return true;
  } catch (e) {
    console.error('Exception creating table:', e);
    return false;
  }
};

// Function to create the players table if it doesn't exist
const createPlayersTable = async (client: any): Promise<boolean> => {
  try {
    // Create table with UUID extension if needed
    const createTableSQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(name)
      );
      
      -- Add RLS policies
      ALTER TABLE players ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow read access for authenticated users" 
        ON players 
        FOR SELECT 
        TO authenticated 
        USING (true);
      
      CREATE POLICY "Allow insert for authenticated users" 
        ON players 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    `;
    
    // Try using the run_sql RPC function
    const { error: createError } = await client.rpc('run_sql', { sql: createTableSQL });
    
    if (createError) {
      console.error('Error creating players table via RPC:', createError);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Exception creating players table:', e);
    return false;
  }
};

// Function to update the foreign key constraint to use CASCADE deletion
const updateForeignKeyConstraint = async (client: any): Promise<boolean> => {
  try {
    const updateConstraintSQL = `
      -- Drop the existing constraint if it exists
      ALTER TABLE IF EXISTS monthly_payments 
      DROP CONSTRAINT IF EXISTS monthly_payments_player_id_fkey;
      
      -- Add the constraint with ON DELETE CASCADE
      ALTER TABLE IF EXISTS monthly_payments 
      ADD CONSTRAINT monthly_payments_player_id_fkey 
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
    `;
    
    const { error } = await client.rpc('run_sql', { sql: updateConstraintSQL });
    
    if (error) {
      console.error('Error updating foreign key constraint:', error);
      return false;
    }
    
    console.log('Successfully updated foreign key constraint to use CASCADE deletion');
    return true;
  } catch (e) {
    console.error('Exception updating foreign key constraint:', e);
    return false;
  }
};

interface Payment {
  id: string;
  player_id: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  year: number;
  month: number;
  status: string;
  payment_method?: string;
  updated_at: string;
  updated_by: string | null;
}

interface PaymentSummary {
  year: number;
  month: number;
  totalPlayers: number;
  paidCount: number;
  unpaidCount: number;
  paidPercentage: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string | null>("2025");
  const [monthFilter, setMonthFilter] = useState<string | null>("6");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [teams, setTeams] = useState<{value: string, label: string}[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 20;

  // Fetch teams for the filter dropdown
  const fetchTeams = async () => {
    try {
      // Get club ID from localStorage (for club admin)
      const clubId = localStorage.getItem('clubId');
      if (!clubId) {
        setTeams([]);
        return;
      }
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .eq('club_id', clubId);
      if (error) throw error;
      if (data) {
        const teamOptions = data.map((team: any) => ({
          value: team.id,
          label: team.name
        }));
        setTeams(teamOptions);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to load teams');
    }
  };

  // Fetch payments based on filters
  const fetchPayments = async () => {
    if (!yearFilter || !monthFilter) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const year = parseInt(yearFilter);
      const month = parseInt(monthFilter);

      console.log(`Fetching payments for ${MONTHS[month-1]} ${year}`);
      
      // Use adminSupabase to bypass RLS if available, otherwise fall back to regular supabase client
      const client = adminSupabase || supabase;

      // First, fetch all teams to create a map of team IDs to names
      const clubId = localStorage.getItem('clubId');
      const { data: teamsData, error: teamsError } = await client
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .eq('club_id', clubId);
      
      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
      }
      
      // Create a map of team IDs to team names
      const teamMap: Record<string, string> = {};
      if (teamsData && teamsData.length > 0) {
        teamsData.forEach((team: any) => {
          teamMap[team.id] = team.name;
        });
      }
      
      console.log('Team map:', teamMap);
      
      // Fetch payments for the selected month/year
      const { data: paymentData, error: paymentError } = await client
        .from('monthly_payments')
        .select('*')
        .eq('year', year)
        .eq('month', month);
      
      if (paymentError) {
        console.error('Error fetching payments:', paymentError);
        setError(`Failed to load payments: ${paymentError.message}`);
        setLoading(false);
        return;
      }
      
      console.log('Payments data:', paymentData);
      
      if (!paymentData || paymentData.length === 0) {
        console.log('No payment data found for the selected period');
        setPayments([]);
        setSummary({
          year,
          month,
          totalPlayers: 0,
          paidCount: 0,
          unpaidCount: 0,
          paidPercentage: 0
        });
        setFilteredPayments([]);
        setTotalPages(1);
        setActivePage(1);
        setLoading(false);
        return;
      }
      
      // Get all player IDs from the payment data
      const playerIds = paymentData.map(payment => payment.player_id);
      
      // Fetch player details with team information in a single query
      const { data: playersWithTeams, error: playersWithTeamsError } = await client
        .from('players')
        .select(`
          id, 
          name,
          team_id,
          teams:team_id (
            id,
            name
          )
        `)
        .in('id', playerIds);
      
      if (playersWithTeamsError) {
        console.error('Error fetching players with teams:', playersWithTeamsError);
      }
      
      // Create a map of player IDs to player info including team data
      const playerMap: Record<string, {name: string, team_id?: string, team_name?: string}> = {};
      
      if (playersWithTeams && playersWithTeams.length > 0) {
        console.log('Players with teams data:', playersWithTeams);
        
        playersWithTeams.forEach((player: any) => {
          playerMap[player.id] = {
            name: player.name || 'Unknown Player',
            team_id: player.team_id,
            team_name: player.teams?.name || 'No Team'
          };
        });
      }
      
      console.log('Player map with teams:', playerMap);
      
      // Transform the payment data to include player names and team info
      const transformedPayments = paymentData.map(payment => {
        const playerInfo = playerMap[payment.player_id] || {};
        console.log(`Player ${payment.player_id} info:`, playerInfo);
        
        // Ensure team_id is a string
        const team_id = playerInfo.team_id ? String(playerInfo.team_id) : null;
        
        return {
          ...payment,
          player_name: playerInfo.name || 'Unknown Player',
          team_id: team_id,
          team_name: playerInfo.team_name || 'No Team',
          // Format the date for display
          updated_at: payment.updated_at ? new Date(payment.updated_at).toLocaleString() : ''
        };
      });
      
      console.log('Transformed payments:', transformedPayments);
      setPayments(transformedPayments);
      
      // Calculate summary statistics
      const totalPlayers = transformedPayments.length;
      const paidCount = transformedPayments.filter(p => p.status === 'paid').length;
      const unpaidCount = totalPlayers - paidCount;
      const paidPercentage = totalPlayers > 0 ? Math.round((paidCount / totalPlayers) * 100) : 0;
      
      setSummary({
        year,
        month,
        totalPlayers,
        paidCount,
        unpaidCount,
        paidPercentage
      });
      
      // Set filtered payments initially to all payments
      setFilteredPayments(transformedPayments);
      
      // Calculate pagination
      setTotalPages(Math.ceil(transformedPayments.length / itemsPerPage));
      setActivePage(1);
      
      // Fetch all teams for the filter dropdown
      fetchTeams();
      
    } catch (error: any) {
      console.error('Error in fetchPayments:', error);
      setError(`An error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to create team assignments for players who don't have them
  const createTeamAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use adminSupabase to bypass RLS if available, otherwise fall back to regular supabase client
      const client = adminSupabase || supabase;
      
      // Get all players
      const { data: players, error: playersError } = await client
        .from('players')
        .select('id, name, team_id')
        .eq('is_active', true);
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        setError(`Failed to fetch players: ${playersError.message}`);
        return;
      }
      
      if (!players || players.length === 0) {
        setError('No players found');
        return;
      }
      
      // Get all teams
      const { data: teams, error: teamsError } = await client
        .from('teams')
        .select('id, name')
        .eq('is_active', true);
      
      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        setError(`Failed to fetch teams: ${teamsError.message}`);
        return;
      }
      
      if (!teams || teams.length === 0) {
        setError('No teams found');
        return;
      }
      
      // Create a set of player IDs that already have team assignments
      const playersWithoutTeams = players.filter(player => !player.team_id);
      
      if (playersWithoutTeams.length === 0) {
        alert('All players already have team assignments');
        return;
      }
      
      // Create assignments for players who don't have them
      const updatedPlayers = [];
      for (const player of playersWithoutTeams) {
        // Assign to a random team
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];
        updatedPlayers.push({
          id: player.id,
          team_id: randomTeam.id
        });
      }
      
      // Update players with team assignments
      const { data: updatedData, error: updateError } = await client
        .from('players')
        .upsert(updatedPlayers)
        .select();
      
      if (updateError) {
        console.error('Error updating player team assignments:', updateError);
        setError(`Failed to update team assignments: ${updateError.message}`);
        return;
      }
      
      alert(`Updated ${updatedData?.length || 0} player team assignments`);
      
      // Refresh the data
      fetchPayments();
      
    } catch (error: any) {
      console.error('Error in createTeamAssignments:', error);
      setError(`An error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters when search term or other filters change
  const applyFilters = () => {
    let filtered = [...payments];
    
    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.player_name?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }
    
    // Apply team filter
    if (teamFilter) {
      filtered = filtered.filter(payment => payment.team_id === teamFilter);
    }
    
    console.log(`Filtered from ${payments.length} to ${filtered.length} payments`);
    
    // Update filtered payments
    setFilteredPayments(filtered);
    
    // Update pagination
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setActivePage(1);
  };

  // Load data when component mounts or filters change
  useEffect(() => {
    fetchTeams();
    fetchPayments();
  }, [yearFilter, monthFilter]);

  // Apply filters when search term or filters change
  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, teamFilter, payments]);

  // Helper to render status badge
  const getStatusBadge = (status: string) => {
    if (status === 'paid') {
      return <Badge color="green">Paid</Badge>;
    } else {
      return <Badge color="red">Unpaid</Badge>;
    }
  };

  // Generate year options (last 3 years to next year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => ({
    value: (currentYear - 2 + i).toString(),
    label: (currentYear - 2 + i).toString()
  }));

  // Add 2025 if it's not already included
  if (!yearOptions.some(option => option.value === "2025")) {
    yearOptions.push({
      value: "2025",
      label: "2025"
    });
  }

  // Sort year options in descending order
  yearOptions.sort((a, b) => parseInt(b.value) - parseInt(a.value));

  // Generate month options
  const monthOptions = MONTHS.map((name, index) => ({
    value: (index + 1).toString(),
    label: name
  }));

  // Create paginated data
  const paginatedPayments = filteredPayments.slice(
    (activePage - 1) * itemsPerPage,
    activePage * itemsPerPage
  );

  // Generate table rows
  const rows = paginatedPayments.map((payment) => (
    <tr key={payment.id}>
      <td>{payment.player_name}</td>
      <td>{payment.team_name || 'No Team'}</td>
      <td>{MONTHS[payment.month - 1]} {payment.year}</td>
      <td>{getStatusBadge(payment.status)}</td>
      <td>{payment.payment_method || '-'}</td>
      <td>{payment.updated_at}</td>
    </tr>
  ));

  return (
    <>
      <Title order={2} mb="md">Payments</Title>
      
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error" 
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
      {!adminSupabase && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Service Key Missing" 
          color="yellow"
          mb="md"
        >
          For full functionality, add REACT_APP_SUPABASE_SERVICE_KEY to your .env.local file.
        </Alert>
      )}
      
      <Grid mb="md">
        <Grid.Col span={4}>
          <Card withBorder p="md">
            <Text weight={500} mb="xs">Period</Text>
            <Group grow>
              <Box>
                <Text size="sm" mb={5}>Year</Text>
                <NativeSelect
                  data={yearOptions}
                  value={yearFilter || ''}
                  onChange={(e) => setYearFilter(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </Box>
              <Box>
                <Text size="sm" mb={5}>Month</Text>
                <NativeSelect
                  data={monthOptions}
                  value={monthFilter || ''}
                  onChange={(e) => setMonthFilter(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </Box>
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={8}>
          <Card withBorder p="md">
            <Group position="apart">
              <Text weight={500} mb="xs">Payment Summary</Text>
            </Group>
            {summary && (
              <Grid>
                <Grid.Col span={3}>
                  <Text size="sm" color="dimmed">Total Players</Text>
                  <Text weight={700} size="xl">{summary.totalPlayers}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="sm" color="dimmed">Paid</Text>
                  <Text weight={700} size="xl" color="green">{summary.paidCount}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="sm" color="dimmed">Unpaid</Text>
                  <Text weight={700} size="xl" color="red">{summary.unpaidCount}</Text>
                </Grid.Col>
                <Grid.Col span={3}>
                  <Text size="sm" color="dimmed">Paid %</Text>
                  <Text weight={700} size="xl">{summary.paidPercentage}%</Text>
                </Grid.Col>
              </Grid>
            )}
          </Card>
        </Grid.Col>
      </Grid>
      
      <Paper withBorder p="md" mb="md">
        <Group position="apart" mb="md">
          <Group align="flex-end" spacing="md">
            <Box>
              <Text size="sm" mb={5}>Search</Text>
              <TextInput
                placeholder="Search players..."
                icon={<IconSearch size={14} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ width: '300px' }}
              />
            </Box>
            
            <Box>
              <Text size="sm" mb={5}>Status</Text>
              <Select
                placeholder="Payment status"
                clearable
                data={[
                  { value: 'paid', label: 'Paid' },
                  { value: 'not_paid', label: 'Unpaid' }
                ]}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                }}
                style={{ width: '150px' }}
                dropdownPosition="bottom"
                zIndex={1000}
              />
            </Box>
            
            <Box>
              <Text size="sm" mb={5}>Team</Text>
              <Select
                placeholder="Filter by team"
                clearable
                searchable
                nothingFound="No teams found"
                data={teams}
                value={teamFilter}
                onChange={(value) => {
                  setTeamFilter(value);
                }}
                style={{ width: '200px' }}
                dropdownPosition="bottom"
                zIndex={1000}
              />
            </Box>
          </Group>
          
          <Button 
            leftIcon={<IconDownload size={16} />}
            variant="outline"
          >
            Export
          </Button>
        </Group>
        
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={loading} overlayBlur={2} />
          
          <ScrollArea>
            <Table striped highlightOnHover>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Payment Method</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <Text weight={500} align="center">
                        {loading ? 'Loading...' : 'No payment records found'}
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </ScrollArea>
          
          {totalPages > 1 && (
            <Center mt="md">
              <Pagination
                total={totalPages}
                value={activePage}
                onChange={setActivePage}
              />
            </Center>
          )}
        </div>
      </Paper>
    </>
  );
};

export default PaymentsPage; 