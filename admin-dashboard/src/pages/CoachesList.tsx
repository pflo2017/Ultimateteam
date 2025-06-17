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
  Avatar
} from '@mantine/core';
import { 
  IconSearch, 
  IconEdit, 
  IconPlus, 
  IconLock, 
  IconLockOpen,
  IconUserPlus,
  IconPhone
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

interface Coach {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  club_id: string | null;
  club_name?: string;
  admin_id?: string;
}

const CoachesList: React.FC = () => {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    setLoading(true);
    const debugData: any = {
      timestamp: new Date().toISOString(),
      queries: []
    };
    
    try {
      // Check if we're authenticated first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      debugData.session = { 
        user_id: session?.user?.id,
        error: sessionError ? sessionError.message : null
      };
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Check if the current user is a master admin
      debugData.queries.push({ name: 'checkMasterAdmin', startTime: new Date().toISOString() });
      const { data: masterAdminCheck, error: masterAdminCheckError } = await supabase
        .from('master_admins')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      debugData.masterAdminCheck = {
        data: masterAdminCheck,
        error: masterAdminCheckError ? masterAdminCheckError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (masterAdminCheckError || !masterAdminCheck) {
        throw new Error('You are not authorized as a master admin');
      }

      // Fetch coaches with club information
      debugData.queries.push({ name: 'coaches', startTime: new Date().toISOString() });
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select(`
          id, 
          user_id, 
          name, 
          phone_number,
          is_active,
          created_at,
          club_id,
          admin_id,
          clubs:club_id (id, name)
        `)
        .order('created_at', { ascending: false });

      debugData.coaches = { 
        data: coachesData, 
        count: coachesData?.length || 0,
        error: coachesError ? coachesError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
        throw coachesError;
      }

      // Get user emails for coaches with user_id
      const userIds = coachesData
        ?.filter(coach => coach.user_id)
        .map(coach => coach.user_id) as string[] || [];

      let userEmails: Record<string, string> = {};
      
      if (userIds.length > 0) {
        debugData.queries.push({ name: 'userEmails', startTime: new Date().toISOString() });
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        
        if (!userError && userData) {
          userData.forEach((user: any) => {
            userEmails[user.id] = user.email;
          });
        }
        
        // If direct query fails, try the auth_user_details view
        if (userError) {
          const { data: viewData, error: viewError } = await supabase
            .from('auth_user_details')
            .select('id, email')
            .in('id', userIds);
            
          if (!viewError && viewData) {
            viewData.forEach((user: any) => {
              userEmails[user.id] = user.email;
            });
          }
        }
        
        debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      }

      // Transform coaches data with emails and club names
      const transformedCoaches = coachesData?.map((coach: any) => {
        return {
          ...coach,
          email: coach.user_id ? userEmails[coach.user_id] || null : null,
          club_name: coach.clubs ? coach.clubs.name : 'Unknown Club'
        };
      }) || [];

      console.log('Fetched coaches:', transformedCoaches.length);
      setCoaches(transformedCoaches);
      
    } catch (error: any) {
      console.error('Error fetching coaches:', error);
      
      // Add more detailed error information
      const errorDetails = {
        message: error.message || 'Unknown error',
        code: error.code,
        hint: error.hint,
        details: error.details
      };
      
      debugData.error = errorDetails;
      
      notifications.show({
        title: 'Error',
        message: 'Failed to load coaches data: ' + (error.message || 'Unknown error'),
        color: 'red',
      });
      
      setCoaches([]);
    } finally {
      setDebugInfo(debugData);
      setLoading(false);
    }
  };

  const handleToggleStatus = async (coach: Coach) => {
    setSelectedCoach(coach);
    setModalOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedCoach) return;
    
    setActionLoading(true);
    try {
      const newStatus = !selectedCoach.is_active;
      
      // Update coach status
      const { error } = await supabase
        .from('coaches')
        .update({ is_active: newStatus })
        .eq('id', selectedCoach.id);
      
      if (error) throw error;
      
      // Update local state
      setCoaches(coaches.map(coach => 
        coach.id === selectedCoach.id 
          ? { ...coach, is_active: newStatus } 
          : coach
      ));
      
      notifications.show({
        title: 'Success',
        message: `Coach ${newStatus ? 'activated' : 'suspended'} successfully`,
        color: 'green',
      });
      
      setModalOpen(false);
    } catch (error: any) {
      console.error('Error updating coach status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update coach status: ' + (error.message || 'Unknown error'),
        color: 'red',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter coaches based on search term and active tab
  const filteredCoaches = coaches.filter(coach => {
    // Filter by search term
    const matchesSearch = 
      (coach.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (coach.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (coach.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (coach.club_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    // Filter by active tab
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'active' ? coach.is_active :
      !coach.is_active;
    
    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 
      <Badge color="green" variant="filled">Active</Badge> : 
      <Badge color="red" variant="filled">Inactive</Badge>;
  };

  return (
    <>
      <Group position="apart" mb="md">
        <Title order={2}>Coaches Management</Title>
        <Group>
          <Button 
            variant="outline"
            onClick={() => setShowDebug(!showDebug)}
            size="sm"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
          <Button 
            leftIcon={<IconPlus size={16} />} 
            onClick={() => navigate('/coaches/new')}
          >
            Add Coach
          </Button>
        </Group>
      </Group>

      {showDebug && debugInfo && (
        <Paper p="md" mb="md" withBorder>
          <Title order={4}>Debug Information</Title>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Paper>
      )}

      <Paper p="md" mb="md">
        <Group position="apart">
          <TextInput
            placeholder="Search coaches by name, email, phone or club..."
            icon={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flexGrow: 1 }}
          />
          <Group>
            <Button 
              variant={activeTab === 'all' ? 'filled' : 'outline'}
              onClick={() => setActiveTab('all')}
            >
              All
            </Button>
            <Button 
              variant={activeTab === 'active' ? 'filled' : 'outline'}
              color="green"
              onClick={() => setActiveTab('active')}
            >
              Active
            </Button>
            <Button 
              variant={activeTab === 'inactive' ? 'filled' : 'outline'}
              color="red"
              onClick={() => setActiveTab('inactive')}
            >
              Inactive
            </Button>
          </Group>
        </Group>
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
                <th>Coach</th>
                <th>Phone</th>
                <th>Club</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoaches.length > 0 ? (
                filteredCoaches.map((coach) => (
                  <tr key={coach.id}>
                    <td>
                      <Group spacing="sm">
                        <Avatar color="green" radius="xl">
                          <IconUserPlus size={24} />
                        </Avatar>
                        <div>
                          <Text weight={500}>{coach.name || 'Unknown'}</Text>
                          <Text size="xs" color="dimmed">{coach.email || 'No email'}</Text>
                        </div>
                      </Group>
                    </td>
                    <td>
                      <Group spacing={4}>
                        <IconPhone size={14} />
                        <Text size="sm">{coach.phone_number || 'No phone'}</Text>
                      </Group>
                    </td>
                    <td>{coach.club_name || 'No club assigned'}</td>
                    <td>{new Date(coach.created_at).toLocaleDateString()}</td>
                    <td>{getStatusBadge(coach.is_active)}</td>
                    <td>
                      <Group spacing={8} position="left">
                        <Tooltip label="Edit Coach">
                          <ActionIcon onClick={() => navigate(`/coaches/${coach.id}`)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        
                        <Tooltip label={coach.is_active ? 'Deactivate' : 'Activate'}>
                          <ActionIcon 
                            color={coach.is_active ? 'red' : 'green'}
                            onClick={() => handleToggleStatus(coach)}
                          >
                            {coach.is_active ? <IconLock size={16} /> : <IconLockOpen size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <Center p="xl">
                      <Stack align="center" spacing="md">
                        <Text align="center" size="lg" weight={500} color="dimmed">
                          No coaches found
                        </Text>
                        <Text align="center" color="dimmed" size="sm">
                          {coaches.length === 0 
                            ? "There are no coaches in the database. Try adding some coaches or check the debug information for errors."
                            : "No coaches match your current filters. Try adjusting your search or filter criteria."}
                        </Text>
                        {coaches.length === 0 && (
                          <Button 
                            variant="outline" 
                            onClick={() => setShowDebug(true)}
                            leftIcon={<IconSearch size={16} />}
                          >
                            Show Debug Information
                          </Button>
                        )}
                      </Stack>
                    </Center>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Paper>
      )}

      {/* Suspend/Activate Coach Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCoach?.is_active ? "Deactivate Coach" : "Activate Coach"}
      >
        <Stack>
          <Text>
            {selectedCoach?.is_active 
              ? `Are you sure you want to deactivate ${selectedCoach?.name || 'this coach'}?` 
              : `Are you sure you want to activate ${selectedCoach?.name || 'this coach'}?`}
          </Text>
          <Group position="right" mt="md">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              color={selectedCoach?.is_active ? "red" : "green"} 
              onClick={confirmToggleStatus}
              loading={actionLoading}
            >
              {selectedCoach?.is_active ? "Deactivate" : "Activate"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default CoachesList; 