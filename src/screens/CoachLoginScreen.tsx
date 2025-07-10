import React, { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';

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
  email?: string;
  user_id?: string;
}

// Helper function to check if a coach exists in the database but hasn't been registered in auth
const checkCoachNeedsRegistration = async (phoneNumber: string): Promise<{needsRegistration: boolean, coachData: CoachData | null}> => {
  try {
    console.log('Checking if coach needs registration:', phoneNumber);
    
    // Use our new database function to check registration status
    const { data: statusData, error: statusError } = await supabase
      .rpc('check_coach_registration_status', { p_phone_number: phoneNumber });
      
    if (statusError) {
      console.error('Error checking coach registration status:', statusError);
      
      // Fall back to the old method if the function doesn't exist
      // Try to find coach by phone number
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();
        
      if (coachError || !coachData) {
        // Try alternative format (without spaces)
        const cleanedPhone = phoneNumber.replace(/\s/g, '');
        const { data: altCoachData, error: altCoachError } = await supabase
          .from('coaches')
          .select('*')
          .eq('phone_number', cleanedPhone)
          .single();
          
        if (altCoachError || !altCoachData) {
          console.log('No coach found with this phone number');
          return { needsRegistration: false, coachData: null };
        }
        
        console.log('Found coach with alternative phone format:', altCoachData);
        
        // Check if coach needs registration (has no user_id)
        if (!altCoachData.user_id) {
          console.log('Coach exists but has no user_id, needs to register');
          return { needsRegistration: true, coachData: altCoachData };
        } else {
          console.log('Coach already has user_id, can login');
          return { needsRegistration: false, coachData: altCoachData };
        }
      }
      
      console.log('Found coach with exact phone format:', coachData);
      
      // Check if coach needs registration (has no user_id)
      if (!coachData.user_id) {
        console.log('Coach exists but has no user_id, needs to register');
        return { needsRegistration: true, coachData: coachData };
      } else {
        console.log('Coach already has user_id, can login');
        return { needsRegistration: false, coachData: coachData };
      }
    }
    
    // If we got a status result, use it
    if (statusData && statusData.length > 0) {
      const status = statusData[0];
      console.log('Coach registration status:', status);
      
      if (!status.coach_id) {
        console.log('No coach found with this phone number');
        return { needsRegistration: false, coachData: null };
      }
      
      // Create coach data object from status
      const coachData: CoachData = {
        id: status.coach_id,
        name: status.coach_name,
        phone_number: status.phone_number,
        user_id: status.user_id,
        club_id: '', // We'll fill this in later if needed
        is_active: true, // Assume active
        email: undefined
      };
      
      // Check registration status
      if (status.registration_status === 'NEEDS_REGISTRATION' || 
          status.registration_status === 'AUTH_EXISTS_NEEDS_LINKING') {
        console.log('Coach needs registration based on status:', status.registration_status);
        return { needsRegistration: true, coachData };
      } else if (status.registration_status === 'FULLY_REGISTERED') {
        console.log('Coach is fully registered');
        return { needsRegistration: false, coachData };
      } else if (status.registration_status === 'COACH_HAS_USER_ID_BUT_NO_AUTH') {
        // This is a weird state - coach has user_id but no auth record
        console.log('Coach has user_id but no auth record, needs to register');
        return { needsRegistration: true, coachData };
      } else if (status.registration_status === 'USER_ID_MISMATCH') {
        // Another weird state - coach has user_id but it doesn't match auth
        console.log('Coach has mismatched user_id, treating as needing registration');
        return { needsRegistration: true, coachData };
      } else {
        console.log('Unknown registration status, defaulting to needs registration');
        return { needsRegistration: true, coachData };
      }
    }
    
    // Fallback if no status data
    console.log('No status data returned, falling back to direct check');
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
      
    if (coachError || !coachData) {
      console.log('No coach found with this phone number');
      return { needsRegistration: false, coachData: null };
    }
    
    if (!coachData.user_id) {
      console.log('Coach exists but has no user_id, needs to register');
      return { needsRegistration: true, coachData };
    } else {
      console.log('Coach already has user_id, can login');
      return { needsRegistration: false, coachData };
    }
  } catch (err) {
    console.error('Error checking if coach needs registration:', err);
    return { needsRegistration: false, coachData: null };
  }
};

