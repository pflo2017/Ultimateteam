import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Group, 
  Text, 
  Badge, 
  ScrollArea, 
  TextInput, 
  Tabs,
  Select,
  LoadingOverlay,
  Tooltip,
  Button,
  Paper
} from '@mantine/core';
import { IconSearch, IconFilter, IconBug } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface Team {
  id: string;
  name: string;
}

// Define the Player type used in our component
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
  current_payment_status?: string; // From monthly_payments for current month
  club_name?: string;
  last_payment_date?: string | null;
  club_join_date?: string | null;
  birthdate?: string | null;
}

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [teams, setTeams] = useState<{value: string, label: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    fetchPlayers();
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      if (data) {
        const teamOptions = data.map((team: Team) => ({
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

  const fetchPlayers = async () => {
    setLoading(true);
    const debugData: any = {
      timestamp: new Date().toISOString(),
      queries: []
    };
    
    try {
      // Get players with team, parent and club information
      debugData.queries.push({ name: 'players', startTime: new Date().toISOString() });
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
        .eq('is_active', true);
      
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      debugData.players = { 
        data: data, 
        count: data?.length || 0,
        error: error ? error.message : null
      };

      if (error) {
        throw error;
      }

      if (data) {
        // Transform data to include team_name and parent_name
        const playersWithDetails: Player[] = data.map((player: any) => {
          // Safely format dates
          let formattedBirthdate = null;
          let formattedLastPaymentDate = null;
          let formattedClubJoinDate = null;
          
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
            medical_visa_issue_date: player.medical_visa_issue_date,
            payment_status: player.payment_status,
            team_name: player.teams?.name || 'Unknown Team',
            parent_name: player.parents?.name || 'Unknown Parent',
            club_name: player.clubs?.name || 'Unknown Club',
            last_payment_date: formattedLastPaymentDate,
            club_join_date: formattedClubJoinDate,
            birthdate: formattedBirthdate
          };
        });
        
        // Get current month and year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JS months are 0-indexed
        
        // Fetch current month payment statuses from monthly_payments table
        debugData.queries.push({ name: 'monthly_payments', startTime: new Date().toISOString() });
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('monthly_payments')
          .select('player_id, status')
          .eq('year', currentYear)
          .eq('month', currentMonth);
        
        debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
        debugData.payments = { 
          data: paymentsData, 
          count: paymentsData?.length || 0,
          error: paymentsError ? paymentsError.message : null
        };
          
        if (paymentsError) {
          console.error('Error fetching monthly payments:', paymentsError);
        }
        
        // Create a map of player_id to payment status
        const paymentStatusMap: {[key: string]: string} = {};
        if (paymentsData) {
          paymentsData.forEach((payment: any) => {
            paymentStatusMap[payment.player_id] = payment.status;
          });
        }
        
        // Update players with current payment status from monthly_payments
        const updatedPlayers = playersWithDetails.map(player => ({
          ...player,
          current_payment_status: paymentStatusMap[player.id] || player.payment_status
        }));
        
        debugData.transformedPlayers = {
          count: updatedPlayers.length,
          sample: updatedPlayers.slice(0, 2) // Just include first 2 for debugging
        };
        
        setPlayers(updatedPlayers);
      }
    } catch (error: any) {
      console.error('Error fetching players:', error);
      setError('Failed to load players: ' + (error.message || 'Unknown error'));
      debugData.error = {
        message: error.message || 'Unknown error',
        code: error.code,
        details: error.details
      };
    } finally {
      setDebugInfo(debugData);
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Filter players based on search term, active tab, and team filter
  const filteredPlayers = players.filter(player => {
    // Search filter
    const matchesSearch = 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.parent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (player.club_name && player.club_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Get the effective payment status (prioritize current_payment_status)
    const effectiveStatus = player.current_payment_status || player.payment_status;
    
    // Tab filter
    let matchesTab = true;
    if (activeTab === 'paid') {
      matchesTab = effectiveStatus === 'paid';
    } else if (activeTab === 'unpaid') {
      matchesTab = effectiveStatus === 'not_paid' || effectiveStatus === 'unpaid';
    }
    
    // Team filter
    const matchesTeam = teamFilter ? player.team_id === teamFilter : true;
    
    return matchesSearch && matchesTab && matchesTeam;
  });

  const getMedicalVisaBadge = (status: string) => {
    if (status === 'valid') {
      return <Badge color="green">Valid</Badge>;
    } else if (status === 'expired') {
      return <Badge color="red">Expired</Badge>;
    } else {
      return <Badge color="yellow">Pending</Badge>;
    }
  };

  const getPlayerStatusBadge = (player: Player) => {
    // Use current_payment_status if available, otherwise fall back to payment_status
    const status = player.current_payment_status || player.payment_status;
    
    if (status === 'paid') {
      return <Badge color="green">Paid</Badge>;
    } else if (status === 'not_paid' || status === 'unpaid') {
      return <Badge color="red">Unpaid</Badge>;
    } else if (status === 'on_trial') {
      return <Badge color="blue">On Trial</Badge>;
    } else if (status === 'trial_ended') {
      return <Badge color="gray">Trial Ended</Badge>;
    } else {
      return <Badge color="gray">Unknown</Badge>;
    }
  };

  const rows = filteredPlayers.map((player) => (
    <tr key={player.id}>
      <td>{player.name}</td>
      <td>{player.birthdate || '-'}</td>
      <td>{player.team_name}</td>
      <td>{player.parent_name}</td>
      <td>{player.club_name}</td>
      <td>
        {getMedicalVisaBadge(player.medical_visa_status)}
        {player.medical_visa_issue_date && (
          <Tooltip label={`Issued: ${player.medical_visa_issue_date}`}>
            <Text size="xs" color="dimmed" mt={2}>
              {player.medical_visa_issue_date}
            </Text>
          </Tooltip>
        )}
      </td>
      <td>
        {getPlayerStatusBadge(player)}
        {player.last_payment_date && (
          <Tooltip label={`Last payment: ${player.last_payment_date}`}>
            <Text size="xs" color="dimmed" mt={2}>
              {player.last_payment_date}
            </Text>
          </Tooltip>
        )}
      </td>
      <td>{player.club_join_date || '-'}</td>
    </tr>
  ));

  return (
    <div style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} overlayBlur={2} />
      
      <Group position="apart" mb="md">
        <Group>
          <TextInput
            placeholder="Search players..."
            icon={<IconSearch size={14} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            style={{ width: '300px' }}
          />
          
          <Select
            placeholder="Filter by team"
            clearable
            icon={<IconFilter size={14} />}
            data={teams}
            value={teamFilter}
            onChange={setTeamFilter}
            style={{ width: '200px' }}
          />
        </Group>
        
        <Button 
          leftIcon={<IconBug size={16} />}
          variant="outline"
          onClick={() => setShowDebug(!showDebug)}
          size="sm"
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </Button>
      </Group>
      
      {error && (
        <Text color="red" mb="md">
          {error}
        </Text>
      )}
      
      {showDebug && debugInfo && (
        <Paper p="md" mb="md" withBorder>
          <Text weight={500} mb="sm">Debug Information</Text>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Paper>
      )}
      
      <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Players</Tabs.Tab>
          <Tabs.Tab value="paid">Paid</Tabs.Tab>
          <Tabs.Tab value="unpaid">Unpaid</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <thead>
            <tr>
              <th>Name</th>
              <th>Birthdate</th>
              <th>Team</th>
              <th>Parent</th>
              <th>Club</th>
              <th>Medical Visa</th>
              <th>Payment Status</th>
              <th>Club Join Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows
            ) : (
              <tr>
                <td colSpan={8}>
                  <Text weight={500} align="center">
                    No players found
                  </Text>
                  {players.length === 0 && !loading && (
                    <Text align="center" color="dimmed" size="sm" mt="sm">
                      There are no players in the database or an error occurred while loading.
                      {!showDebug && " Click 'Show Debug' to see more information."}
                    </Text>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </ScrollArea>
    </div>
  );
}

export default PlayersPage; 