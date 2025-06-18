import React, { useState, useEffect } from 'react';
import { 
  Title, 
  Paper, 
  Text, 
  Group, 
  Center, 
  Loader,
  Table,
  TextInput,
  Badge,
  ActionIcon,
  Pagination,
  Card,
  Tabs,
  Box,
  Alert,
  Stack
} from '@mantine/core';
import { IconSearch, IconEye, IconPhone, IconMail, IconUserCheck, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface Parent {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone_number: string;
  phone_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  children_count: number;
  children: Player[];
}

interface Player {
  id: string;
  full_name: string;
  team_name: string | null;
  club_name: string | null;
}

// The ID of the most tested parent
const MOST_TESTED_PARENT_USER_ID = '0d143f30-0f6b-47bb-ade0-e64fbecadf60';
const MOST_TESTED_PARENT_ID = 'f6aac5dd-35de-4c6a-86eb-810e913ae02a';

const Parents: React.FC = () => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [mostTestedParent, setMostTestedParent] = useState<Parent | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  const fetchParents = async () => {
    setLoading(true);
    try {
      // First, get the total count
      const { count, error: countError } = await supabase
        .from('parents')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      if (count !== null) {
        setTotalCount(count);
        setTotalPages(Math.ceil(count / itemsPerPage));
      }
      
      // Fetch parents with pagination
      const from = (activePage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Get parents data
      let query = supabase
        .from('parents')
        .select('*')
        .order('name', { ascending: true });
      
      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      // Apply pagination
      query = query.range(from, to);
      
      const { data: parentsData, error: parentsError } = await query;
      
      if (parentsError) throw parentsError;
      
      if (parentsData) {
        // For each parent, get their children
        const parentsWithChildren = await Promise.all(
          parentsData.map(async (parent) => {
            // Get children for this parent
            const { data: childrenData, error: childrenError } = await supabase
              .from('parent_children')
              .select(`
                player_id,
                players (
                  id,
                  full_name,
                  team_id,
                  teams (
                    name,
                    club_id,
                    clubs (
                      name
                    )
                  )
                )
              `)
              .eq('parent_id', parent.id);
            
            if (childrenError) {
              console.error('Error fetching children:', childrenError);
              return {
                ...parent,
                children_count: 0,
                children: []
              };
            }
            
            // Format children data
            const children = childrenData.map((child: any) => ({
              id: child.player_id,
              full_name: child.players?.full_name || 'Unknown',
              team_name: child.players?.teams?.name || null,
              club_name: child.players?.teams?.clubs?.name || null
            }));
            
            return {
              ...parent,
              children_count: children.length,
              children
            };
          })
        );
        
        setParents(parentsWithChildren);
      }
      
      // Separately fetch the most tested parent
      const { data: testedParentData, error: testedParentError } = await supabase
        .from('parents')
        .select('*')
        .eq('id', MOST_TESTED_PARENT_ID)
        .single();
      
      if (!testedParentError && testedParentData) {
        // Get children for this parent
        const { data: childrenData } = await supabase
          .from('parent_children')
          .select(`
            player_id,
            players (
              id,
              full_name,
              team_id,
              teams (
                name,
                club_id,
                clubs (
                  name
                )
              )
            )
          `)
          .eq('parent_id', testedParentData.id);
        
        const children = (childrenData || []).map((child: any) => ({
          id: child.player_id,
          full_name: child.players?.full_name || 'Unknown',
          team_name: child.players?.teams?.name || null,
          club_name: child.players?.teams?.clubs?.name || null
        }));
        
        setMostTestedParent({
          ...testedParentData,
          children_count: children.length,
          children
        });
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [activePage, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setActivePage(1); // Reset to first page on new search
  };

  const handleParentSelect = (parent: Parent) => {
    setSelectedParent(parent);
  };

  const isTestParent = (parent: Parent) => {
    return parent.user_id === MOST_TESTED_PARENT_USER_ID || parent.id === MOST_TESTED_PARENT_ID;
  };

  if (loading && parents.length === 0) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Title order={2} mb="md">Parents</Title>
      
      {mostTestedParent && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Most Tested Parent" 
          color="blue" 
          mb="md"
          withCloseButton={false}
        >
          <Group position="apart">
            <div>
              <Text weight={500}>{mostTestedParent.name}</Text>
              <Text size="xs">Phone: {mostTestedParent.phone_number}</Text>
              <Text size="xs">Email: {mostTestedParent.email}</Text>
              <Text size="xs">User ID: {mostTestedParent.user_id || 'None'}</Text>
            </div>
            <ActionIcon onClick={() => handleParentSelect(mostTestedParent)} color="blue">
              <IconEye size={16} />
            </ActionIcon>
          </Group>
        </Alert>
      )}
      
      <Group position="apart" mb="md">
        <Group>
          <TextInput
            placeholder="Search by name, email or phone"
            icon={<IconSearch size={14} />}
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: 300 }}
          />
          <Text size="sm" color="dimmed">
            Total: {totalCount} parents
          </Text>
        </Group>
      </Group>
      
      <Group grow mb="md">
        <Paper withBorder p="md" radius="md">
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>IDs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parents.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <Text align="center">No parents found</Text>
                  </td>
                </tr>
              ) : (
                parents.map((parent) => (
                  <tr key={parent.id} style={isTestParent(parent) ? { backgroundColor: '#f0f9ff' } : undefined}>
                    <td>{parent.name}</td>
                    <td>
                      <Group spacing="xs">
                        <IconPhone size={14} />
                        <Text size="sm">{parent.phone_number}</Text>
                        {parent.phone_verified && (
                          <Badge color="green" size="xs">Verified</Badge>
                        )}
                      </Group>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <IconMail size={14} />
                        <Text size="sm">{parent.email}</Text>
                      </Group>
                    </td>
                    <td>
                      <Badge color={parent.is_active ? 'green' : 'red'}>
                        {parent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <Stack spacing={4}>
                        {parent.user_id && (
                          <Text size="xs" color="dimmed">User: {parent.user_id.substring(0, 8)}...</Text>
                        )}
                        {parent.team_id && (
                          <Text size="xs" color="dimmed">Team: {parent.team_id.substring(0, 8)}...</Text>
                        )}
                      </Stack>
                    </td>
                    <td>
                      <ActionIcon onClick={() => handleParentSelect(parent)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          
          {totalPages > 1 && (
            <Center mt="md">
              <Pagination
                total={totalPages}
                value={activePage}
                onChange={setActivePage}
              />
            </Center>
          )}
        </Paper>
        
        {selectedParent && (
          <Card withBorder p="md" radius="md">
            <Card.Section withBorder inheritPadding py="xs">
              <Group position="apart">
                <Text weight={500}>
                  Parent Details
                  {isTestParent(selectedParent) && (
                    <Badge ml="xs" color="blue">Most Tested</Badge>
                  )}
                </Text>
              </Group>
            </Card.Section>
            
            <Box mt="md">
              <Text weight={700} size="lg">{selectedParent.name}</Text>
              <Text size="sm" color="dimmed">
                Registered: {new Date(selectedParent.created_at).toLocaleDateString()}
                {selectedParent.updated_at !== selectedParent.created_at && 
                  ` (Updated: ${new Date(selectedParent.updated_at).toLocaleDateString()})`
                }
              </Text>
              
              <Group mt="md" spacing="xs">
                <IconPhone size={14} />
                <Text size="sm">{selectedParent.phone_number}</Text>
                {selectedParent.phone_verified && (
                  <Badge color="green" size="xs">Verified</Badge>
                )}
              </Group>
              
              <Group mt="xs" spacing="xs">
                <IconMail size={14} />
                <Text size="sm">{selectedParent.email}</Text>
              </Group>
              
              <Group mt="md" position="apart">
                <Text size="sm">Account Status:</Text>
                <Badge color={selectedParent.is_active ? 'green' : 'red'}>
                  {selectedParent.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
              
              <Group mt="md" position="apart">
                <Text size="sm" weight={500}>IDs:</Text>
              </Group>
              
              <Group mt="xs" spacing="xs">
                <Text size="sm">Parent ID:</Text>
                <Text size="xs" color="dimmed">{selectedParent.id}</Text>
              </Group>
              
              {selectedParent.user_id && (
                <Group mt="xs" spacing="xs">
                  <Text size="sm">User ID:</Text>
                  <Text size="xs" color="dimmed">{selectedParent.user_id}</Text>
                </Group>
              )}
              
              {selectedParent.team_id && (
                <Group mt="xs" spacing="xs">
                  <Text size="sm">Team ID:</Text>
                  <Text size="xs" color="dimmed">{selectedParent.team_id}</Text>
                </Group>
              )}
            </Box>
            
            <Tabs defaultValue="children" mt="md">
              <Tabs.List>
                <Tabs.Tab value="children" icon={<IconUserCheck size={14} />}>
                  Children ({selectedParent.children_count})
                </Tabs.Tab>
              </Tabs.List>
              
              <Tabs.Panel value="children" pt="md">
                {selectedParent.children.length === 0 ? (
                  <Text color="dimmed">No children registered</Text>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Team</th>
                        <th>Club</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedParent.children.map((child) => (
                        <tr key={child.id}>
                          <td>{child.full_name}</td>
                          <td>{child.team_name || 'N/A'}</td>
                          <td>{child.club_name || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Tabs.Panel>
            </Tabs>
          </Card>
        )}
      </Group>
    </>
  );
};

export default Parents; 