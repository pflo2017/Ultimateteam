import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Code,
  Divider,
  Loader,
  Center
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

const ResetPasswordConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [hash, setHash] = useState<string | null>(null);

  // Extract the hash from the URL
  useEffect(() => {
    const hashFragment = location.hash;
    if (hashFragment) {
      // Remove the leading '#' character
      setHash(hashFragment.substring(1));
    }
    setInitializing(false);
  }, [location]);

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess(false);
    setDebugInfo(null);

    // Basic validation
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
      // Update the user's password
      const { data, error: updateError } = await supabase.auth.updateUser({
        password
      });

      setDebugInfo({
        updateAttempt: {
          error: updateError ? {
            name: updateError.name,
            message: updateError.message
          } : null,
          data: data ? {
            user: {
              id: data.user?.id,
              email: data.user?.email,
              updated_at: data.user?.updated_at
            }
          } : null
        }
      });

      if (updateError) {
        setError(`Error updating password: ${updateError.message}`);
        return;
      }

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
      setDebugInfo({ unexpectedError: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <Center style={{ height: '100vh' }}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (!hash) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="md" p="xl" withBorder>
          <Title order={2} align="center" mb="md">
            Invalid Reset Link
          </Title>
          <Text align="center" mb="md">
            This password reset link is invalid or has expired. Please request a new password reset.
          </Text>
          <Group position="center">
            <Button onClick={() => navigate('/reset-admin-password')}>
              Back to Reset Password
            </Button>
          </Group>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} align="center" mb="md">
          Set New Password
        </Title>
        
        <Text color="dimmed" size="sm" mb="md">
          Please enter your new password below.
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} title="Success" color="green" mb="md">
            Your password has been updated successfully. You will be redirected to the login page in a few seconds.
          </Alert>
        )}

        <Stack>
          <PasswordInput
            label="New Password"
            placeholder="Your new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={success}
            required
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={success}
            required
          />

          <Group position="apart" mt="md">
            <Button variant="subtle" onClick={() => navigate('/login')} disabled={loading || success}>
              Cancel
            </Button>
            <Button loading={loading} onClick={handleUpdatePassword} disabled={success}>
              Update Password
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

export default ResetPasswordConfirmation; 