import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  PasswordInput,
  Button,
  Group,
  Alert,
  Stack,
  TextInput,
  Divider,
  Code
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

const AdminPasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const handleResetPassword = async () => {
    setError('');
    setSuccess(false);
    setDebugInfo(null);

    // Basic validation
    if (!email) {
      setError('Email is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // First, check if the email exists in master_admins table
      const { data: adminData, error: adminError } = await supabase
        .from('master_admins')
        .select('*')
        .eq('email', email)
        .single();

      if (adminError) {
        console.error('Error checking master admin:', adminError);
        setDebugInfo({ adminError });
        
        if (adminError.code === 'PGRST116') {
          setError(`No master admin found with email: ${email}`);
        } else {
          setError(`Error checking master admin: ${adminError.message}`);
        }
        return;
      }

      // Try to sign in with the email to verify it exists in auth.users
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'temporary-password-for-check-only'
      });

      // We expect this to fail with wrong password, but we want to make sure the user exists
      setDebugInfo({
        ...debugInfo,
        signInAttempt: {
          email,
          error: signInError ? {
            name: signInError.name,
            message: signInError.message
          } : null
        }
      });

      if (signInError && signInError.message.includes("Invalid login credentials")) {
        // This is good - it means the user exists but password is wrong
        // Now we can use the password reset flow
        const { data: resetData, error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/reset-password-confirmation`
          }
        );

        setDebugInfo({
          ...debugInfo,
          resetPasswordAttempt: {
            email,
            error: resetError ? {
              name: resetError.name,
              message: resetError.message
            } : null,
            data: resetData
          }
        });

        if (resetError) {
          setError(`Error sending password reset email: ${resetError.message}`);
          return;
        }

        setSuccess(true);
      } else if (!signInError) {
        // This means the login succeeded, which is unexpected
        setError('Unexpected successful login with test password. Please contact support.');
        return;
      } else {
        // Some other error occurred
        setError(`Error checking user: ${signInError.message}`);
        return;
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
      setDebugInfo({ unexpectedError: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} align="center" mb="md">
          Reset Master Admin Password
        </Title>
        
        <Text color="dimmed" size="sm" mb="md">
          This utility will send a password reset email to the master admin account.
          You will receive an email with instructions to set a new password.
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} title="Success" color="green" mb="md">
            Password reset email has been sent to {email}. Please check your inbox and follow the instructions.
          </Alert>
        )}

        <Stack>
          <TextInput
            label="Email Address"
            placeholder="master.admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <PasswordInput
            label="New Password"
            placeholder="Your new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Group position="apart" mt="md">
            <Button variant="subtle" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button loading={loading} onClick={handleResetPassword}>
              Send Reset Email
            </Button>
          </Group>
        </Stack>

        {debugInfo && (
          <>
            <Divider my="md" />
            <Text size="sm" weight={500} mb="xs">Debug Information</Text>
            <Code block>{JSON.stringify(debugInfo, null, 2)}</Code>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default AdminPasswordReset; 