import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TextInput, 
  PasswordInput, 
  Button, 
  Paper, 
  Title, 
  Container, 
  Group, 
  Text, 
  Anchor,
  Box,
  Tabs
} from '@mantine/core';
import { supabase } from '../lib/supabase';

interface LoginProps {
  setHasExplicitLogin: React.Dispatch<React.SetStateAction<boolean>>;
}

const Login: React.FC<LoginProps> = ({ setHasExplicitLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('master');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebug(null);

    try {
      // Log for debugging
      console.log('Attempting login with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Log for debugging
        console.log('User authenticated:', data.user.id);
        setDebug(`User authenticated: ${data.user.id}`);
        
        if (activeTab === 'master') {
          // Check if the user is a master admin
          const { data: adminData, error: adminError } = await supabase
            .from('master_admins')
            .select('*')
            .eq('user_id', data.user.id);
            
          // Log query results
          console.log('Admin check result:', { adminData, adminError });
          setDebug(prev => `${prev}\nAdmin check: ${JSON.stringify({ adminData, adminError })}`);
          
          if (adminError) {
            console.error('Error checking admin status:', adminError);
            setDebug(prev => `${prev}\nError: ${adminError.message}`);
            throw adminError;
          }
          
          if (!adminData || adminData.length === 0) {
            // If not a master admin, sign out and show error
            await supabase.auth.signOut();
            throw new Error('You do not have permission to access the master admin dashboard');
          }
          
          // Successfully authenticated as master admin
          console.log('Successfully authenticated as master admin');
          setDebug(prev => `${prev}\nSuccess! Redirecting to master dashboard...`);
          
          // Store the user role in localStorage
          localStorage.setItem('userRole', 'masterAdmin');
          
          // Set explicit login flag
          setHasExplicitLogin(true);
          
          navigate('/dashboard');
        } else {
          // Check if the user is a club admin
          const { data: clubData, error: clubError } = await supabase
            .from('clubs')
            .select('*')
            .eq('admin_id', data.user.id);
            
          // Log query results
          console.log('Club admin check result:', { clubData, clubError });
          setDebug(prev => `${prev}\nClub admin check: ${JSON.stringify({ clubData, clubError })}`);
          
          if (clubError) {
            console.error('Error checking club admin status:', clubError);
            setDebug(prev => `${prev}\nError: ${clubError.message}`);
            throw clubError;
          }
          
          if (!clubData || clubData.length === 0) {
            // If not a club admin, sign out and show error
            await supabase.auth.signOut();
            throw new Error('You do not have permission to access the club admin dashboard');
          }
          
          // Successfully authenticated as club admin
          console.log('Successfully authenticated as club admin');
          setDebug(prev => `${prev}\nSuccess! Redirecting to club dashboard...`);
          
          // Store the user role and club ID in localStorage
          localStorage.setItem('userRole', 'clubAdmin');
          localStorage.setItem('clubId', clubData[0].id);
          localStorage.setItem('clubName', clubData[0].name);
          
          // Set explicit login flag
          setHasExplicitLogin(true);
          
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Error logging in:', error);
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title align="center" sx={(theme) => ({ fontWeight: 900 })}>
        UltimateTeam Admin Dashboard
      </Title>
      <Text color="dimmed" size="sm" align="center" mt={5}>
        {activeTab === 'master' 
          ? 'Manage all clubs and billing from one place' 
          : 'Manage your club, teams, and schedule'}
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Tabs value={activeTab} onTabChange={setActiveTab} mb="md">
          <Tabs.List grow>
            <Tabs.Tab value="master">Master Admin</Tabs.Tab>
            <Tabs.Tab value="club">Club Admin</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        
        <form onSubmit={handleLogin}>
          {error && (
            <Text color="red" size="sm" mb={15}>
              {error}
            </Text>
          )}
          
          {debug && (
            <Paper withBorder p="xs" mb={15} style={{maxHeight: '150px', overflow: 'auto'}}>
              <Text size="xs" style={{whiteSpace: 'pre-wrap', fontFamily: 'monospace'}}>
                {debug}
              </Text>
            </Paper>
          )}
          
          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mt="md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          
          <Group position="apart" mt="lg">
            <Anchor 
              component="button" 
              size="sm"
              onClick={() => navigate('/reset-admin-password')}
            >
              Forgot password?
            </Anchor>
          </Group>
          
          <Button 
            fullWidth 
            mt="xl" 
            type="submit" 
            loading={loading}
          >
            Sign in
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default Login; 