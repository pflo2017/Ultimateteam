import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type CoachResetPasswordScreenRouteProp = RouteProp<RootStackParamList, 'CoachResetPassword'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CoachResetPasswordScreen = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CoachResetPasswordScreenRouteProp>();
  const { phone } = route.params;

  const handleResetPassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // First, try to sign in to verify the phone number is registered
      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: phone,
        password: 'dummy-password' // This will fail, but we just want to check if the user exists
      });

      // If the error is not about invalid credentials, something else is wrong
      if (signInError && !signInError.message.includes('Invalid login credentials')) {
        throw signInError;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim()
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('CoachLogin')
          }
        ]
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Pressable 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <MaterialCommunityIcons 
          name="arrow-left" 
          size={24} 
          color={COLORS.primary}
        />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons 
            name="lock-reset" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your new password below
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="New Password"
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (error) setError('');
            }}
            mode="flat"
            secureTextEntry
            style={styles.input}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
          />
          <TextInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={text => {
              setConfirmPassword(text);
              if (error) setError('');
            }}
            mode="flat"
            secureTextEntry
            style={styles.input}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="lock-check" color={COLORS.primary} style={{ marginRight: 30 }} />}
          />
          <Pressable 
            onPress={handleResetPassword}
            disabled={isLoading}
            style={[styles.resetButton, SHADOWS.button, isLoading && styles.resetButtonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Text>
          </Pressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.xl * 2,
    left: SPACING.lg,
    zIndex: 1,
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  form: {
    gap: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.background,
    height: 58,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontFamily: 'Urbanist',
  },
}); 