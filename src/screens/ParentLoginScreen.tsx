import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PhoneInput from 'react-native-phone-number-input';

type ParentLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentLogin'>;

export const ParentLoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<ParentLoginScreenNavigationProp>();
  const phoneInputRef = React.useRef<PhoneInput>(null);

  // Handle back button press with improved navigation
  const handleBackPress = () => {
    // Navigate back to the Home screen
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Home'
      })
    );
  };

  const handleContinue = async () => {
    // Remove spaces from phone number before sending to API
    const cleanedPhoneNumber = phoneNumber.replace(/\s/g, '');
    
    console.log('Checking phone number:', cleanedPhoneNumber);

    if (!isValidPhoneNumber()) {
      setError('Please enter a valid phone number');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log('Checking if phone number exists in parents table...');
      // Check if the phone number exists in the parents table
      const { data: existingParent, error: queryError } = await supabase
        .from('parents')
        .select('id, name')
        .eq('phone_number', cleanedPhoneNumber)
        .single();

      console.log('Query response:', existingParent ? `Found parent: ${existingParent.name}` : 'No parent found', 
                 queryError ? `Error: ${queryError.message}` : 'No error');

      if (queryError) {
        if (queryError.code === 'PGRST116') { // PGRST116 is "not found" error
          console.log('Parent not found, redirecting to registration');
          // New parent, start registration flow
          navigation.navigate('ParentRegistration', { 
            phoneNumber: cleanedPhoneNumber
          });
        } else {
        throw queryError;
      }
      } else if (existingParent) {
        console.log('Parent found, navigating to password login');
        // Parent exists, navigate to password login
        navigation.navigate('ParentPasswordLogin', { phoneNumber: cleanedPhoneNumber });
      } else {
        console.log('No parent found but no error, redirecting to registration');
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

  const isValidPhoneNumber = () => {
    // Remove spaces and check for + and at least 10 digits
    const cleaned = phoneNumber.replace(/\s/g, '');
    return /^\+\d{10,}$/.test(cleaned);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Pressable 
        style={styles.backButton} 
        onPress={handleBackPress}
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
          <Text style={styles.subtitle}>Enter your phone number to continue.</Text>
        </View>

        <View style={styles.form}>
          {/* Phone Number Input with Country Picker */}
          <TextInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={text => {
              let formatted = text;
              if (formatted.startsWith('0')) {
                formatted = '+40' + formatted.slice(1);
              }
              setPhoneNumber(formatted);
              if (error) setError('');
            }}
            mode="flat"
            keyboardType="phone-pad"
            style={styles.input}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="phone" color={COLORS.primary} style={{ marginRight: 30 }} />}
            underlineColor={COLORS.primary}
            placeholder="e.g. +40 734 108 108"
          />
          <Text style={styles.helperText}>
            Please enter your phone number in international format, e.g. +40 734 108 108
          </Text>
          
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              style={[
                styles.loginButton,
                SHADOWS.button,
                isLoading && styles.loginButtonDisabled
              ]}
              onPress={() => {
                const cleaned = phoneNumber.replace(/\s/g, '');
                if (!/^\+[0-9]{10,}$/.test(cleaned)) {
                  setError('Please enter your phone number in international format, e.g. +40 734 108 108');
                  return;
                }
                handleContinue();
              }}
              disabled={isLoading}
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
  loginButtonDisabled: {
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