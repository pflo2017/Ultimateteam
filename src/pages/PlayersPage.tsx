import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Group, 
  Text, 
  Badge, 
  ScrollArea, 
  TextInput, 
  ActionIcon,
  Tabs,
  Select,
  LoadingOverlay
} from '@mantine/core';
import { IconSearch, IconFilter } from '@tabler/icons-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';

interface Player {
  id: string;
  name: string;
  team_id: string;
  parent_id: string;
  is_active: boolean;
  medical_visa_status: string;
  medical_visa_issue_date: string | null;
  player_status: string | null;
  team_name?: string;
  parent_name?: string;
}

export function PlayersPage() {
  const supabase = useSupabaseClient<Database>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [teams, setTeams] = useState<{value: string, label: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        const teamOptions = data.map(team => ({
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
    try {
      // Get players with team and parent information
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
          player_status,
          teams:team_id (name),
          parents:parent_id (name)
        `)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      if (data) {
        // Transform data to include team_name and parent_name
        const playersWithDetails = data.map(player => ({
          ...player,
          team_name: player.teams?.name || 'Unknown Team',
          parent_name: player.parents?.name || 'Unknown Parent'
        }));
        setPlayers(playersWithDetails);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
      setError('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  // Filter players based on search term, active tab, and team filter
  const filteredPlayers = players.filter(player => {
    // Search filter
    const matchesSearch = 
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.parent_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tab filter
    let matchesTab = true;
    if (activeTab === 'paid') {
      matchesTab = player.player_status === 'paid';
    } else if (activeTab === 'unpaid') {
      matchesTab = player.player_status === 'unpaid';
    } else if (activeTab === 'on_trial') {
      matchesTab = player.player_status === 'on_trial';
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

  const getPlayerStatusBadge = (status: string | null) => {
    if (status === 'paid') {
      return <Badge color="green">Paid</Badge>;
    } else if (status === 'unpaid') {
      return <Badge color="red">Unpaid</Badge>;
    } else if (status === 'on_trial') {
      return <Badge color="blue">On Trial</Badge>;
    } else {
      return <Badge color="gray">Unknown</Badge>;
    }
  };

  const rows = filteredPlayers.map((player) => (
    <tr key={player.id}>
      <td>{player.name}</td>
      <td>{player.team_name}</td>
      <td>{player.parent_name}</td>
      <td>{getMedicalVisaBadge(player.medical_visa_status)}</td>
      <td>{getPlayerStatusBadge(player.player_status)}</td>
    </tr>
  ));

  return (
    <div style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} overlayBlur={2} />
      
      {error && (
        <Text color="red" mb="md">
          {error}
        </Text>
      )}
      
      <Group position="apart" mb="md">
        <TextInput
          placeholder="Search players..."
          icon={<IconSearch size={14} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          style={{ width: '300px' }}
        />
        
        <Group>
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
      </Group>
      
      <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Players</Tabs.Tab>
          <Tabs.Tab value="paid">Paid</Tabs.Tab>
          <Tabs.Tab value="unpaid">Unpaid</Tabs.Tab>
          <Tabs.Tab value="on_trial">On Trial</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Parent</th>
              <th>Medical Visa</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows
            ) : (
              <tr>
                <td colSpan={5}>
                  <Text weight={500} align="center">
                    No players found
                  </Text>
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