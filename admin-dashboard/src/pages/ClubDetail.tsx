import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Button,
  Group,
  Badge,
  Card,
  Avatar,
  Table,
  ActionIcon,
  Divider,
  Grid,
  Paper,
  Container,
  Tabs,
  Image,
  Loader,
  Center,
  Stack,
  Switch,
  Box,
  Modal,
  TextInput,
  Select,
  Accordion,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconEdit,
  IconTrash,
  IconUsers,
  IconUser,
  IconBallFootball,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconInfoCircle,
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface ClubData {
  id: string;
  name: string;
  location?: string;
  description?: string;
  status?: string;
  created_at: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  is_suspended: boolean;
  admin_name: string;
  admin_email: string;
  player_count: number;
  team_count: number;
  coach_count: number;
  city?: string;
  country?: string;
  players?: { id: string; name: string; team_name?: string }[];
  coaches?: { id: string; name: string }[];
}

export default function ClubDetail() {
  const { id: clubId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clubData, setClubData] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  const fetchClubData = useCallback(async () => {
    setLoading(true);
    try {
      if (!clubId) return;

      // Get club details from the club_details view
      const { data: clubData, error: clubError } = await supabase
        .from('club_details')
        .select('*')
        .eq('id', clubId)
        .single();

      if (clubError) throw clubError;

      console.log('Raw club data:', clubData);

      // Count players
      const { count: playerCount } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true);
      
      // Count teams
      const { count: teamCount } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId);
      
      // Count coaches
      const { count: coachCount } = await supabase
        .from('coaches')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId);

      // Fetch players with their team names
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          teams:team_id (
            id,
            name
          )
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
      }

      // Fetch coaches
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
      }

      // Format players data
      const formattedPlayers = playersData?.map(player => {
        // Add proper type annotation for teams
        const teamName = player.teams && typeof player.teams === 'object' && 'name' in player.teams 
          ? player.teams.name 
          : 'No team';
          
        return {
          id: player.id,
          name: player.name,
          team_name: teamName
        };
      }) || [];

      // Log the data for debugging
      console.log('Club detail data:', {
        clubData,
        playerCount,
        teamCount,
        coachCount,
        players: formattedPlayers,
        coaches: coachesData
      });
      
      setClubData({
        ...clubData,
        player_count: playerCount || 0,
        team_count: teamCount || 0,
        coach_count: coachCount || 0,
        players: formattedPlayers,
        coaches: coachesData || []
      });
    } catch (error) {
      console.error('Error fetching club data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load club data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchClubData();
  }, [fetchClubData]);

  const handleSuspendToggle = async (suspend: boolean) => {
    if (!clubData) return;
    
    setSuspendLoading(true);
    try {
      const { error } = await supabase
        .from('clubs')
        .update({ is_suspended: suspend })
        .eq('id', clubData.id);
      
      if (error) throw error;
      
      // Update local state
      setClubData({
        ...clubData,
        is_suspended: suspend
      });
      
      notifications.show({
        title: suspend ? 'Club Suspended' : 'Club Activated',
        message: suspend 
          ? 'The club has been suspended and administrators cannot access it.' 
          : 'The club has been activated and is now accessible.',
        color: suspend ? 'red' : 'green',
      });
      
    } catch (error) {
      console.error('Error updating club status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update club status',
        color: 'red',
      });
    } finally {
      setSuspendLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      {loading ? (
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      ) : clubData ? (
        <>
          {clubData.is_suspended && (
            <Paper p="md" mb="lg" withBorder radius="md" bg="red.0">
              <Group position="apart">
                <div>
                  <Title order={5} color="red">This club is currently suspended</Title>
                  <Text size="sm" color="dimmed">The club administrators cannot access their dashboard or manage their club.</Text>
                </div>
                <Button 
                  color="green" 
                  onClick={() => handleSuspendToggle(false)}
                  loading={suspendLoading}
                >
                  Activate Club
                </Button>
              </Group>
            </Paper>
          )}

          <Group mb="md">
            <Button 
              variant="subtle" 
              leftIcon={<IconArrowLeft size={16} />} 
              onClick={() => navigate('/clubs')}
            >
              Back to Clubs
            </Button>
          </Group>

          <Card shadow="sm" p="lg" radius="md" withBorder mb="md">
            <Group position="apart" mb="md">
              <Group>
                {clubData.logo_url && (
                  <Avatar 
                    src={clubData.logo_url} 
                    size={64} 
                    radius="xl" 
                  />
                )}
                <div>
                  <Title order={3}>{clubData.name}</Title>
                  <Text color="dimmed" size="sm">
                    {clubData.city || 'No location data'}
                  </Text>
                </div>
              </Group>
              <Group>
                {!clubData.is_suspended ? (
                  <Button 
                    color="red" 
                    onClick={() => handleSuspendToggle(true)}
                    loading={suspendLoading}
                  >
                    Suspend Club
                  </Button>
                ) : null}
                <Button color="blue" onClick={() => navigate(`/clubs/${clubId}/edit`)}>
                  Edit Club
                </Button>
              </Group>
            </Group>
          </Card>

          <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
            <Tabs.List>
              <Tabs.Tab value="overview" icon={<IconInfoCircle size={16} />}>Overview</Tabs.Tab>
              <Tabs.Tab value="players" icon={<IconUsers size={16} />}>
                Players ({clubData.player_count || 0})
              </Tabs.Tab>
              <Tabs.Tab value="coaches" icon={<IconUser size={16} />}>
                Coaches ({clubData.coach_count || 0})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <Grid>
                <Grid.Col span={8}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="sm" weight={500}>Club Admin:</Text>
                        <Text size="sm">{clubData.admin_name || 'Unknown'}</Text>
                        
                        <Text size="sm" weight={500} mt="md">Admin Email:</Text>
                        <Text size="sm">{clubData.admin_email || 'No email'}</Text>
                        
                        <Text size="sm" weight={500} mt="md">Contact Email:</Text>
                        <Text size="sm">{clubData.contact_email || 'Not provided'}</Text>
                      </Grid.Col>
                      
                      <Grid.Col span={6}>
                        <Text size="sm" weight={500}>Location:</Text>
                        <Text size="sm">{clubData.city || 'No location data'}</Text>
                        
                        <Text size="sm" weight={500} mt="md">Contact Phone:</Text>
                        <Text size="sm">{clubData.contact_phone || 'Not provided'}</Text>
                        
                        <Text size="sm" weight={500} mt="md">Created:</Text>
                        <Text size="sm">{new Date(clubData.created_at).toLocaleDateString()}</Text>
                      </Grid.Col>
                    </Grid>

                    {clubData.description && (
                      <>
                        <Divider my="md" />
                        <Text size="sm" weight={500}>Description:</Text>
                        <Text size="sm">{clubData.description}</Text>
                      </>
                    )}
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={4}>
                  <Paper p="md" withBorder>
                    <Title order={4} mb="md">Club Statistics</Title>
                    <Text size="sm" weight={500}>Player Count:</Text>
                    <Text size="sm">{clubData.player_count || 'N/A'}</Text>
                    
                    <Text size="sm" weight={500} mt="md">Team Count:</Text>
                    <Text size="sm">{clubData.team_count || 'N/A'}</Text>
                    
                    <Text size="sm" weight={500} mt="md">Coach Count:</Text>
                    <Text size="sm">{clubData.coach_count || 'N/A'}</Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="players" pt="md">
              <Paper p="md" withBorder>
                <Title order={4} mb="md">Players</Title>
                {clubData.players && clubData.players.length > 0 ? (
                  <Table striped highlightOnHover>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubData.players.map(player => (
                        <tr key={player.id}>
                          <td>{player.name}</td>
                          <td>{player.team_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Text size="sm" color="dimmed">No players found</Text>
                )}
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="coaches" pt="md">
              <Paper p="md" withBorder>
                <Title order={4} mb="md">Coaches</Title>
                {clubData.coaches && clubData.coaches.length > 0 ? (
                  <Table striped highlightOnHover>
                    <thead>
                      <tr>
                        <th>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubData.coaches.map(coach => (
                        <tr key={coach.id}>
                          <td>{coach.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Text size="sm" color="dimmed">No coaches found</Text>
                )}
              </Paper>
            </Tabs.Panel>
          </Tabs>
        </>
      ) : (
        <Center>
          <Text>Club not found or error loading data</Text>
        </Center>
      )}
    </Container>
  );
} 