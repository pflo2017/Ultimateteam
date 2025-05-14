import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ParentPasswordLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentPasswordLogin'>;
type ParentPasswordLoginScreenRouteProp = RouteProp<RootStackParamList, 'ParentPasswordLogin'>;

export const ParentPasswordLoginScreen = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigation = useNavigation<ParentPasswordLoginScreenNavigationProp>();
  const route = useRoute<ParentPasswordLoginScreenRouteProp>();
  const { phoneNumber } = route.params;

  const handleLogin = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log('DEBUG: Attempting login with phoneNumber:', phoneNumber, 'password:', password);
      
      // First check if there are multiple accounts with this phone number
      const { data: allMatches, error: checkError } = await supabase
        .from('parents')
        .select('id, email')
        .eq('phone_number', phoneNumber);
        
      if (allMatches && allMatches.length > 1) {
        console.warn('WARNING: Multiple accounts found with same phone number:', allMatches);
      }
      
      // Get the parent record with full details
      const { data: parent, error: loginError } = await supabase
        .from('parents')
        .select('*')  // Select all fields to ensure we have complete data
        .eq('phone_number', phoneNumber)
        .eq('password', password)
        .order('updated_at', { ascending: false })  // Get the most recently updated record
        .limit(1)
        .single();

      if (loginError || !parent) {
        console.error('Login error:', loginError);
        setError('Invalid password');
        return;
      }

      console.log('DEBUG: Parent data from database:', JSON.stringify(parent));

      // Store parent data in AsyncStorage
      await AsyncStorage.setItem('parent_data', JSON.stringify(parent));
      
      // Verify data is stored correctly
      const storedData = await AsyncStorage.getItem('parent_data');
      const parsedData = JSON.parse(storedData || '{}');
      console.log('DEBUG: Stored parent data in AsyncStorage:', JSON.stringify(parsedData));
      
      // No need to navigate - the root navigator will detect parent data and show the parent navigator
      
    } catch (error) {
      console.error('Error logging in:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ParentResetPassword', { phoneNumber });
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Enter your password to continue</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
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
          
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Pressable
            onPress={handleForgotPassword}
            style={styles.forgotPasswordButton}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              style={[
                styles.loginButton, 
                SHADOWS.button,
                (isLoading || !password.trim()) && styles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -SPACING.md,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    fontWeight: '600',
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
}); 