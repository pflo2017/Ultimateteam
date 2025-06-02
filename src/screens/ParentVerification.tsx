import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Keyboard, Platform } from 'react-native';
import { Text, Button, TextInput, IconButton } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { supabase } from '../lib/supabase';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentVerification'>;

const SMS_CODE_LENGTH = 6;
const CODE_TIMEOUT = 5 * 60; // 5 minutes in seconds
const RESEND_COOLDOWN = 30; // 30 seconds

export default function ParentVerificationScreen({ navigation, route }: Props) {
  const { phoneNumber, isRegistration } = route.params;
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(CODE_TIMEOUT);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const inputRef = useRef<any>(undefined);

  useEffect(() => {
    // Start countdown for code expiration
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Send initial SMS code
    sendVerificationCode();

    return () => {
      clearInterval(timerRef.current);
      clearInterval(cooldownRef.current);
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
          type: 'verification'
        }
      });

      if (error) throw error;
      
      // Start resend cooldown
      setResendCooldown(RESEND_COOLDOWN);
      cooldownRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
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

      // Update parent verification status
      await supabase
        .from('parents')
        .update({ phone_verified: true })
        .eq('phone_number', phoneNumber);

      // Navigate based on whether this is registration or login
      if (isRegistration) {
        navigation.navigate('ParentTeamCode', { phoneNumber });
      } else {
        navigation.navigate('ParentPasswordLogin', { phoneNumber });
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('Invalid verification code. Please try again.');
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
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.header}>
        <Icon 
          name="chevron-left" 
          size={32} 
          color={COLORS.primary}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </View>

      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Verify your phone
        </Text>
        
        <Text variant="bodyLarge" style={styles.subtitle}>
          Enter the 6-digit code sent to {phoneNumber}
        </Text>

        <TextInput
          ref={inputRef}
          mode="flat"
          value={verificationCode}
          onChangeText={text => {
            const numbers = text.replace(/[^0-9]/g, '');
            if (numbers.length <= SMS_CODE_LENGTH) {
              setVerificationCode(numbers);
              setError('');
            }
          }}
          keyboardType="number-pad"
          maxLength={SMS_CODE_LENGTH}
          style={styles.input}
          placeholder="000000"
          placeholderTextColor="#999"
          error={!!error}
          theme={{ colors: { primary: '#0CC1EC' }}}
          autoFocus
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Text style={styles.timerText}>
            Code expires in: {formatTime(timeLeft)}
          </Text>
        )}

        <Button
          mode="contained"
          onPress={handleVerification}
          loading={isLoading}
          disabled={isLoading || verificationCode.length !== SMS_CODE_LENGTH}
          style={styles.verifyButton}
          contentStyle={styles.buttonContent}
          buttonColor={COLORS.primary}
        >
          Verify
        </Button>

        <Button
          mode="text"
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={styles.resendButton}
          textColor={COLORS.primary}
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : 'Resend code'}
        </Button>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#000',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    fontSize: 16,
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: '#fff',
    height: 56,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputOutline: {
    borderRadius: 30,
  },
  inputContent: {
    fontSize: 24,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 24,
  },
  timerText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  verifyButton: {
    marginTop: 8,
    borderRadius: 30,
  },
  buttonContent: {
    height: 56,
  },
  resendButton: {
    marginTop: 16,
  },
}); 