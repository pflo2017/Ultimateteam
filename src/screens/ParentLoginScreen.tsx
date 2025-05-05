import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ParentLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentLogin'>;

const COUNTRY_CODE = '+40';

export const ParentLoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState(COUNTRY_CODE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<ParentLoginScreenNavigationProp>();

  const handleContinue = async () => {
    // Remove spaces from phone number before sending to API
    const cleanedPhoneNumber = phoneNumber.replace(/\s/g, '');
    
    if (!isValidRomanianPhoneNumber(cleanedPhoneNumber)) {
      setError('Please enter a valid Romanian phone number');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Check if the phone number exists in the parents table
      const { data: existingParent, error: queryError } = await supabase
        .from('parents')
        .select('id')
        .eq('phone_number', cleanedPhoneNumber)
        .single();

      if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw queryError;
      }

      if (existingParent) {
        // Parent exists, navigate to password login
        navigation.navigate('ParentPasswordLogin', { phoneNumber: cleanedPhoneNumber });
      } else {
        // New parent, start registration flow
        navigation.navigate('ParentRegistration', { 
          phoneNumber: cleanedPhoneNumber
        });
      }
    } catch (error) {
      console.error('Error checking phone number:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidRomanianPhoneNumber = (phone: string) => {
    // Romanian phone numbers: +40 followed by 9 digits
    // Valid formats: +40721234567, +40 721 234 567
    const cleanedNumber = phone.replace(/\s/g, '');
    return /^\+40[0-9]{9}$/.test(cleanedNumber);
  };

  const formatPhoneNumber = (text: string) => {
    // Remove any non-digit characters except the plus sign
    const cleaned = text.replace(/[^\d+]/g, '');
    
    // Always keep the country code
    if (!cleaned.startsWith(COUNTRY_CODE)) {
      return COUNTRY_CODE;
    }

    // Format as +40 XXX XXX XXX
    let formatted = COUNTRY_CODE;
    const numbers = cleaned.slice(3); // Remove +40
    
    if (numbers.length > 0) {
      formatted += ' ' + numbers.slice(0, 3);
      if (numbers.length > 3) {
        formatted += ' ' + numbers.slice(3, 6);
        if (numbers.length > 6) {
          formatted += ' ' + numbers.slice(6, 9);
        }
      }
    }

    return formatted;
  };

  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    if (error) setError('');
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
            name="account-child" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>Parent Login</Text>
          <Text style={styles.subtitle}>Enter your Romanian phone number</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="phone" color={COLORS.primary} />}
            error={!!error}
            maxLength={15} // +40 XXX XXX XXX
            disabled={isLoading}
          />
          
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.helperText}>Format: +40 XXX XXX XXX</Text>
          )}

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              style={[
                styles.loginButton, 
                SHADOWS.button,
                (isLoading || !isValidRomanianPhoneNumber(phoneNumber)) && styles.buttonDisabled
              ]}
              onPress={handleContinue}
              disabled={isLoading || !isValidRomanianPhoneNumber(phoneNumber)}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </Pressable>
          </Animated.View>
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
  loginButton: {
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
  helperText: {
    color: COLORS.grey[600],
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    marginTop: -SPACING.md,
    textAlign: 'center',
  },
}); 