export const CoachLoginScreen = () => {
  const { t } = useTranslation();
  // Hide "User already registered" errors from the UI since we handle them gracefully
  useEffect(() => {
    // Check if running in development and LogBox is available
    if (__DEV__ && require('react-native').LogBox) {
      require('react-native').LogBox.ignoreLogs([
        "Supabase signUp error: AuthApiError: User already registered"
      ]);
    }
  }, []);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'register' | 'login'>('phone');
  const [coach, setCoach] = useState<CoachData | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const phoneInputRef = React.useRef<PhoneInput>(null);

  // Helper function to normalize phone number format
  const normalizePhoneNumber = (phoneNumber: string): string => {
    let formatted = phoneNumber.trim();
    
    // Fix common phone number format issues
    if (formatted.startsWith('+0')) {
      // Replace +0 with the correct country code +40 for Romania
      formatted = '+4' + formatted.substring(2);
    }
    
    return formatted;
  };

  // Helper function to check if a phone exists in auth using the database function
  const checkPhoneInAuth = async (phoneNumber: string): Promise<boolean> => {
    try {
      console.log('Checking if phone exists in auth:', phoneNumber);
      
      // First check if this coach already has a user_id set
      if (coach && coach.user_id) {
        console.log('Coach already has user_id set:', coach.user_id);
        return true;
      }
      
      // CRITICAL FIX: If coach exists but has no user_id, they need to register
      if (coach && !coach.user_id) {
        console.log('Coach exists but has no user_id, needs to register');
        return false;
      }
      
      // Check if any coach with this phone has a user_id (might be different format)
      const { data: coachWithUserId, error: coachError } = await supabase
        .from('coaches')
        .select('user_id')
        .or(`phone_number.eq.${phoneNumber},phone_number.eq.${phoneNumber.replace(/\s/g, '')}`)
        .not('user_id', 'is', null)
        .maybeSingle();
        
      if (coachWithUserId && coachWithUserId.user_id) {
        console.log('Found coach with user_id for this phone:', coachWithUserId.user_id);
        return true;
      }
      
      // Use the database function to check if phone exists in auth
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: phoneNumber,
        password: 'dummy_password_for_check_only'
      });
      
      // If we get "Invalid login credentials" error, the phone exists in auth
      if (error && error.message && error.message.includes('Invalid login credentials')) {
        console.log('Phone exists in auth (fallback check)');
        return true;
      }
      
      // If we get a successful login with dummy password (shouldn't happen), the phone exists
      if (data && data.user) {
        console.log('Unexpected successful login with dummy password');
        return true;
      }
      
      console.log('No auth account exists for this phone');
      return false;
    } catch (err) {
      console.error('Error checking phone in auth:', err);
      return false;
    }
  };

  const handlePhoneSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Format phone number to E.164 format
      const formattedPhone = normalizePhoneNumber(phone);
      
      console.log('Attempting to login with phone number:', formattedPhone);
      
      // Use our helper function to check if coach needs registration
      const { needsRegistration, coachData } = await checkCoachNeedsRegistration(formattedPhone);
      
      // If no coach found, show error
      if (!coachData) {
        setError(t('coach.login.no_coach_found'));
        setIsLoading(false);
        return;
      }
      
      // Set the coach data
      setCoach(coachData);
      
      // Direct to appropriate screen based on registration needs
      if (needsRegistration) {
        console.log('Coach needs to register, showing registration screen');
        setStep('register');
      } else {
        console.log('Coach can login, showing login screen');
        setStep('login');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('coach.login.unexpected_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    console.log("handleRegister function called");
    setError('');
    
    if (!coach) {
      setError(t('coach.login.coach_info_not_found'));
      setIsLoading(false);
      return;
    }
    
    console.log('Starting registration for coach:', coach);
    
    if (password.trim() !== confirmPassword.trim()) {
      setError(t('coach.login.passwords_do_not_match'));
      setIsLoading(false);
      return;
    }
    
    try {
      // Ensure phone is in E.164 format
      const formattedPhone = normalizePhoneNumber(phone);
      if (!formattedPhone.startsWith('+')) {
        setError(t('coach.login.phone_number_must_start_with_plus'));
        setIsLoading(false);
        return;
      }
      
      console.log('Registering with phone:', formattedPhone);
      
      // Register with Supabase Auth (phone+password)
      const { data, error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password: password.trim(),
        options: email ? { data: { email } } : undefined
      });

      if (error) {
        // Use console.log instead of console.error for expected scenarios
        if (error.message && error.message.toLowerCase().includes('user already registered')) {
          // This is not a true error but an expected case - using console.log to avoid error overlay
          console.log('Expected flow: User already exists in Auth. Attempting to sign in and link coach record...');
          
          // Ignore this specific error in development by printing a benign message
          console.log(`Info [Coach Registration]: ${error.message} - Proceeding with account linking`);
          
          try {
            // Try to sign in with the provided credentials
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              phone: formattedPhone,
              password: password.trim()
            });
            
            if (signInError) {
              console.error('Error signing in after "already registered" error:', signInError);
              Alert.alert(
                t('coach.login.already_registered.title'), 
                t('coach.login.already_registered.message'),
                [{ text: t('common.ok'), onPress: () => setStep('login') }]
              );
              return;
            }
            
            if (!signInData.user) {
              setError(t('coach.login.failed_to_retrieve_user_data_after_sign_in'));
              return;
            }
            
            // Got the user ID, now update the coach record
            const userId = signInData.user.id;
            console.log('Successfully signed in. Linking coach record with Auth user ID:', userId);
            
            const emailValue = email || signInData.user.email || undefined;
            
            // CRITICAL FIX: Use our new database function to update the coach record
            console.log('CRITICAL FIX: Using database function to update coach record');
            
            // First try updating by ID
            const { data: updateResult, error: updateError } = await supabase
              .rpc('update_coach_user_id', { 
                p_coach_id: coach.id,
                p_user_id: userId,
                p_email: emailValue
              });
              
            if (updateError) {
              console.error('Error calling update_coach_user_id:', updateError);
              
              // Try updating by phone number as fallback
              console.log('Trying to update coach by phone number using database function');
              const { data: phoneUpdateResult, error: phoneUpdateError } = await supabase
                .rpc('update_coach_user_id_by_phone', { 
                  p_phone_number: formattedPhone,
                  p_user_id: userId,
                  p_email: emailValue
                });
                
              if (phoneUpdateError) {
                console.error('Error calling update_coach_user_id_by_phone:', phoneUpdateError);
                Alert.alert(
                  t('coach.login.warning'),
                  t('coach.login.login_successful_but_failed_to_link_coach_profile')
                );
                return;
              } else {
                console.log('Successfully linked coach record to auth user by phone number function:', phoneUpdateResult);
                // Check if any rows were updated
                if (phoneUpdateResult === 0) {
                  console.error('No rows updated by phone update function');
                  Alert.alert(
                    t('coach.login.warning'),
                    t('coach.login.login_successful_but_could_not_find_coach_profile_to_link')
                  );
                  return;
                }
              }
            } else {
              console.log('Successfully linked coach record to auth user by ID function:', updateResult);
              // Check if any rows were updated
              if (updateResult === 0) {
                console.error('No rows updated by ID update function');
                // Try updating by phone number as fallback
                console.log('Trying to update coach by phone number using database function');
                const { data: phoneUpdateResult, error: phoneUpdateError } = await supabase
                  .rpc('update_coach_user_id_by_phone', { 
                    p_phone_number: formattedPhone,
                    p_user_id: userId,
                    p_email: emailValue
                  });
                  
                if (phoneUpdateError || phoneUpdateResult === 0) {
                  console.error('Error or no rows updated by phone update function:', phoneUpdateError);
                  Alert.alert(
                    t('coach.login.warning'),
                    t('coach.login.login_successful_but_could_not_link_coach_profile')
                  );
                } else {
                  console.log('Successfully linked coach record to auth user by phone number function:', phoneUpdateResult);
                }
              }
            }
            
            // Verify the update was successful
            const { data: verifyCoach, error: verifyError } = await supabase
              .from('coaches')
              .select('*')
              .eq('id', coach.id)
              .single();
              
            if (verifyError) {
              console.error('Error verifying coach update:', verifyError);
            } else {
              console.log('Verified coach record after update:', verifyCoach);
              if (!verifyCoach.user_id) {
                console.error('CRITICAL ERROR: user_id still not set after update!');
              }
            }
            
            // Store coach data and reload
            const updatedCoach = {
              ...coach,
              user_id: userId,
              email: emailValue
            };
            
            console.log('Final coach data to store (already registered flow):', updatedCoach);
            
            if (!updatedCoach.user_id) {
              console.error('CRITICAL ERROR: user_id is still null in already registered flow!', updatedCoach);
              // Force set it
              updatedCoach.user_id = userId;
            }
            
            await AsyncStorage.setItem('coach_data', JSON.stringify(updatedCoach));
            setCoach(updatedCoach);
            
            console.log('Successfully linked coach record to existing Auth user!');
            
            // Show success message FIRST, then update UI after user acknowledges
            setTimeout(() => {
              setIsLoading(false); // First ensure loading state is cleared
              
              Alert.alert(
                t('coach.login.registration_successful.title'), 
                t('coach.login.registration_successful.message'),
                [
                  { 
                    text: t('common.ok'), 
                    onPress: () => {
                      console.log("Alert OK pressed - resetting form and going to login");
                      // Reset form fields
                      setPassword('');
                      setConfirmPassword('');
                      // Go back to login step
                      setStep('login');
                    }
                  }
                ]
              );
            }, 500); // Small delay to ensure UI updates
            
            return;
          } catch (err) {
            console.error('Error during linking process:', err);
            setError(t('coach.login.error_during_linking_process'));
            return;
          }
        }
        
        // If not a "user already registered" error, show the general error
        Alert.alert(t('coach.login.registration_error.title'), error.message);
        return;
      }
      
      if (!data || !data.user) {
        setError(t('coach.login.no_user_returned_from_supabase_sign_up'));
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
        Alert.alert(t('coach.login.warning'), t('coach.login.registration_succeeded_but_automatic_login_failed'));
      }
      
      // Update coaches.user_id using our new database function
      console.log('CRITICAL FIX: Using database function to update coach record');
      
      const emailValue = email.trim() || data.user?.user_metadata?.email || null;
      
      // First try updating by ID
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_coach_user_id', { 
          p_coach_id: coach.id,
          p_user_id: userId,
          p_email: emailValue
        });
        
      if (updateError) {
        console.error('Error calling update_coach_user_id:', updateError);
        
        // Try updating by phone number as fallback
        console.log('Trying to update coach by phone number using database function');
        const { data: phoneUpdateResult, error: phoneUpdateError } = await supabase
          .rpc('update_coach_user_id_by_phone', { 
            p_phone_number: formattedPhone,
            p_user_id: userId,
            p_email: emailValue
          });
          
        if (phoneUpdateError) {
          console.error('Error calling update_coach_user_id_by_phone:', phoneUpdateError);
          Alert.alert(t('coach.login.warning'), 
            t('coach.login.account_created_but_could_not_link_to_your_coach_profile')
          );
          return;
        } else {
          console.log('Successfully linked coach record to auth user by phone number function:', phoneUpdateResult);
          // Check if any rows were updated
          if (phoneUpdateResult === 0) {
            console.error('No rows updated by phone update function');
            // Try updating by phone number as fallback
            console.log('Trying to update coach by phone number using database function');
            const { data: phoneUpdateResult, error: phoneUpdateError } = await supabase
              .rpc('update_coach_user_id_by_phone', { 
                p_phone_number: formattedPhone,
                p_user_id: userId,
                p_email: emailValue
              });
              
            if (phoneUpdateError || phoneUpdateResult === 0) {
              console.error('Error or no rows updated by phone update function:', phoneUpdateError);
              Alert.alert(
                t('coach.login.warning'),
                t('coach.login.login_successful_but_could_not_link_your_coach_profile')
              );
            } else {
              console.log('Successfully linked coach record to auth user by phone number function:', phoneUpdateResult);
            }
          }
        }
        
        // Verify the update was successful
        const { data: verifyCoach, error: verifyError } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', coach.id)
          .single();
          
        if (verifyError) {
          console.error('Error verifying coach update:', verifyError);
        } else {
          console.log('Verified coach record after update:', verifyCoach);
          if (!verifyCoach.user_id) {
            console.error('CRITICAL ERROR: user_id still not set after update!');
          }
        }
        
        // Store the updated coach data in AsyncStorage
        const updatedCoachData = {
          ...coach,
          user_id: userId,
          email: emailValue
        };
        
        console.log('Final coach data to store:', updatedCoachData);
        
        await AsyncStorage.setItem('coach_data', JSON.stringify(updatedCoachData));
        setCoach(updatedCoachData);
        
        if (global.reloadRole) {
          console.log('Reloading role after successful registration');
          global.reloadRole();
        }
        
        // Show success message FIRST, then update UI after user acknowledges
        setTimeout(() => {
          setIsLoading(false); // First ensure loading state is cleared
          
          Alert.alert(
            t('coach.login.registration_successful.title'), 
            t('coach.login.registration_successful.message'),
            [
              { 
                text: t('common.ok'), 
                onPress: () => {
                  console.log("Alert OK pressed - resetting form and going to login");
                  // Reset form fields
                  setPassword('');
                  setConfirmPassword('');
                  // Go back to login step
                  setStep('login');
                }
              }
            ]
          );
        }, 500); // Small delay to ensure UI updates
        
        return;
      }
    } catch (err: any) {
      setError(err.message || t('coach.login.registration_failed'));
      console.error('Registration error:', err);
      Alert.alert(t('coach.login.registration_error.title'), err.message || t('coach.login.registration_failed'));
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    
    if (!coach) {
      setError(t('coach.login.coach_info_not_found'));
      setIsLoading(false);
      return;
    }
    
    console.log('Starting login with coach data:', coach);
    
    try {
      // Format phone number to E.164 format
      const formattedPhone = normalizePhoneNumber(phone);
      
      console.log('Attempting login with phone:', formattedPhone);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password.trim()
      });

      if (error) {
        console.error('Login error:', error);
        setError(error.message);
        setIsLoading(false);
        return;
      }
      
      console.log('Login successful, auth user:', data.user?.id);

      // Always update coach.user_id if login succeeded
      if (data.user?.id) {
        console.log('Linking coach record to authenticated user after successful login...');
        
        // Get user email from auth metadata
        const userEmail = data.user.user_metadata?.email || email || null;
        
        try {
          // CRITICAL FIX: Use our new database function to update the coach record
          console.log('CRITICAL FIX: Using database function to update coach record');
          
          // First try updating by ID
          const { data: updateResult, error: updateError } = await supabase
            .rpc('update_coach_user_id', { 
              p_coach_id: coach.id,
              p_user_id: data.user.id,
              p_email: userEmail
            });
            
          if (updateError) {
            console.error('Error calling update_coach_user_id:', updateError);
            
            // Try updating by phone number as fallback
            console.log('Trying to update coach by phone number using database function');
            const { data: phoneUpdateResult, error: phoneUpdateError } = await supabase
              .rpc('update_coach_user_id_by_phone', { 
                p_phone_number: formattedPhone,
                p_user_id: data.user.id,
                p_email: userEmail
              });
              
            if (phoneUpdateError) {
              console.error('Error calling update_coach_user_id_by_phone:', phoneUpdateError);
              Alert.alert(
                t('coach.login.warning'),
                t('coach.login.login_successful_but_could_not_fully_link_your_coach_profile'),
                [{ text: t('common.ok') }]
              );
            } else {
              console.log('Successfully linked coach record to auth user by phone number function:', phoneUpdateResult);
            }
          } else {
            console.log('Successfully linked coach record to auth user by ID function:', updateResult);
          }

          // Verify the update was successful
          const { data: verifyCoach, error: verifyError } = await supabase
            .from('coaches')
            .select('*')
            .eq('id', coach.id)
            .single();
            
          if (verifyError) {
            console.error('Error verifying coach update:', verifyError);
            
            // Try fetching by phone number if ID fetch fails
            console.log('Trying to fetch coach by phone number');
            const { data: phoneCoach, error: phoneFetchError } = await supabase
              .from('coaches')
              .select('*')
              .eq('phone_number', formattedPhone)
              .single();
              
            if (phoneFetchError) {
              console.error('Error fetching coach by phone:', phoneFetchError);
              
              // If we can't fetch updated data, manually create coach data with user_id
              const coachData = { 
                ...coach,
                email: userEmail,
                user_id: data.user.id 
              };
              
              console.log('Final coach data to store (fallback):', coachData);
              
              if (!coachData.user_id) {
                console.error('CRITICAL ERROR: user_id is still null in fallback!', coachData);
                // Force set it
                coachData.user_id = data.user.id;
              }
              
              await AsyncStorage.setItem('coach_data', JSON.stringify(coachData));
              console.log('Stored coach data with user_id:', coachData);
              setCoach(coachData);
              
              if (global.reloadRole) {
                console.log('Reloading role after successful login');
                global.reloadRole();
              }
            } else {
              // Use the coach data from phone lookup
              const updatedCoachData = {
                ...phoneCoach,
                user_id: data.user.id
              };
              
              console.log('Final coach data from phone lookup:', updatedCoachData);
              
              if (!updatedCoachData.user_id) {
                console.error('CRITICAL ERROR: user_id is still null in phone lookup!', updatedCoachData);
                // Force set it
                updatedCoachData.user_id = data.user.id;
              }
              
              await AsyncStorage.setItem('coach_data', JSON.stringify(updatedCoachData));
              console.log('Stored coach data with user_id from phone lookup:', updatedCoachData);
              setCoach(updatedCoachData);
              
              if (global.reloadRole) {
                console.log('Reloading role after successful login');
                global.reloadRole();
              }
            }
          } else {
            // Use the latest data from the database
            // Ensure user_id is set even if DB update failed
            const updatedCoachData = {
              ...verifyCoach,
              user_id: data.user.id
            };
            
            console.log('Final coach data to store:', updatedCoachData);
            
            if (!updatedCoachData.user_id) {
              console.error('CRITICAL ERROR: user_id is still null after login!', updatedCoachData);
              // Force set it
              updatedCoachData.user_id = data.user.id;
            }
            
            await AsyncStorage.setItem('coach_data', JSON.stringify(updatedCoachData));
            console.log('Stored coach data with user_id:', updatedCoachData);
            setCoach(updatedCoachData);
            
            if (global.reloadRole) {
              console.log('Reloading role after successful login');
              global.reloadRole();
            }
          }
        } catch (err) {
          console.error('Error during coach update after login:', err);
          
          // Still try to store coach data and reload
          const coachData = { 
            ...coach,
            email: userEmail,
            user_id: data.user.id 
          };
          
          console.log('Final emergency coach data to store:', coachData);
          
          if (!coachData.user_id) {
            console.error('CRITICAL ERROR: user_id is still null in emergency data!', coachData);
            // Force set it
            coachData.user_id = data.user.id;
          }
          
          await AsyncStorage.setItem('coach_data', JSON.stringify(coachData));
          console.log('Stored emergency coach data with user_id:', coachData);
          setCoach(coachData);
          
          if (global.reloadRole) {
            console.log('Emergency reloading role after error');
            global.reloadRole();
          }
        }
      }
    } catch (err: any) {
      setError(err.message || t('coach.login.login_failed'));
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
          <Text style={styles.title}>{t('coach.login.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' && t('coach.login.enter_phone_to_continue')}
            {step === 'register' && t('coach.login.complete_profile_to_finish_registration')}
            {step === 'login' && t('coach.login.enter_password_to_log_in')}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 'phone' && (
            <>
              <TextInput
                label={t('coach.login.phone_number')}
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
                placeholder={t('coach.login.phone_number_placeholder')}
              />
              <Text style={styles.helperText}>{t('coach.login.phone_helper')}</Text>
              <Pressable 
                onPress={() => {
                  const cleaned = phone.replace(/\s/g, '');
                  if (!/^\+[0-9]{10,}$/.test(cleaned)) {
                    setError(t('coach.login.phone_number_format_error'));
                    return;
                  }
                  handlePhoneSubmit();
                }}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>{isLoading ? t('common.loading') : t('coach.login.continue')}</Text>
              </Pressable>
            </>
          )}
          {step === 'register' && (
            <>
              <TextInput
                label={t('auth.password')}
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
                onPress={() => {
                  // Simple approach: just register and show alert
                  setIsLoading(true);
                  
                  // Simple validation
                  if (password !== confirmPassword) {
                    Alert.alert(t('coach.login.error'), t('coach.login.passwords_do_not_match'));
                    setIsLoading(false);
                    return;
                  }
                  
                  // Do registration
                  const doRegistration = async () => {
                    try {
                      // Register with auth
                      const { error } = await supabase.auth.signUp({
                        phone: normalizePhoneNumber(phone),
                        password: password,
                        options: email ? { data: { email } } : undefined
                      });
                      
                      if (error) {
                        Alert.alert(t('coach.login.error'), error.message);
                        setIsLoading(false);
                        return;
                      }
                      
                      // Success - show alert
                      setIsLoading(false);
                      Alert.alert(
                        t('coach.login.success'), 
                        t('coach.login.registration_completed_successfully'),
                        [
                          {
                            text: t('coach.login.login'),
                            onPress: () => {
                              setPassword('');
                              setConfirmPassword('');
                              setStep('login');
                            }
                          }
                        ]
                      );
                    } catch (err) {
                      setIsLoading(false);
                      Alert.alert(t('coach.login.error'), t('coach.login.registration_failed'));
                    }
                  };
                  
                  // Execute registration
                  doRegistration();
                }}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>{isLoading ? t('coach.login.registering') : t('coach.login.register')}</Text>
              </Pressable>
            </>
          )}
          {step === 'login' && (
            <>
              <TextInput
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                editable={!isLoading}
                placeholder={t('auth.password_placeholder')}
                returnKeyType="done"
              />
              <Pressable
                style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 16 }}
                onPress={() => navigation.navigate('CoachResetPassword', { phone: phone.trim() })}
              >
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{t('auth.forgotPassword')}</Text>
              </Pressable>
              <Pressable 
                onPress={handleLogin}
                disabled={isLoading}
                style={[styles.loginButton, SHADOWS.button, isLoading && styles.loginButtonDisabled]}
              >
                <Text style={styles.buttonText}>{isLoading ? t('auth.loggingIn') : t('auth.login')}</Text>
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
    alignItems: 'center', // Add this to center horizontally
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center', // Add this to center vertically within content
    marginBottom: SPACING.xl * 2,
    width: '100%', // Ensure header takes full width for centering
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
    textAlign: 'center', // Force center alignment
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  form: {
    gap: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
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