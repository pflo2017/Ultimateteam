import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  
  const navigation = useNavigation<ParentRegistrationScreenNavigationProp>();
  const route = useRoute<ParentRegistrationScreenRouteProp>();
  const { phoneNumber } = route.params;

  const validateEmail = (email: string) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const handleCreateAccount = async () => {
    // Validate inputs
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // First check if email already exists in parents table
      const { data: existingParentWithEmail, error: emailCheckError } = await supabase
        .from('parents')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (existingParentWithEmail) {
        setError('This email is already registered. Please try logging in instead.');
        return;
      }

      // Then check if phone number already exists in parents table
      const { data: existingParentWithPhone, error: phoneCheckError } = await supabase
        .from('parents')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single();

      if (existingParentWithPhone) {
        setError('This phone number is already registered. Please try logging in instead.');
        return;
      }

      // Create parent account
      const { data: parent, error: createError } = await supabase
        .from('parents')
        .insert([{
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone_number: phoneNumber,
          password: password,
          is_active: true,
          phone_verified: true // Since we're skipping verification
        }])
        .select('id')
        .single();

      if (createError) throw createError;

      // Store parent data in AsyncStorage so the root navigator can detect it
      await AsyncStorage.setItem('parent_data', JSON.stringify(parent));
      // Do NOT navigate manually. The root navigator will switch automatically.
      
    } catch (error: any) {
      console.error('Error creating account:', error);
      setError('An error occurred while creating your account. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

            <Button
              mode="contained"
              onPress={handleCreateAccount}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              buttonColor={COLORS.primary}
            >
              Create Account
            </Button>
          </View>
        </Animated.View>
      </ScrollView>
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
  button: {
    marginTop: 8,
    borderRadius: 30,
  },
  buttonContent: {
    height: 56,
  },
}); 