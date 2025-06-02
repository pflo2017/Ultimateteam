import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ParentResetPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentResetPassword'>;
type ParentResetPasswordScreenRouteProp = RouteProp<RootStackParamList, 'ParentResetPassword'>;

const SMS_CODE_LENGTH = 6;
const CODE_TIMEOUT = 5 * 60; // 5 minutes in seconds
const RESEND_COOLDOWN = 30; // 30 seconds

export const ParentResetPasswordScreen = () => {
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(CODE_TIMEOUT);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [step, setStep] = useState<'verify' | 'new-password'>('verify');
  
  const navigation = useNavigation<ParentResetPasswordScreenNavigationProp>();
  const route = useRoute<ParentResetPasswordScreenRouteProp>();
  const { phoneNumber } = route.params;
  
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    // Start countdown for code expiration
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = timer;

    // Send initial verification code
    sendVerificationCode();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendVerificationCode = async () => {
    try {
      setError('');
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          phoneNumber,
          type: 'reset-password'
        }
      });

      if (error) throw error;
      
      // Start resend cooldown
      setResendCooldown(RESEND_COOLDOWN);
      const cooldown = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      cooldownRef.current = cooldown;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      setError('Failed to send verification code. Please try again.');
    }
  };

  const handleVerification = async () => {
    if (verificationCode.length !== SMS_CODE_LENGTH) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    if (timeLeft === 0) {
      setError('Code has expired. Please request a new one.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('verify-sms', {
        body: {
          phoneNumber,
          code: verificationCode
        }
      });

      if (error) throw error;

      // Move to password reset step
      setStep('new-password');
    } catch (error) {
      console.error('Verification error:', error);
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get parent data
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (parentError) throw parentError;

      // Update password in parents table
      const { error: updateError } = await supabase
        .from('parents')
        .update({ password: newPassword })
        .eq('id', parent.id);

      if (updateError) throw updateError;

      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      // Navigate back to login
      navigation.navigate('ParentPasswordLogin', { phoneNumber });
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setTimeLeft(CODE_TIMEOUT);
    sendVerificationCode();
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

      <Animated.View 
        entering={FadeInDown.duration(1000).springify()}
        style={styles.content}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons 
            name="lock-reset" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>
            {step === 'verify' ? 'Reset Password' : 'Create New Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'verify' 
              ? 'Enter the verification code sent to your phone'
              : 'Enter your new password'}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 'verify' ? (
            <>
              <TextInput
                label="Verification Code"
                value={verificationCode}
                onChangeText={text => {
                  const numbers = text.replace(/[^0-9]/g, '');
                  if (numbers.length <= SMS_CODE_LENGTH) {
                    setVerificationCode(numbers);
                    if (error) setError('');
                  }
                }}
                keyboardType="number-pad"
                maxLength={SMS_CODE_LENGTH}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{ colors: { primary: COLORS.primary }}}
                error={!!error}
                disabled={isLoading}
                autoFocus
              />

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.timerText}>
                  Code expires in: {formatTime(timeLeft)}
                </Text>
              )}

              <Pressable
                onPress={handleResend}
                disabled={resendCooldown > 0}
                style={styles.resendButton}
              >
                <Text style={styles.resendText}>
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </Text>
              </Pressable>

              <Pressable 
                style={[
                  styles.submitButton, 
                  SHADOWS.button,
                  (isLoading || verificationCode.length !== SMS_CODE_LENGTH) && styles.buttonDisabled
                ]}
                onPress={handleVerification}
                disabled={isLoading || verificationCode.length !== SMS_CODE_LENGTH}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (error) setError('');
                }}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{ colors: { primary: COLORS.primary }}}
                secureTextEntry={!showPassword}
                error={!!error}
                disabled={isLoading}
                right={
                  <TextInput.Icon 
                    icon={showPassword ? "eye-off" : "eye"} 
                    onPress={() => setShowPassword(!showPassword)}
                    color={COLORS.grey[400]}
                  />
                }
              />

              <TextInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError('');
                }}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{ colors: { primary: COLORS.primary }}}
                secureTextEntry={!showConfirmPassword}
                error={!!error}
                disabled={isLoading}
                right={
                  <TextInput.Icon 
                    icon={showConfirmPassword ? "eye-off" : "eye"} 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    color={COLORS.grey[400]}
                  />
                }
              />

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <Pressable 
                style={[
                  styles.submitButton, 
                  SHADOWS.button,
                  (isLoading || !newPassword.trim() || !confirmPassword.trim()) && styles.buttonDisabled
                ]}
                onPress={handleResetPassword}
                disabled={isLoading || !newPassword.trim() || !confirmPassword.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
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
  inputOutline: {
    borderRadius: 100,
    borderWidth: 1,
  },
  inputContent: {
    fontFamily: 'Urbanist',
    fontSize: FONT_SIZES.md,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: {
    backgroundColor: COLORS.grey[300],
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
    fontFamily: 'Urbanist',
    marginTop: -SPACING.md,
  },
  timerText: {
    color: COLORS.grey[600],
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    textAlign: 'center',
    marginTop: -SPACING.md,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: -SPACING.md,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    fontWeight: '600',
  },
}); 