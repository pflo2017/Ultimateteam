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
  CloseButton
} from '@mantine/core';
import { IconSearch, IconEye, IconPhone, IconMail, IconUserCheck } from '@tabler/icons-react';
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
  children: Child[];
}

interface Child {
  id: string;
  full_name: string;
  team_id: string | null;
  team_name: string | null;
  club_name: string | null;
}

const Parents: React.FC = () => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  
  // Add user role and club ID state
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    // Get user role and club information
    const role = localStorage.getItem('userRole');
    const clubIdFromStorage = localStorage.getItem('clubId');
    const clubNameFromStorage = localStorage.getItem('clubName');
    
    setUserRole(role);
    setClubId(clubIdFromStorage);
    setClubName(clubNameFromStorage);
  }, []);

  const fetchParents = async () => {
    setLoading(true);
    try {
      // If club admin, we need to get parents through their children's teams
      if (userRole === 'clubAdmin' && clubId) {
        await fetchParentsForClub(clubId);
      } else if (userRole === 'masterAdmin') {
        await fetchAllParents();
      } else {
        // If not a master admin or club admin with valid club ID, throw error
        throw new Error('You do not have permission to view parents');
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllParents = async () => {
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
      // Create a base array of parents with empty children arrays
      const parentsWithEmptyChildren = parentsData.map(parent => ({
        ...parent,
        children_count: 0,
        children: []
      }));
      
      // Fetch children for each parent
      const parentsWithChildren = await Promise.all(
        parentsWithEmptyChildren.map(async (parent) => {
          const children = await fetchChildrenForParent(parent.id);
          return {
            ...parent,
            children_count: children.length,
            children
          };
        })
      );
      
      setParents(parentsWithChildren);
    }
  };

  const fetchParentsForClub = async (clubId: string) => {
    try {
      // First, get all teams for this club
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('club_id', clubId)
        .eq('is_active', true);
      
      if (teamsError) throw teamsError;
      
      if (!teams || teams.length === 0) {
        setParents([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      
      const teamIds = teams.map(team => team.id);
      
      // Get all children that belong to teams in this club
      const { data: children, error: childrenError } = await supabase
        .from('parent_children')
        .select('parent_id')
        .in('team_id', teamIds)
        .eq('is_active', true);
      
      if (childrenError) throw childrenError;
      
      if (!children || children.length === 0) {
        setParents([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      
      // Get unique parent IDs
      const parentIds = Array.from(new Set(children.map(child => child.parent_id)));
      
      // Get total count for pagination
      setTotalCount(parentIds.length);
      setTotalPages(Math.ceil(parentIds.length / itemsPerPage));
      
      // Apply pagination to parent IDs
      const from = (activePage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const paginatedParentIds = parentIds.slice(from, to + 1);
      
      // Fetch parent details
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')
        .in('id', paginatedParentIds)
        .order('name', { ascending: true });
      
      if (parentsError) throw parentsError;
      
      if (parentsData) {
        // Create a base array of parents with empty children arrays
        const parentsWithEmptyChildren = parentsData.map(parent => ({
          ...parent,
          children_count: 0,
          children: []
        }));
        
        // Fetch children for each parent (only for this club's teams)
        const parentsWithChildren = await Promise.all(
          parentsWithEmptyChildren.map(async (parent) => {
            const children = await fetchChildrenForParentInClub(parent.id, clubId);
            return {
              ...parent,
              children_count: children.length,
              children
            };
          })
        );
        
        setParents(parentsWithChildren);
      }
    } catch (error) {
      console.error('Error fetching parents for club:', error);
      throw error;
    }
  };

  const fetchChildrenForParent = async (parentId: string): Promise<Child[]> => {
    try {
      // Fetch parent_children records for this parent
      const { data: parentChildren, error: pcError } = await supabase
        .from('parent_children')
        .select('id, full_name, team_id')
        .eq('parent_id', parentId)
        .eq('is_active', true);

      if (pcError) throw pcError;
      
      if (!parentChildren || parentChildren.length === 0) {
        return [];
      }
      
      // For each child, try to get team information
      const childrenWithTeams = await Promise.all(
        parentChildren.map(async (child) => {
          let teamName = null;
          let clubName = null;
          
          if (child.team_id) {
            // Get team info first
            const { data: teamData } = await supabase
              .from('teams')
              .select('name, club_id')
              .eq('id', child.team_id)
              .single();
              
            if (teamData) {
              teamName = teamData.name;
              
              // If we have a club_id, fetch the club name
              if (teamData.club_id) {
                const { data: clubData } = await supabase
                  .from('clubs')
                  .select('name')
                  .eq('id', teamData.club_id)
                  .single();
                  
                if (clubData) {
                  clubName = clubData.name;
                }
              }
            }
          }
          
          return {
            id: child.id,
            full_name: child.full_name,
            team_id: child.team_id,
            team_name: teamName,
            club_name: clubName
          };
        })
      );
      
      return childrenWithTeams;
    } catch (error) {
      console.error('Error fetching children for parent:', error);
      return [];
    }
  };

  const fetchChildrenForParentInClub = async (parentId: string, clubId: string): Promise<Child[]> => {
    try {
      // Get teams for this club
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('is_active', true);
      
      if (teamsError) throw teamsError;
      
      if (!teams || teams.length === 0) {
        return [];
      }
      
      const teamIds = teams.map(team => team.id);
      
      // Fetch parent_children records for this parent that belong to teams in this club
      const { data: parentChildren, error: pcError } = await supabase
        .from('parent_children')
        .select('id, full_name, team_id')
        .eq('parent_id', parentId)
        .in('team_id', teamIds)
        .eq('is_active', true);

      if (pcError) throw pcError;
      
      if (!parentChildren || parentChildren.length === 0) {
        return [];
      }
      
      // For each child, get team and club information
      const childrenWithTeams = await Promise.all(
        parentChildren.map(async (child) => {
          let teamName = null;
          let clubName = null;
          
          if (child.team_id) {
            // Get team info first
            const { data: teamData } = await supabase
              .from('teams')
              .select('name, club_id')
              .eq('id', child.team_id)
              .single();
              
            if (teamData) {
              teamName = teamData.name;
              
              // If we have a club_id, fetch the club name
              if (teamData.club_id) {
                const { data: clubData } = await supabase
                  .from('clubs')
                  .select('name')
                  .eq('id', teamData.club_id)
                  .single();
                  
                if (clubData) {
                  clubName = clubData.name;
                }
              }
            }
          }
          
          return {
            id: child.id,
            full_name: child.full_name,
            team_id: child.team_id,
            team_name: teamName,
            club_name: clubName
          };
        })
      );
      
      return childrenWithTeams;
    } catch (error) {
      console.error('Error fetching children for parent in club:', error);
      return [];
    }
  };

  // Separate useEffect for fetching data when userRole and clubId are available
  useEffect(() => {
    if (userRole) {
      fetchParents();
    }
  }, [userRole, clubId, activePage, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setActivePage(1); // Reset to first page on new search
  };

  const handleParentSelect = async (parent: Parent) => {
    // If we're selecting a parent, make sure we have the latest children data
    if (parent) {
      const children = await fetchChildrenForParent(parent.id);
      setSelectedParent({
        ...parent,
        children_count: children.length,
        children
      });
    } else {
      setSelectedParent(null);
    }
  };

  const handleCloseDetails = () => {
    setSelectedParent(null);
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
      <Title order={2} mb="md">
        {userRole === 'clubAdmin' && clubName ? `${clubName} Parents` : 'All Parents'}
      </Title>
      
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parents.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Text align="center">No parents found</Text>
                  </td>
                </tr>
              ) : (
                parents.map((parent) => (
                  <tr key={parent.id}>
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
                </Text>
                <CloseButton onClick={handleCloseDetails} />
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
            </Box>
            
            <Tabs defaultValue="children" mt="md">
              <Tabs.List>
                <Tabs.Tab value="children" icon={<IconUserCheck size={14} />}>
                  Children ({selectedParent.children_count})
                </Tabs.Tab>
              </Tabs.List>
              
              <Tabs.Panel value="children" pt="md">
                {selectedParent.children.length === 0 ? (
                  <Text color="dimmed">No children found for this parent.</Text>
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
                          <td>{child.team_name || 'Not assigned'}</td>
                          <td>{child.club_name || 'Not assigned'}</td>
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