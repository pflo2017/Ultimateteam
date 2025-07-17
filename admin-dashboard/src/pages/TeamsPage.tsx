import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title,
  Table,
  Group,
  Text,
  Badge,
  Button,
  TextInput,
  ActionIcon,
  Paper,
  Loader,
  Center,
  Tooltip,
  Modal,
  Stack,
  Select,
  Tabs,
  Avatar,
  Box
} from '@mantine/core';
import {
  IconSearch,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUsers,
  IconEye
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



const TeamsPage: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('active');
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  
  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  
  useEffect(() => {
    // Get club ID from localStorage (for club admin)
    const id = localStorage.getItem('clubId');
    const name = localStorage.getItem('clubName');
    setClubId(id);
    setClubName(name);
    
    fetchTeams();
  }, [activeTab]);
  
  const fetchTeams = async () => {
    try {
      setLoading(true);
      
      // Get club ID from localStorage (for club admin)
      const clubId = localStorage.getItem('clubId');
      
      if (!clubId) {
        throw new Error('No club ID found. Please log in again.');
      }
      
      // Build query to fetch teams for this club
      let query = supabase
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
        .eq('club_id', clubId);
      
      // Filter by active status if tab is set
      if (activeTab === 'active') {
        query = query.eq('is_active', true);
      } else if (activeTab === 'inactive') {
        query = query.eq('is_active', false);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        // Check if error is due to expired token
        if (error.message.includes('JWT')) {
          console.error('JWT token error:', error);
          notifications.show({
            title: 'Session Expired',
            message: 'Your session has expired. Please refresh the page.',
            color: 'yellow'
          });
        }
        throw error;
      }
      
      if (data) {
        // Get player counts for each team
        const teamsWithCounts = await Promise.all(
          data.map(async (team: any) => {
            // Get player count
            const { count: playerCount, error: playerError } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id)
              .eq('is_active', true);
              
            if (playerError) console.error('Error fetching player count:', playerError);
            
            // Initialize coach variables
            let coachNames: string[] = [];
            let coachCount = 0;
            
            // Check for direct coach assignment
            if (team.coach_id) {
              const { data: directCoach, error: directCoachError } = await supabase
                .from('coaches')
                .select('id, name')
                .eq('id', team.coach_id)
                .single();
                
              if (directCoachError) {
                console.error('Error fetching direct coach:', directCoachError);
              } else if (directCoach && directCoach.name) {
                coachNames.push(directCoach.name);
              }
            }
            
            // Check for coaches in team_coaches table
            const { data: teamCoachesData, error: teamCoachesError } = await supabase
              .from('team_coaches')
              .select('coach_id')
              .eq('team_id', team.id);
            
            if (teamCoachesError) {
              console.error('Error fetching team_coaches:', teamCoachesError);
            }
            
            // Extract coach IDs
            const coachIds = teamCoachesData?.map(item => item.coach_id) || [];
            
            // If we have coach IDs, fetch their names from coaches table
            if (coachIds.length > 0) {
              const { data: coachesData, error: coachesError } = await supabase
                .from('coaches')
                .select('id, name')
                .in('id', coachIds);
                
              if (coachesError) {
                console.error('Error fetching coach details:', coachesError);
              } else if (coachesData) {
                const names = coachesData.map(coach => coach.name);
                coachNames = [...coachNames, ...names];
              }
            }
            
            coachCount = coachNames.length;
            
            // Fix: Access club name correctly - clubs might be an array or an object
            let clubName = 'Unknown';
            if (team.clubs) {
              // If it's an array, take the first item
              if (Array.isArray(team.clubs) && team.clubs.length > 0) {
                clubName = team.clubs[0].name;
              } 
              // If it's an object with a name property
              else if (typeof team.clubs === 'object' && team.clubs.name) {
                clubName = team.clubs.name;
              }
            }
            
            return {
              ...team,
              club_name: clubName,
              player_count: playerCount || 0,
              coach_count: coachCount,
              coach_names: coachNames
            };
          })
        );
        
        setTeams(teamsWithCounts);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load teams. Please try again.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateTeam = async () => {
    try {
      if (!teamName.trim()) {
        notifications.show({
          title: 'Error',
          message: 'Team name is required',
          color: 'red'
        });
        return;
      }
      
      if (!clubId) {
        notifications.show({
          title: 'Error',
          message: 'No club ID found. Please log in again.',
          color: 'red'
        });
        return;
      }
      
      // Create the new team
      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: teamName,
          club_id: clubId,
          is_active: true
        })
        .select();
        
      if (error) throw error;
      
      // Close modal and reset form
      setCreateModalOpen(false);
      setTeamName('');
      
      // Refresh teams list
      fetchTeams();
      
      notifications.show({
        title: 'Success',
        message: 'Team created successfully',
        color: 'green'
      });
    } catch (error) {
      console.error('Error creating team:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create team. Please try again.',
        color: 'red'
      });
    }
  };
  
  const handleToggleTeamStatus = async (teamId: string, currentStatus: boolean) => {
    try {
      // Update the team status
      const { error } = await supabase
        .from('teams')
        .update({ is_active: !currentStatus })
        .eq('id', teamId);
        
      if (error) throw error;
      
      // Refresh teams list
      fetchTeams();
      
      notifications.show({
        title: 'Success',
        message: `Team ${currentStatus ? 'deactivated' : 'activated'} successfully`,
        color: 'green'
      });
    } catch (error) {
      console.error('Error updating team status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update team status. Please try again.',
        color: 'red'
      });
    }
  };

  const handleViewTeam = (team: Team) => {
    navigate(`/admin/teams/${team.id}`);
  };


  
  // Filter teams based on search term
  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <>
      <Title order={2} mb="md">
        {clubName ? `${clubName} Teams` : 'Teams'}
      </Title>
      
      <Paper p="md" mb="md">
        <Group position="apart">
          <TextInput
            placeholder="Search teams by name..."
            icon={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flexGrow: 1 }}
          />
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Team
          </Button>
        </Group>
      </Paper>
      
      <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Teams</Tabs.Tab>
          <Tabs.Tab value="active">Active</Tabs.Tab>
          <Tabs.Tab value="inactive">Inactive</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      
      {loading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : filteredTeams.length === 0 ? (
        <Text align="center" mt="lg" color="dimmed">
          No teams found. {searchTerm ? 'Try a different search term.' : 'Create a new team to get started.'}
        </Text>
      ) : (
        <Table striped>
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Players</th>
              <th>Coaches</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((team) => {
              return (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{team.player_count}</td>
                  <td>
                    {team.coach_names && team.coach_names.length > 0 ? (
                      <Tooltip label={team.coach_names.join(', ')}>
                        <Text>{team.coach_names.map(name => name.replace(' (direct)', '')).join(', ')}</Text>
                      </Tooltip>
                    ) : (
                      <Text color="dimmed">No coaches assigned</Text>
                    )}
                  </td>
                  <td>
                    <Badge color={team.is_active ? 'green' : 'gray'}>
                      {team.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </td>
                  <td>
                    <Group spacing="xs">
                      <Tooltip label="View Team Details">
                        <ActionIcon 
                          color="blue"
                          onClick={() => handleViewTeam(team)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit Team">
                        <ActionIcon color="blue">
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={team.is_active ? 'Deactivate Team' : 'Activate Team'}>
                        <ActionIcon 
                          color={team.is_active ? 'red' : 'green'}
                          onClick={() => handleToggleTeamStatus(team.id, team.is_active)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      
      {/* Create Team Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Team"
      >
        <Stack>
          <TextInput
            label="Team Name"
            placeholder="Enter team name"
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          
          <Group position="right" mt="md">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam}>
              Create Team
            </Button>
          </Group>
        </Stack>
      </Modal>


    </>
  );
};

export default TeamsPage; 