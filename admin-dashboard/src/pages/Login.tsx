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
  Box
} from '@mantine/core';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
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
          throw new Error('You do not have permission to access this dashboard');
        }
        
        // Successfully authenticated as master admin
        console.log('Successfully authenticated as admin');
        setDebug(prev => `${prev}\nSuccess! Redirecting...`);
        navigate('/');
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
        UltimateTeam Master Admin
      </Title>
      <Text color="dimmed" size="sm" align="center" mt={5}>
        Manage all clubs and billing from one place
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
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