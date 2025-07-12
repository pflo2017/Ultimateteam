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
  Anchor
} from '@mantine/core';
import { supabase } from '../lib/supabase';

const MasterAdminLogin: React.FC = () => {
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
      console.log('Attempting master admin login with:', email);
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      console.log('Existing session before login attempt:', existingSession ? 'Yes' : 'No');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      console.log('Login response:', { data, error });
      if (error) throw error;
      if (data.user) {
        // Check if the user is a master admin
        const { data: adminData, error: adminError } = await supabase
          .from('master_admins')
          .select('*')
          .eq('user_id', data.user.id);
        if (adminError) throw adminError;
        if (!adminData || adminData.length === 0) {
          await supabase.auth.signOut();
          throw new Error('You do not have permission to access the master admin dashboard');
        }
        // Store the user role in localStorage
        localStorage.setItem('userRole', 'masterAdmin');
        navigate('/admin');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title align="center" sx={(theme) => ({ fontWeight: 900 })}>
        Master Admin Login
      </Title>
      <Text color="dimmed" size="sm" align="center" mt={5}>
        Only for platform owner. Club admins should not use this page.
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
              onClick={() => navigate('/reset-password')}
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

export default MasterAdminLogin; 