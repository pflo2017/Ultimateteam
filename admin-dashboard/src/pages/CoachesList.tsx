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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    // Get user role and club ID from localStorage
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    
    if (role === 'clubAdmin') {
      setClubId(localStorage.getItem('clubId'));
      setClubName(localStorage.getItem('clubName'));
    }
    
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
      
      // Get user role from localStorage
      const userRole = localStorage.getItem('userRole');
      const clubId = localStorage.getItem('clubId');
      
      // Build query based on user role
      let query = supabase
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
          email,
          clubs:club_id (id, name)
        `);
      
      // If club admin, filter by club_id
      if (userRole === 'clubAdmin' && clubId) {
        query = query.eq('club_id', clubId);
      } else if (userRole === 'masterAdmin') {
        // For master admin, no additional filtering needed
      } else {
        // If not a master admin or club admin with valid club ID, throw error
        throw new Error('You do not have permission to view coaches');
      }
      
      // Execute the query
      const { data: coachesData, error: coachesError } = await query.order('created_at', { ascending: false });

      debugData.coaches = { 
        data: coachesData, 
        count: coachesData?.length || 0,
        error: coachesError ? coachesError.message : null
      };
      
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
        // Use email from coach record first, then fall back to auth email
        const coachEmail = coach.email || (coach.user_id ? userEmails[coach.user_id] || null : null);
        
        return {
          ...coach,
          email: coachEmail, 
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

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge color={isActive ? 'green' : 'gray'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  const getStatusActionIcon = (coach: Coach) => {
    return coach.is_active ? (
      <Tooltip label="Deactivate Coach">
        <ActionIcon color="red" onClick={() => handleToggleStatus(coach)}>
          <IconLock size={16} />
        </ActionIcon>
      </Tooltip>
    ) : (
      <Tooltip label="Activate Coach">
        <ActionIcon color="green" onClick={() => handleToggleStatus(coach)}>
          <IconLockOpen size={16} />
        </ActionIcon>
      </Tooltip>
    );
  };

  // Filter coaches based on search term and active tab
  const filteredCoaches = coaches.filter(coach => {
    const matchesSearch = 
      coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (coach.email && coach.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      coach.phone_number.includes(searchTerm);
      
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'active') return matchesSearch && coach.is_active;
    if (activeTab === 'inactive') return matchesSearch && !coach.is_active;
    return matchesSearch;
  });

  return (
    <>
      <Title order={2} mb="md">
        {userRole === 'clubAdmin' && clubName ? `${clubName} Coaches` : 'All Coaches'}
      </Title>
      
      <Paper p="md" mb="md">
        <Group position="apart">
          <TextInput
            placeholder="Search by name, email or phone..."
            icon={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flexGrow: 1 }}
          />
          <Button
            leftIcon={<IconUserPlus size={16} />}
            onClick={() => navigate('/coaches/new')}
          >
            Add Coach
          </Button>
        </Group>
      </Paper>
      
      {loading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : filteredCoaches.length === 0 ? (
        <Text align="center" mt="lg" color="dimmed">
          No coaches found. {searchTerm ? 'Try a different search term.' : 'Add a coach to get started.'}
        </Text>
      ) : (
        <Table striped>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              {userRole === 'masterAdmin' && <th>Club</th>}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoaches.map((coach) => (
              <tr key={coach.id}>
                <td>
                  <Group spacing="sm">
                    <Avatar size={30} radius={30} color="blue">
                      {coach.name.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Text size="sm" weight={500}>
                      {coach.name}
                    </Text>
                  </Group>
                </td>
                <td>{coach.email || 'No email'}</td>
                <td>
                  <Group spacing="xs" noWrap>
                    <IconPhone size={16} />
                    <Text size="sm">{coach.phone_number}</Text>
                  </Group>
                </td>
                {userRole === 'masterAdmin' && (
                  <td>{coach.club_name}</td>
                )}
                <td>{getStatusBadge(coach.is_active)}</td>
                <td>
                  <Group spacing="xs">
                    <Tooltip label="Edit Coach">
                      <ActionIcon color="blue" onClick={() => navigate(`/coaches/${coach.id}`)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {getStatusActionIcon(coach)}
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      
      {/* Status Toggle Confirmation Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${selectedCoach?.is_active ? 'Deactivate' : 'Activate'} Coach`}
      >
        <Text size="sm" mb="lg">
          Are you sure you want to {selectedCoach?.is_active ? 'deactivate' : 'activate'} coach <strong>{selectedCoach?.name}</strong>?
        </Text>
        <Group position="right">
          <Button variant="default" onClick={() => setModalOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button 
            color={selectedCoach?.is_active ? 'red' : 'green'}
            onClick={confirmToggleStatus}
            loading={actionLoading}
          >
            Confirm
          </Button>
        </Group>
      </Modal>
      
      {/* Debug Info Modal */}
      <Modal
        opened={showDebug}
        onClose={() => setShowDebug(false)}
        title="Debug Information"
        size="xl"
      >
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </Modal>
    </>
  );
};

export default CoachesList; 