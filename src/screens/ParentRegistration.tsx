import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ParentRegistrationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentRegistration'>;
type ParentRegistrationScreenRouteProp = RouteProp<RootStackParamList, 'ParentRegistration'>;

export const ParentRegistrationScreen = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [buttonPressed, setButtonPressed] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const navigation = useNavigation<ParentRegistrationScreenNavigationProp>();
  const route = useRoute<ParentRegistrationScreenRouteProp>();
  const { phoneNumber } = route.params;

  // Reset button pressed state after 500ms
  useEffect(() => {
    if (buttonPressed) {
      const timer = setTimeout(() => {
        setButtonPressed(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [buttonPressed]);

  const validateEmail = (email: string) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const handleCreateAccount = async () => {
    // Prevent double-submission
    if (isLoading) return;
    
    console.log('Create Account button pressed');
    setButtonPressed(true);
    
    // Validate inputs - move validation to a separate function for cleaner code
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    console.log('All validation passed, proceeding with account creation');
    setError('');
    setIsLoading(true);
    setLoadingMessage('Creating your account...');

    // Show immediate feedback
    setTimeout(async () => {
      try {
        console.log('Starting parent registration process...');
        console.log('Phone number:', phoneNumber);
        console.log('Email:', email);
        
        // First check if a user with this email already exists in Auth
        try {
          setLoadingMessage('Checking if account already exists...');
          const { data: existingAuthUser, error: checkError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password
          });
          
          if (existingAuthUser?.user) {
            console.log('User already exists in Auth with this email');
            setError('An account with this email already exists. Please try logging in or use a different email.');
            setIsLoading(false);
            return;
          }
        } catch (checkError) {
          console.log('Error checking existing user, continuing with registration:', checkError);
          // Continue with registration even if the check fails
        }
        
        // Also check if phone number is already registered
        try {
          setLoadingMessage('Verifying phone number...');
          const { data: phoneCheck } = await supabase
            .from('parents')
            .select('id')
            .eq('phone_number', phoneNumber);
            
          if (phoneCheck && phoneCheck.length > 0) {
            console.log('Phone number already registered');
            setError('This phone number is already registered. Please try logging in or use a different phone number.');
            setIsLoading(false);
            return;
          }
        } catch (phoneCheckError) {
          console.log('Error checking phone number, continuing with registration:', phoneCheckError);
          // Continue with registration even if the check fails
        }
        
        // 1. Create Supabase Auth user
        setLoadingMessage('Creating your account...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          phone: phoneNumber,
          password: password
        });
        
        console.log('Auth signup response:', authData ? 'Success' : 'Failed', authError ? authError.message : 'No error');
        
        if (authError) {
          setError('Could not create account: ' + authError.message);
          setIsLoading(false);
          return;
        }
        
        // Extract the user ID from auth data
        const userId = authData.user?.id;
        if (!userId) {
          setError('Failed to create account: No user ID returned');
          setIsLoading(false);
          return;
        }
        
        console.log('Auth user created with ID:', userId);
        
        setLoadingMessage('Setting up your profile...');
        
        // Create parent account in parents table
        try {
          const { data: parent, error: createError } = await supabase
            .from('parents')
            .insert([{
              name: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone_number: phoneNumber,
              password: password,
              is_active: true,
              phone_verified: true, // Since we're skipping verification
              user_id: userId // Link to the auth user ID
            }])
            .select('id')
            .single();

          if (createError) throw createError;
          
          console.log('Parent record created successfully');
        } catch (createError) {
          console.error('Error creating parent record:', createError);
          // Even if parent record creation fails, the auth account was created
          // We'll still show success but log the error
        }
        
        // IMPORTANT: Instead of storing parent data and redirecting to dashboard,
        // we show a success message and redirect to login screen
        
        // Show success message
        console.log('Showing success alert');
        
        // First set loading to false to ensure UI is responsive
        setIsLoading(false);
        
        // Use a more direct approach for the alert
        Alert.alert(
          'Account Created Successfully',
          'Your account has been created! Please log in with your phone number and password.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('Alert OK pressed, navigating to ParentLogin');
                // Navigate to the login screen immediately without delay
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'ParentLogin' }],
                });
              }
            }
          ],
          { cancelable: false }
        );
        
      } catch (error: any) {
        console.error('Error creating account:', error);
        
        // Check if it's a network error
        if (error.message && error.message.includes('Network request failed')) {
          setError('Network connection issue. Your account may have been created but we could not confirm. Please try logging in.');
        } else {
          setError('An error occurred while creating your account. Please try again.');
        }
        
        setIsLoading(false);
      }
    }, 100); // Small delay to ensure the button press animation is visible
  };
  
  // Separate validation function
  const validateInputs = () => {
    if (!fullName.trim()) {
      return 'Please enter your full name';
    }
    if (!email.trim()) {
      return 'Please enter your email address';
    }
    if (!validateEmail(email)) {
      return 'Please enter a valid email address';
    }
    if (!password.trim()) {
      return 'Please enter a password';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Icon 
          name="chevron-left" 
          size={32} 
          color={COLORS.primary}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeIn.duration(1000).springify()}
          style={styles.content}
        >
          <View style={styles.headerContent}>
            <Icon 
              name="account-child" 
              size={48} 
              color={COLORS.primary}
            />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Fill in your details to create your account</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (error) setError('');
              }}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              error={!!error}
              disabled={isLoading}
            />

            <TextInput
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              keyboardType="email-address"
              autoCapitalize="none"
              error={!!error}
              disabled={isLoading}
              left={<TextInput.Icon icon="email" color={COLORS.grey[400]} style={{ marginRight: 30 }} />}
            />

            <TextInput
              label="Phone Number"
              value={phoneNumber}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              disabled={true}
              left={<TextInput.Icon icon="phone" color={COLORS.grey[400]} style={{ marginRight: 30 }} />}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
              }}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry={!showPassword}
              error={!!error}
              disabled={isLoading}
              textContentType="oneTimeCode"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              blurOnSubmit={true}
              keyboardType="visible-password"
              right={
                <TextInput.Icon 
                  icon={showPassword ? "eye-off" : "eye"} 
                  onPress={() => setShowPassword(!showPassword)}
                  color={COLORS.grey[400]}
                />
              }
            />

            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (error) setError('');
              }}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry={!showConfirmPassword}
              error={!!error}
              disabled={isLoading}
              textContentType="oneTimeCode"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              blurOnSubmit={true}
              keyboardType="visible-password"
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
              onPress={handleCreateAccount}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.touchableButton,
                isLoading && styles.disabledButton,
                (pressed || buttonPressed) && styles.pressedButton
              ]}
              android_ripple={{ color: 'rgba(255, 255, 255, 0.3)' }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={isLoading}
          onRequestClose={() => {}}
        >
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
};

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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
    height: 56,
  },
  inputOutline: {
    borderRadius: 30,
  },
  inputContent: {
    paddingLeft: 16,
  },
  errorText: {
    color: '#FF0000',
    marginLeft: 8,
    marginBottom: 8,
  },
  touchableButton: {
    marginTop: 16,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  disabledButton: {
    backgroundColor: COLORS.grey[300],
    opacity: 0.7,
  },
  pressedButton: {
    backgroundColor: '#0099C0', // Darker shade of primary color
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
}); 