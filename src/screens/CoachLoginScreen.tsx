import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PhoneInput from 'react-native-phone-number-input';

type RootStackParamList = {
  Home: undefined;
  Coach: undefined;
  CoachResetPassword: { phone: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CoachData {
  id: string;
  name: string;
  club_id: string;
  is_active: boolean;
  phone_number: string;
}

export const CoachLoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'register' | 'login'>('phone');
  const [coach, setCoach] = useState<any>(null);
  const navigation = useNavigation<NavigationProp>();
  const phoneInputRef = React.useRef<PhoneInput>(null);

  const isValidPhoneNumber = () => {
    // Remove spaces and check for + and at least 10 digits
    const cleaned = phone.replace(/\s/g, '');
    return /^\+\d{10,}$/.test(cleaned);
  };

  const handlePhoneSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Format phone number to E.164 format (e.g., +40712345678)
      const formattedPhone = phone.trim();
      console.log('Attempting to login with phone number:', formattedPhone);
      
      // First, let's check what coaches exist in the database
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('phone_number', formattedPhone)
        .single();

      if (coachError) {
        console.log('Coach lookup error:', coachError);
      }
      
      if (coachError || !coachData) {
        setError('No coach found with this phone number. Please contact your administrator.');
        setIsLoading(false);
        return;
      }

      console.log('Found coach:', coachData);
      setCoach(coachData);
      
      // If coach has no user_id, check if there's an auth user with this phone
      if (!coachData.user_id) {
        console.log('Coach has no user_id. Checking for existing auth user...');
        
        // Try to sign in with a dummy password to check if user exists
        const { error: signInError } = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password: 'this-is-a-dummy-password-that-will-fail'
        });
        
        // If error contains "Invalid login credentials", user exists but password is wrong
        if (signInError && signInError.message && 
            (signInError.message.includes('Invalid login credentials') || 
             signInError.message.includes('Invalid login'))) {
          console.log('Auth user exists but not linked to coach. Showing login screen.');
          setStep('login');
          setIsLoading(false);
          return;
        }
        
        // Otherwise, this is a new registration
        setStep('register');
      } else {
        // Coach already has user_id, proceed to login
        setStep('login');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setError('');
    if (password.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    try {
      // Ensure phone is in E.164 format
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        setError('Phone number must start with + and country code.');
        setIsLoading(false);
        return;
      }
      
      // Register with Supabase Auth (phone+password)
      const { data, error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password: password.trim(),
        options: email ? { data: { email } } : undefined
      });

      if (error) {
        console.error('Supabase signUp error:', error);
        
        // Handle the case where user is already registered in Auth but not linked in coaches table
        if (error.message && error.message.toLowerCase().includes('user already registered')) {
          console.log('User already exists in Auth. Attempting to sign in and link coach record...');
          
          try {
            // Try to sign in with the provided credentials
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              phone: formattedPhone,
              password: password.trim()
            });
            
            if (signInError) {
              console.error('Error signing in after "already registered" error:', signInError);
              Alert.alert(
                'Already Registered', 
                'This phone number is already registered. Please use your existing password to log in.',
                [{ text: 'OK', onPress: () => setStep('login') }]
              );
              setIsLoading(false);
              return;
            }
            
            if (!signInData.user) {
              setError('Failed to retrieve user data after sign-in');
              setIsLoading(false);
              return;
            }
            
            // Got the user ID, now update the coach record
            const userId = signInData.user.id;
            console.log('Successfully signed in. Linking coach record with Auth user ID:', userId);
            
            const { error: updateError } = await supabase
              .from('coaches')
              .update({ user_id: userId })
              .eq('id', coach.id);
              
            if (updateError) {
              console.error('Error linking coach record to Auth user:', updateError);
              Alert.alert(
                'Warning',
                'Login successful, but failed to link your coach profile. Please contact support.'
              );
              setIsLoading(false);
              return;
            }
            
            // Store coach data and reload
            await AsyncStorage.setItem('coach_data', JSON.stringify({ 
              id: coach.id, 
              name: coach.name, 
              club_id: coach.club_id, 
              is_active: coach.is_active, 
              phone_number: coach.phone_number, 
              user_id: userId 
            }));
            
            console.log('Successfully linked coach record to existing Auth user!');
            if (global.reloadRole) global.reloadRole();
            return;
          } catch (err) {
            console.error('Error during linking process:', err);
            setError('An error occurred while trying to link your account.');
            setIsLoading(false);
            return;
          }
        }
        
        // If not a "user already registered" error, show the general error
        Alert.alert('Registration Error', error.message);
        setIsLoading(false);
        return;
      }
      
      if (!data || !data.user) {
        setError('No user returned from Supabase signUp.');
        setIsLoading(false);
        return;
      }
      
      const userId = data.user.id;
      console.log('User created with ID:', userId);
      
      // Important: Sign in after signup to get a valid session with the right JWT
      console.log('Signing in to refresh session...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password.trim()
      });
      
      if (signInError) {
        console.error('Error signing in after registration:', signInError);
        Alert.alert('Warning', 'Registration succeeded but automatic login failed. Please log out and log in again.');
      }
      
      // Short delay to ensure the session is fully updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update coaches.user_id
      console.log('Attempting to update coach user_id:', userId, 'for coach:', coach.id);
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ user_id: userId })
        .eq('id', coach.id);
        
      if (updateError) {
        console.error('Error updating coach user_id:', updateError);
        Alert.alert('Warning', 
          'Account created but could not link to your coach profile. Please contact support or try logging in again later.\n\nError: ' + updateError.message
        );
        setIsLoading(false);
        return;
      } else {
        console.log('Successfully updated coach user_id:', userId);
      }
      
      // Re-fetch coach data to confirm user_id is set
      const { data: updatedCoach, error: fetchError } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coach.id)
        .single();
        
      if (fetchError) {
        console.error('Error fetching updated coach:', fetchError);
      } else {
        setCoach(updatedCoach);
        console.log('Updated coach after registration:', updatedCoach);
      }
      
      // Store coach data in AsyncStorage
      await AsyncStorage.setItem('coach_data', JSON.stringify({ 
        id: coach.id, 
        name: coach.name, 
        club_id: coach.club_id, 
        is_active: coach.is_active, 
        phone_number: coach.phone_number, 
        user_id: userId 
      }));
      
      // Notify the user of success
      Alert.alert('Registration Successful', 'Your account has been created successfully!');
      
      // Reload the app role to go to the coach dashboard
      if (global.reloadRole) global.reloadRole();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      console.error('Registration error:', err);
      Alert.alert('Registration Error', err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Format phone number to E.164 format
      const formattedPhone = phone.trim();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password.trim()
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      // Always update coach.user_id if it's null and login succeeded
      if (coach && data.user?.id) {
        if (!coach.user_id) {
          console.log('Linking coach record to authenticated user after successful login...');
          
          const { error: updateError } = await supabase
            .from('coaches')
            .update({ user_id: data.user.id })
            .eq('id', coach.id);
            
          if (updateError) {
            console.error('Error updating coach user_id after login:', updateError);
            Alert.alert(
              'Warning',
              'Login successful, but could not fully link your coach profile. Some features may be limited.',
              [{ text: 'OK' }]
            );
          } else {
            console.log('Successfully updated coach user_id after login:', data.user.id);
            // Update local coach object as well
            coach.user_id = data.user.id;
          }
        }

        // Store coach data in AsyncStorage with the updated user_id
        await AsyncStorage.setItem('coach_data', JSON.stringify({ 
          id: coach.id, 
          name: coach.name, 
          club_id: coach.club_id, 
          is_active: coach.is_active, 
          phone_number: coach.phone_number, 
          user_id: data.user.id 
        }));
        
        if (global.reloadRole) global.reloadRole();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      console.error('Login error:', err);
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

      <Animated.View 
        entering={FadeInDown.duration(1000).springify()}
        style={styles.content}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons 
            name="whistle" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>Coach Login</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' && 'Enter your phone number to continue.'}
            {step === 'register' && 'Complete your profile to finish registration'}
            {step === 'login' && 'Enter your password to log in'}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 'phone' && (
            <>
              <TextInput
                label="Phone Number"
                value={phone}
                onChangeText={text => {
                  let formatted = text;
                  if (formatted.startsWith('0')) {
                    formatted = '+40' + formatted.slice(1);
                  }
                  setPhone(formatted);
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
              <Pressable 
                onPress={() => {
                  const cleaned = phone.replace(/\s/g, '');
                  if (!/^\+[0-9]{10,}$/.test(cleaned)) {
                    setError('Please enter your phone number in international format, e.g. +40 734 108 108');
                    return;
                  }
                  handlePhoneSubmit();
                }}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Checking...' : 'Continue'}
                </Text>
              </Pressable>
            </>
          )}
          {step === 'register' && (
            <>
              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="flat"
                secureTextEntry
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <TextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="flat"
                secureTextEntry
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="lock-check" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <TextInput
                label="Email (optional)"
                value={email}
                onChangeText={setEmail}
                mode="flat"
                keyboardType="email-address"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="email" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <Pressable 
                onPress={handleRegister}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Registering...' : 'Register'}
                </Text>
              </Pressable>
            </>
          )}
          {step === 'login' && (
            <>
              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                editable={!isLoading}
                placeholder="Password"
                returnKeyType="done"
              />
              <Pressable
                style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 16 }}
                onPress={() => navigation.navigate('CoachResetPassword', { phone: phone.trim() })}
              >
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Forgot Password?</Text>
              </Pressable>
              <Pressable 
                onPress={handleLogin}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Logging in...' : 'Login'}
                </Text>
              </Pressable>
            </>
          )}
          {error ? <Text style={{ color: COLORS.error, marginTop: 12 }}>{error}</Text> : null}
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
  helperText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
}); 