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
  Stack
} from '@mantine/core';
import { IconSearch, IconEdit, IconPlus, IconLock, IconLockOpen } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface Club {
  id: string;
  name: string;
  created_at: string;
  is_suspended: boolean;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  player_count: number;
  team_count: number;
  coach_count: number;
  logo_url?: string;
  city?: string;
  country?: string;
  address?: string;
  phone_number?: string;
  email?: string;
}

const ClubsList: React.FC = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    setLoading(true);
    try {
      // Fetch clubs data from the club_details view
      const { data: clubsData, error: clubsError } = await supabase
        .from('club_details')
        .select('*');

      if (clubsError) throw clubsError;

      console.log('Raw clubs data:', clubsData);

      // For each club, get counts
      const clubsWithDetails = await Promise.all((clubsData || []).map(async (club) => {
        // Count players
        const { count: playerCount } = await supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true);
        
        // Count teams
        const { count: teamCount } = await supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true);
        
        // Count coaches
        const { count: coachCount } = await supabase
          .from('coaches')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true);
        
        // Log the data for debugging
        console.log('Club data:', {
          club,
          playerCount,
          teamCount,
          coachCount
        });
        
        return {
          ...club,
          player_count: playerCount || 0,
          team_count: teamCount || 0,
          coach_count: coachCount || 0
        };
      }));

      setClubs(clubsWithDetails);
    } catch (error) {
      console.error('Error fetching clubs:', error);
      // If we can't fetch real data, use mock data for development
      const mockClubs: Club[] = [
        {
          id: '1',
          name: 'FC Barcelona Academy',
          created_at: '2023-01-15',
          is_suspended: false,
          admin_id: 'user1',
          admin_name: 'Carlos Rodriguez',
          admin_email: 'carlos@fcbarcelona.com',
          player_count: 120,
          team_count: 8,
          coach_count: 12,
          city: 'Barcelona',
          country: 'Spain',
          logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/1200px-FC_Barcelona_%28crest%29.svg.png',
        },
        {
          id: '2',
          name: 'Liverpool Youth',
          created_at: '2023-02-20',
          is_suspended: false,
          admin_id: 'user2',
          admin_name: 'James Wilson',
          admin_email: 'james@liverpool.com',
          player_count: 85,
          team_count: 6,
          coach_count: 8,
          city: 'Liverpool',
          country: 'UK',
        },
        {
          id: '3',
          name: 'Ajax Academy',
          created_at: '2023-03-10',
          is_suspended: true,
          admin_id: 'user3',
          admin_name: 'Jan de Boer',
          admin_email: 'jan@ajax.com',
          player_count: 65,
          team_count: 4,
          coach_count: 6,
          city: 'Amsterdam',
          country: 'Netherlands',
        }
      ];
      setClubs(mockClubs);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendClub = (club: Club) => {
    setSelectedClub(club);
    setSuspendModalOpen(true);
  };

  const confirmSuspendClub = async () => {
    if (!selectedClub) return;
    
    setActionLoading(true);
    try {
      // Toggle suspension status
      const newStatus = !selectedClub.is_suspended;
      
      // Update in database
      const { error } = await supabase
        .from('clubs')
        .update({ is_suspended: newStatus })
        .eq('id', selectedClub.id);
      
      if (error) throw error;
      
      // Update local state
      setClubs(clubs.map(club => 
        club.id === selectedClub.id 
          ? { ...club, is_suspended: newStatus } 
          : club
      ));
      
      setSuspendModalOpen(false);
    } catch (error) {
      console.error('Error updating club status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredClubs = clubs.filter(club => 
    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (club.city && club.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Group position="apart" mb="md">
        <Title order={2}>Clubs Management</Title>
        <Button 
          leftIcon={<IconPlus size={16} />} 
          onClick={() => navigate('/clubs/new')}
        >
          Add Club
        </Button>
      </Group>

      <Paper p="md" mb="md">
        <TextInput
          placeholder="Search clubs by name, admin, or location..."
          icon={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          mb="xs"
        />
      </Paper>

      {loading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : (
        <Paper withBorder p={0}>
          <Table striped highlightOnHover>
            <thead>
              <tr>
                <th>Club Name</th>
                <th>Admin</th>
                <th>Location</th>
                <th>Players</th>
                <th>Teams</th>
                <th>Coaches</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClubs.length > 0 ? (
                filteredClubs.map((club) => (
                  <tr key={club.id}>
                    <td>
                      <Group spacing="sm">
                        <Text weight={500}>{club.name}</Text>
                      </Group>
                    </td>
                    <td>
                      <Text size="sm">{club.admin_name}</Text>
                      <Text size="xs" color="dimmed">{club.admin_email}</Text>
                    </td>
                    <td>
                      {club.city || 'No location data'}
                    </td>
                    <td>
                      <Text weight={500}>{club.player_count}</Text>
                    </td>
                    <td>{club.team_count}</td>
                    <td>{club.coach_count}</td>
                    <td>
                      <Badge 
                        color={club.is_suspended ? 'red' : 'green'} 
                        variant="filled"
                      >
                        {club.is_suspended ? 'Suspended' : 'Active'}
                      </Badge>
                    </td>
                    <td>
                      <Group spacing={8} position="left">
                        <Tooltip label="View Details">
                          <ActionIcon onClick={() => navigate(`/clubs/${club.id}`)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={club.is_suspended ? 'Activate Club' : 'Suspend Club'}>
                          <ActionIcon 
                            color={club.is_suspended ? 'green' : 'red'}
                            onClick={() => handleSuspendClub(club)}
                          >
                            {club.is_suspended ? <IconLockOpen size={16} /> : <IconLock size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <Text align="center" p="md">
                      No clubs found. Try adjusting your search or add a new club.
                    </Text>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Paper>
      )}

      {/* Suspend/Activate Club Modal */}
      <Modal
        opened={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title={selectedClub?.is_suspended ? "Activate Club" : "Suspend Club"}
      >
        <Stack>
          <Text>
            {selectedClub?.is_suspended 
              ? `Are you sure you want to activate ${selectedClub?.name}? This will restore access for all club administrators, coaches, and parents.` 
              : `Are you sure you want to suspend ${selectedClub?.name}? This will prevent all club administrators, coaches, and parents from accessing the app.`}
          </Text>
          <Text size="sm" color="dimmed">
            Note: This action does not delete any data. All club data will be preserved.
          </Text>
          <Group position="right" mt="md">
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              color={selectedClub?.is_suspended ? "green" : "red"} 
              onClick={confirmSuspendClub}
              loading={actionLoading}
            >
              {selectedClub?.is_suspended ? "Activate" : "Suspend"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ClubsList; 