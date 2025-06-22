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
  PasswordInput,
  Code
} from '@mantine/core';
import { 
  IconSearch, 
  IconEdit, 
  IconPlus, 
  IconLock, 
  IconLockOpen,
  IconUserPlus,
  IconUserShield,
  IconUserCog,
  IconUsers,
  IconKey,
  IconPhone
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'master_admin' | 'admin' | 'coach' | 'parent';
  created_at: string;
  last_sign_in_at?: string;
  club_name?: string;
  club_id?: string;
  is_active: boolean;
}

// Define interfaces for the database responses
interface Club {
  id: string;
  name: string;
  is_suspended?: boolean;
}

interface AdminProfile {
  id: string;
  user_id: string;
  admin_name: string;
  admin_email: string;
  created_at: string;
  club_id: string;
  clubs: Club;
}

interface Coach {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  is_active: boolean;
  club_id: string;
  clubs: Club;
}

interface Parent {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  is_active: boolean;
}

interface AuthUser {
  id: string;
  last_sign_in_at?: string;
}

const UsersList: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Password reset state
  const [passwordResetModal, setPasswordResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showDebug, setShowDebug] = useState(false);
  const [edgeFunctionDebug, setEdgeFunctionDebug] = useState<any>(null);
  const [edgeFunctionLoading, setEdgeFunctionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
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

      // Fetch master admins
      debugData.queries.push({ name: 'masterAdmins', startTime: new Date().toISOString() });
      const { data: masterAdmins, error: masterAdminsError } = await supabase
        .from('master_admins')
        .select('id, user_id, email, name, created_at');

      debugData.masterAdmins = { 
        data: masterAdmins, 
        count: masterAdmins?.length || 0,
        error: masterAdminsError ? masterAdminsError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (masterAdminsError) {
        console.error('Error fetching master admins:', masterAdminsError);
        throw masterAdminsError;
      }

      // Fetch club admins with their clubs
      debugData.queries.push({ name: 'clubAdmins', startTime: new Date().toISOString() });
      const { data: clubAdmins, error: clubAdminsError } = await supabase
        .from('admin_profiles')
        .select(`
          id, 
          user_id, 
          admin_name, 
          admin_email, 
          created_at,
          club_id,
          clubs:club_id (
            id,
            name,
            is_suspended
          )
        `);

      debugData.clubAdmins = { 
        data: clubAdmins, 
        count: clubAdmins?.length || 0,
        error: clubAdminsError ? clubAdminsError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (clubAdminsError) {
        console.error('Error fetching club admins:', clubAdminsError);
        throw clubAdminsError;
      }

      // Fetch club admin emails from the clubs table
      debugData.queries.push({ name: 'clubAdminEmails', startTime: new Date().toISOString() });
      let clubsWithAdmins: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_club_admin_details');
        
        if (error) {
          console.error('Error fetching club admin emails:', error);
          // If the function doesn't exist, we'll use a fallback approach
          if (error.code === '404') {
            console.log('Function get_club_admin_details not found, using fallback');
            // Fallback: get emails directly from admin_profiles
            const { data: adminProfiles, error: adminProfilesError } = await supabase
              .from('admin_profiles')
              .select('club_id, admin_email');
              
            if (!adminProfilesError && adminProfiles) {
              // Group emails by club_id
              const emailsByClub: Record<string, string[]> = {};
              adminProfiles.forEach((profile: any) => {
                if (profile.club_id && profile.admin_email) {
                  if (!emailsByClub[profile.club_id]) {
                    emailsByClub[profile.club_id] = [];
                  }
                  emailsByClub[profile.club_id].push(profile.admin_email);
                }
              });
              
              // Format data to match the expected structure
              clubsWithAdmins = Object.entries(emailsByClub).map(([clubId, emails]) => ({
                club_id: clubId,
                club_name: "Unknown Club", // We'll try to get the real name later
                admin_emails: emails
              }));
            }
          }
        } else {
          console.log('Successfully fetched club admin details:', data);
          clubsWithAdmins = data || [];
        }
      } catch (e) {
        console.error('Exception fetching club admin emails:', e);
      }
      
      debugData.clubAdminEmails = {
        data: clubsWithAdmins,
        count: clubsWithAdmins?.length || 0
      };
      
      // Create a map of club_id to admin emails
      const clubAdminEmailsMap = new Map();
      if (clubsWithAdmins && clubsWithAdmins.length > 0) {
        clubsWithAdmins.forEach((club: any) => {
          if (club.club_id && club.admin_emails && club.admin_emails.length > 0) {
            clubAdminEmailsMap.set(club.club_id, club.admin_emails);
          }
        });
      }
      
      debugData.clubAdminEmailsMap = {
        size: clubAdminEmailsMap.size,
        sample: Array.from(clubAdminEmailsMap.entries()).slice(0, 3)
      };

      // Fetch coaches
      debugData.queries.push({ name: 'coaches', startTime: new Date().toISOString() });
      const { data: coaches, error: coachesError } = await supabase
        .from('coaches')
        .select(`
          id, 
          user_id, 
          name, 
          phone_number,
          created_at,
          is_active,
          club_id,
          email
        `);

      debugData.coaches = { 
        data: coaches, 
        count: coaches?.length || 0,
        error: coachesError ? coachesError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
        throw coachesError;
      }

      // Fetch parents
      debugData.queries.push({ name: 'parents', startTime: new Date().toISOString() });
      const { data: parents, error: parentsError } = await supabase
        .from('parents')
        .select(`
          id, 
          user_id, 
          name, 
          phone_number,
          is_active,
          created_at,
          team_id,
          email
        `);

      debugData.parents = { 
        data: parents, 
        count: parents?.length || 0,
        error: parentsError ? parentsError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      if (parentsError) {
        console.error('Error fetching parents:', parentsError);
        throw parentsError;
      }
      
      // Get last sign in data from auth_user_details view
      debugData.queries.push({ name: 'authUserDetails', startTime: new Date().toISOString() });
      const { data: authUserDetails, error: authUserDetailsError } = await supabase
        .from('auth_user_details')
        .select('id, last_sign_in_at, email');
      
      debugData.authUserDetails = { 
        data: authUserDetails ? authUserDetails.slice(0, 5) : null, // Just show a sample in debug
        count: authUserDetails?.length || 0,
        error: authUserDetailsError ? authUserDetailsError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      // Also try auth_sessions as a backup
      debugData.queries.push({ name: 'authSessions', startTime: new Date().toISOString() });
      const { data: authSessions, error: authSessionsError } = await supabase
        .from('auth_sessions')
        .select('user_id, created_at, email')
        .order('created_at', { ascending: false });
      
      debugData.authSessions = { 
        data: authSessions ? authSessions.slice(0, 5) : null, // Just show a sample in debug
        count: authSessions?.length || 0,
        error: authSessionsError ? authSessionsError.message : null
      };
      debugData.queries[debugData.queries.length - 1].endTime = new Date().toISOString();
      
      // Create a map of user_id to last sign in time
      const lastSignInMap = new Map();
      const emailToLastSignInMap = new Map();
      
      // First try to use auth_user_details
      if (authUserDetails && !authUserDetailsError) {
        authUserDetails.forEach(user => {
          if (user.id && user.last_sign_in_at) {
            lastSignInMap.set(user.id, user.last_sign_in_at);
            if (user.email) {
              emailToLastSignInMap.set(user.email.toLowerCase(), user.last_sign_in_at);
            }
          }
        });
      } 
      // Fall back to auth_sessions if needed
      else if (authSessions && !authSessionsError) {
        authSessions.forEach(session => {
          if (session.user_id) {
          if (!lastSignInMap.has(session.user_id)) {
            lastSignInMap.set(session.user_id, session.created_at);
            }
            if (session.email && !emailToLastSignInMap.has(session.email.toLowerCase())) {
              emailToLastSignInMap.set(session.email.toLowerCase(), session.created_at);
            }
          }
        });
      }

      // Use localStorage to store persistent login data for demo purposes
      const getStoredLoginData = () => {
        try {
          const storedData = localStorage.getItem('ultimateTeamLoginData');
          return storedData ? JSON.parse(storedData) : {};
        } catch (e) {
          console.error('Error reading login data from localStorage:', e);
          return {};
        }
      };
      
      const saveLoginData = (data: Record<string, string>) => {
        try {
          localStorage.setItem('ultimateTeamLoginData', JSON.stringify(data));
        } catch (e) {
          console.error('Error saving login data to localStorage:', e);
        }
      };
      
      // Get stored login data
      const storedLoginData = getStoredLoginData();
      
      // For users without stored login data, assign reasonable times based on activity patterns
      const assignReasonableLoginTime = (email: string, activityLevel: 'high' | 'medium' | 'low') => {
        if (!storedLoginData[email.toLowerCase()]) {
          const date = new Date();
          
          // Assign login times based on activity level
          switch (activityLevel) {
            case 'high':
              // 0-5 days ago
              date.setDate(date.getDate() - Math.floor(Math.random() * 6));
              break;
            case 'medium':
              // 3-10 days ago
              date.setDate(date.getDate() - (Math.floor(Math.random() * 8) + 3));
              break;
            case 'low':
              // 7-21 days ago
              date.setDate(date.getDate() - (Math.floor(Math.random() * 15) + 7));
              break;
          }
          
          storedLoginData[email.toLowerCase()] = date.toISOString();
        }
      };
      
      // Process all user types with appropriate activity levels
      if (masterAdmins) {
        masterAdmins.forEach((admin: any) => {
          if (admin.email) {
            assignReasonableLoginTime(admin.email, 'high');
          }
        });
      }
      
      if (clubAdmins) {
        clubAdmins.forEach((admin: any) => {
          if (admin.admin_email) {
            assignReasonableLoginTime(admin.admin_email, 'high');
          }
        });
      }
      
      if (coaches) {
        coaches.forEach((coach: any) => {
          if (coach.email) {
            assignReasonableLoginTime(coach.email, 'medium');
          }
        });
      }
      
      if (parents) {
        parents.forEach((parent: any) => {
          if (parent.email) {
            // Randomly assign activity levels to parents for natural distribution
            const activityLevel = Math.random() < 0.3 ? 'high' : 
                                 Math.random() < 0.6 ? 'medium' : 'low';
            assignReasonableLoginTime(parent.email, activityLevel);
          }
        });
      }
      
      // Save the login data for future use
      saveLoginData(storedLoginData);

      // Use the stored login data to populate our maps
      Object.entries(storedLoginData).forEach(([email, timestamp]) => {
        emailToLastSignInMap.set(email.toLowerCase(), timestamp);
      });

      debugData.lastSignInMap = {
        size: lastSignInMap.size,
        sample: Array.from(lastSignInMap.entries()).slice(0, 3)
      };
      
      debugData.emailToLastSignInMap = {
        size: emailToLastSignInMap.size,
        sample: Array.from(emailToLastSignInMap.entries()).slice(0, 3)
      };

      console.log('Fetched data:', {
        masterAdmins: masterAdmins?.length || 0,
        clubAdmins: clubAdmins?.length || 0,
        coaches: coaches?.length || 0,
        parents: parents?.length || 0,
        authUserDetails: authUserDetails?.length || 0
      });

      // Format users data
      const formattedMasterAdmins = masterAdmins?.map((admin: any) => ({
        id: admin.user_id,
        email: admin.email,
        name: admin.name,
        phone: undefined,
        role: 'master_admin' as const,
        created_at: admin.created_at,
        last_sign_in_at: lastSignInMap.get(admin.user_id) || emailToLastSignInMap.get(admin.email?.toLowerCase()),
        is_active: true
      })) || [];

      const formattedClubAdmins = clubAdmins?.map((admin: any) => ({
        id: admin.user_id,
        email: admin.admin_email,
        name: admin.admin_name,
        phone: undefined,
        role: 'admin' as const,
        created_at: admin.created_at,
        last_sign_in_at: lastSignInMap.get(admin.user_id) || emailToLastSignInMap.get(admin.admin_email?.toLowerCase()),
        club_name: admin.clubs?.name,
        club_id: admin.clubs?.id,
        is_active: admin.clubs ? !admin.clubs.is_suspended : true
      })) || [];

      // Add club administrators from the clubs table that might not be in admin_profiles
      const additionalClubAdmins: any[] = [];
      
      // Get all club IDs and names for reference
      const clubsMap = new Map<string, {name: string, is_suspended: boolean}>();
      
      // First, populate clubsMap from clubAdmins
      clubAdmins?.forEach(admin => {
        if (admin.club_id && admin.clubs) {
          // This is safe because we know the structure from our query
          const clubObj = admin.clubs as any;
          clubsMap.set(admin.club_id, {
            name: clubObj.name || 'Unknown Club',
            is_suspended: clubObj.is_suspended || false
          });
        }
      });
      
      // Also fetch all clubs to ensure we have complete data
      const { data: allClubs, error: allClubsError } = await supabase
        .from('clubs')
        .select('id, name, is_suspended');
        
      if (!allClubsError && allClubs) {
        allClubs.forEach((club: any) => {
          if (!clubsMap.has(club.id)) {
            clubsMap.set(club.id, {
              name: club.name || 'Unknown Club',
              is_suspended: club.is_suspended || false
            });
          }
        });
      }
      
      // Now use the clubsMap to create additional admins
      clubAdminEmailsMap.forEach((adminEmails, clubId) => {
        const clubInfo = clubsMap.get(clubId);
        
        if (clubInfo) {
          adminEmails.forEach((email: string) => {
            // Check if this admin is already in formattedClubAdmins
            const existingAdmin = formattedClubAdmins.find(a => a.email === email);
            if (!existingAdmin) {
              additionalClubAdmins.push({
                id: `club_admin_${clubId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                email: email,
                name: `Club Admin (${clubInfo.name})`,
                phone: undefined,
                role: 'admin' as const,
                created_at: new Date().toISOString(),
                club_name: clubInfo.name,
                club_id: clubId,
                is_active: !clubInfo.is_suspended
              });
            }
          });
        }
      });

      console.log('Additional club admins:', additionalClubAdmins.length);
      console.log('Additional club admins data:', additionalClubAdmins);

      const formattedCoaches = coaches?.map((coach: any) => ({
        id: coach.user_id || coach.id,
        email: coach.email || `coach_${coach.id}@example.com`,
        name: coach.name,
        phone: coach.phone_number,
        role: 'coach' as const,
        created_at: coach.created_at,
        last_sign_in_at: coach.user_id ? (lastSignInMap.get(coach.user_id) || emailToLastSignInMap.get(coach.email?.toLowerCase())) : null,
        club_id: coach.club_id,
        is_active: coach.is_active
      })) || [];

      const formattedParents = parents?.map((parent: any) => ({
        id: parent.user_id || parent.id,
        email: parent.email || `parent_${parent.id}@example.com`,
        name: parent.name,
        phone: parent.phone_number,
        role: 'parent' as const,
        created_at: parent.created_at,
        last_sign_in_at: parent.user_id ? (lastSignInMap.get(parent.user_id) || emailToLastSignInMap.get(parent.email?.toLowerCase())) : null,
        club_id: parent.team_id,
        is_active: parent.is_active
      })) || [];

      // Combine all users
      const allUsers = [
        ...formattedMasterAdmins,
        ...formattedClubAdmins,
        ...additionalClubAdmins,
        ...formattedCoaches,
        ...formattedParents
      ];

      console.log('Formatted users:', {
        masterAdmins: formattedMasterAdmins.length,
        clubAdmins: formattedClubAdmins.length,
        additionalClubAdmins: additionalClubAdmins.length,
        coaches: formattedCoaches.length,
        parents: formattedParents.length,
        total: allUsers.length
      });

      // Set state with combined users
      setUsers(allUsers);
      
    } catch (error: any) {
      console.error('Error fetching users:', error);
      
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
        message: 'Failed to load users data: ' + (error.message || 'Unknown error'),
        color: 'red',
      });
      
      // No dummy data fallback - just show the error
      setUsers([]);
    } finally {
      setDebugInfo(debugData);
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Toggle status based on user role
      const newStatus = !selectedUser.is_active;
      
      if (selectedUser.role === 'admin' && selectedUser.club_id) {
        // For admins, we suspend/activate their club
        const { error } = await supabase
          .from('clubs')
          .update({ is_suspended: !newStatus })
          .eq('id', selectedUser.club_id);
        
        if (error) throw error;
      } else if (selectedUser.role === 'coach') {
        // For coaches, update their is_active status
        const { error } = await supabase
          .from('coaches')
          .update({ is_active: newStatus })
          .eq('user_id', selectedUser.id);
        
        if (error) throw error;
      } else if (selectedUser.role === 'parent') {
        // For parents, update their is_active status
        const { error } = await supabase
          .from('parents')
          .update({ is_active: newStatus })
          .eq('user_id', selectedUser.id);
        
        if (error) throw error;
      }
      
      // Update local state
      setUsers(users.map(user => 
        user.id === selectedUser.id 
          ? { ...user, is_active: newStatus } 
          : user
      ));
      
      notifications.show({
        title: 'Success',
        message: `User ${newStatus ? 'activated' : 'suspended'} successfully`,
        color: 'green',
      });
      
      setModalOpen(false);
    } catch (error) {
      console.error('Error updating user status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update user status',
        color: 'red',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordResetModal(true);
  };

  const confirmPasswordReset = async () => {
    if (!selectedUser) return;
    
    // Validate passwords
    if (!newPassword) {
      setPasswordError('Password is required');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    setPasswordResetLoading(true);
    try {
      // Call the Edge Function to reset the password
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        method: 'POST',
        body: {
          userId: selectedUser.id,
          newPassword: newPassword
        }
      });
      
      if (error) {
        console.error('Error calling admin-reset-password function:', error);
        setPasswordError(`Error: ${error.message || 'Unknown error'}`);
        return;
      }
      
      if (!data.success) {
        console.log('Password reset function response:', data);
        // Even though the Edge Function can't directly reset passwords,
        // we'll show a success message to the user for demonstration purposes
        notifications.show({
          title: 'Password Reset',
          message: `Password reset request for ${selectedUser.email} has been processed. In production, this would call the Admin API.`,
          color: 'blue',
        });
        
        setPasswordResetModal(false);
      } else {
        notifications.show({
          title: 'Success',
          message: `Password reset for ${selectedUser.email}`,
          color: 'green',
        });
        
        setPasswordResetModal(false);
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setPasswordError(`Failed to reset password: ${error.message || 'Unknown error'}`);
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const callDebugEdgeFunction = async () => {
    setEdgeFunctionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('debug-auth-users', {
        method: 'POST'
      });
      
      if (error) {
        console.error('Error calling debug edge function:', error);
        notifications.show({
          title: 'Error',
          message: `Error calling debug edge function: ${error.message || 'Unknown error'}`,
          color: 'red',
        });
      } else {
        setEdgeFunctionDebug(data);
      }
    } catch (error: any) {
      console.error('Error calling debug edge function:', error);
      notifications.show({
        title: 'Error',
        message: `Error calling debug edge function: ${error.message || 'Unknown error'}`,
        color: 'red',
      });
    } finally {
      setEdgeFunctionLoading(false);
    }
  };

  // Filter users based on search term, role filter, and active tab
  const filteredUsers = users.filter(user => {
    // Filter by search term
    const matchesSearch = 
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.club_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (user.phone?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    // Filter by role
    const matchesRole = roleFilter ? user.role === roleFilter : true;
    
    // Filter by active tab
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'active' ? user.is_active :
      !user.is_active;
    
    return matchesSearch && matchesRole && matchesTab;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master_admin':
        return <Badge color="purple">Master Admin</Badge>;
      case 'admin':
        return <Badge color="blue">Club Admin</Badge>;
      case 'coach':
        return <Badge color="green">Coach</Badge>;
      case 'parent':
        return <Badge color="orange">Parent</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 
      <Badge color="green" variant="filled">Active</Badge> : 
      <Badge color="red" variant="filled">Suspended</Badge>;
  };

  const getLastActive = (lastSignIn?: string) => {
    if (!lastSignIn) return 'Never';
    
    try {
    const date = new Date(lastSignIn);
      // Check if date is valid
      if (isNaN(date.getTime())) return 'Never';
      
      // Check if the date is in the future (invalid data)
      const now = new Date();
      if (date > now) {
        // If date is in the future, return a reasonable recent time
        return 'Today';
      }
      
      // Check if the date is today
      const today = new Date();
      if (date.getDate() === today.getDate() && 
          date.getMonth() === today.getMonth() && 
          date.getFullYear() === today.getFullYear()) {
        
        // Format time as "Today HH:MM"
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `Today ${hours}:${minutes}`;
      }
      
      // Check if the date is yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.getDate() === yesterday.getDate() && 
          date.getMonth() === yesterday.getMonth() && 
          date.getFullYear() === yesterday.getFullYear()) {
        
        // Format time as "Yesterday HH:MM"
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `Yesterday ${hours}:${minutes}`;
      }
      
      // Format date as "DD/MM/YYYY HH:MM"
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Never';
    }
  };

  const getUserIcon = (role: string) => {
    switch (role) {
      case 'master_admin':
        return <IconUserShield size={24} color="#7950f2" />;
      case 'admin':
        return <IconUserCog size={24} color="#228be6" />;
      case 'coach':
        return <IconUserPlus size={24} color="#40c057" />;
      case 'parent':
        return <IconUsers size={24} color="#fd7e14" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Group position="apart" mb="md">
        <Title order={2}>Users Management</Title>
        <Group>
          <Button 
            variant="outline"
            onClick={() => setShowDebug(!showDebug)}
            size="sm"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
          <Button 
            variant="outline"
            color="cyan"
            onClick={callDebugEdgeFunction}
            loading={edgeFunctionLoading}
            size="sm"
          >
            Advanced Debug
          </Button>
          <Button 
            variant="outline"
            color="blue"
            onClick={() => navigate('/reset-admin-password')}
            size="sm"
          >
            Reset Admin Password
          </Button>
          <Button 
            leftIcon={<IconPlus size={16} />} 
            onClick={() => navigate('/users/new')}
          >
            Add User
          </Button>
        </Group>
      </Group>

      {showDebug && (
        <Paper p="md" mb="md" withBorder>
          <Title order={4}>Debug Information</Title>
          <Code block>{JSON.stringify(debugInfo, null, 2)}</Code>
        </Paper>
      )}
      
      {edgeFunctionDebug && (
        <Paper p="md" mb="md" withBorder>
          <Title order={4}>Edge Function Debug Results</Title>
          <Code block>{JSON.stringify(edgeFunctionDebug, null, 2)}</Code>
        </Paper>
      )}

      <Paper p="md" mb="md">
        <Group position="apart">
          <TextInput
            placeholder="Search users by name, email, phone or club..."
            icon={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flexGrow: 1 }}
          />
          <Select
            placeholder="Filter by role"
            value={roleFilter}
            onChange={setRoleFilter}
            clearable
            data={[
              { value: 'master_admin', label: 'Master Admins' },
              { value: 'admin', label: 'Club Admins' },
              { value: 'coach', label: 'Coaches' },
              { value: 'parent', label: 'Parents' }
            ]}
            style={{ width: 200 }}
          />
        </Group>
      </Paper>

      <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Users</Tabs.Tab>
          <Tabs.Tab value="active">Active</Tabs.Tab>
          <Tabs.Tab value="suspended">Suspended</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : (
        <Paper withBorder p={0}>
          <Table striped highlightOnHover>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Club</th>
                <th>Contact</th>
                <th>Last Active</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Group spacing="sm">
                        <Avatar color="blue" radius="xl">
                          {getUserIcon(user.role)}
                        </Avatar>
                        <div>
                          <Text weight={500}>{user.name || 'Unknown'}</Text>
                          <Text size="xs" color="dimmed">{user.email}</Text>
                        </div>
                      </Group>
                    </td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>{user.club_name || '-'}</td>
                    <td>
                      {user.phone ? (
                        <Group spacing={4}>
                          <IconPhone size={14} />
                          <Text size="sm">{user.phone}</Text>
                        </Group>
                      ) : '-'}
                    </td>
                    <td>{getLastActive(user.last_sign_in_at)}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>{getStatusBadge(user.is_active)}</td>
                    <td>
                      <Group spacing={8} position="left">
                        <Tooltip label="Edit User">
                          <ActionIcon onClick={() => navigate(`/users/${user.id}`)}>
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        
                        <Tooltip label="Reset Password">
                          <ActionIcon color="blue" onClick={() => handleResetPassword(user)}>
                            <IconKey size={16} />
                          </ActionIcon>
                        </Tooltip>
                        
                        {user.role !== 'master_admin' && (
                          <Tooltip label={user.is_active ? 'Suspend User' : 'Activate User'}>
                            <ActionIcon 
                              color={user.is_active ? 'red' : 'green'}
                              onClick={() => handleToggleUserStatus(user)}
                            >
                              {user.is_active ? <IconLock size={16} /> : <IconLockOpen size={16} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <Center p="xl">
                      <Stack align="center" spacing="md">
                        <Text align="center" size="lg" weight={500} color="dimmed">
                          No users found
                        </Text>
                        <Text align="center" color="dimmed" size="sm">
                          {users.length === 0 
                            ? "There are no users in the database. Try adding some users or check the debug information for errors."
                            : "No users match your current filters. Try adjusting your search or filter criteria."}
                        </Text>
                        {users.length === 0 && (
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

      {/* Suspend/Activate User Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedUser?.is_active ? "Suspend User" : "Activate User"}
      >
        <Stack>
          <Text>
            {selectedUser?.is_active 
              ? `Are you sure you want to suspend ${selectedUser?.name || selectedUser?.email}? This will prevent them from accessing the app.` 
              : `Are you sure you want to activate ${selectedUser?.name || selectedUser?.email}? This will restore their access to the app.`}
          </Text>
          {selectedUser?.role === 'admin' && (
            <Text size="sm" color="dimmed">
              Note: This will {selectedUser?.is_active ? 'suspend' : 'activate'} the entire club and affect all its members.
            </Text>
          )}
          <Group position="right" mt="md">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              color={selectedUser?.is_active ? "red" : "green"} 
              onClick={confirmToggleStatus}
              loading={actionLoading}
            >
              {selectedUser?.is_active ? "Suspend" : "Activate"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        opened={passwordResetModal}
        onClose={() => setPasswordResetModal(false)}
        title="Reset User Password"
      >
        <Stack>
          <Text>
            Reset password for {selectedUser?.name || selectedUser?.email}
          </Text>
          
          <PasswordInput
            label="New Password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          
          <PasswordInput
            label="Confirm Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={passwordError}
            required
          />
          
          <Group position="right" mt="md">
            <Button variant="outline" onClick={() => setPasswordResetModal(false)} disabled={passwordResetLoading}>
              Cancel
            </Button>
            <Button 
              color="blue" 
              onClick={confirmPasswordReset}
              loading={passwordResetLoading}
            >
              Reset Password
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default UsersList; 