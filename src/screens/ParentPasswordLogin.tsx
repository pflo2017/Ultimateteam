import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

// Add global type declaration for reloadRole
declare global {
  // eslint-disable-next-line no-var
  var reloadRole: undefined | (() => void);
}

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
  const { t } = useTranslation();

  // Handle back button press with improved navigation
  const handleBackPress = () => {
    navigation.navigate('ParentLogin');
  };

  const handleLogin = async () => {
    console.log('DEBUG: handleLogin called');
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log('DEBUG: Attempting login with phoneNumber:', phoneNumber, 'password:', password);
      
      // First try to get the parent data to check if it's a legacy account
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (parentError || !parent) {
        setError('Parent profile not found');
        setIsLoading(false);
        return;
      }

      // Generate a unique email for legacy accounts if they don't have one
      const parentEmail = parent.email || `${phoneNumber.replace(/[^0-9]/g, '')}@legacy.parent`;

      // Try to sign in with Supabase Auth using email
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: parentEmail,
        password: password
      });

      if (authError) {
        // If auth fails, check if this is a legacy account
        if (parent.password === password) {
          // This is a legacy account, create the auth user with the generated email
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: parentEmail,
            password: password,
            phone: phoneNumber
          });

          if (signUpError) {
            console.error('Error creating auth user:', signUpError);
            setError('Failed to migrate account. Please contact support.');
            setIsLoading(false);
            return;
          }

          // Update the parent's email in the database if it was generated
          if (!parent.email) {
            const { error: updateError } = await supabase
              .from('parents')
              .update({ email: parentEmail })
              .eq('id', parent.id);

            if (updateError) {
              console.error('Error updating parent email:', updateError);
            }
          }

          // Successfully migrated, now try to sign in
          const { data: newAuthData, error: newAuthError } = await supabase.auth.signInWithPassword({
            email: parentEmail,
            password: password
          });

          if (newAuthError) {
            console.error('Error signing in after migration:', newAuthError);
            setError('Account migrated but login failed. Please try again.');
            setIsLoading(false);
            return;
          }

          // Store parent data in AsyncStorage
          await AsyncStorage.removeItem('admin_data');
          await AsyncStorage.removeItem('coach_data');
          await AsyncStorage.setItem('parent_data', JSON.stringify({
            ...parent,
            email: parentEmail
          }));
          
          if (global.reloadRole) {
            global.reloadRole();
          }
        } else {
          setError('Invalid phone or password');
          setIsLoading(false);
        }
        return;
      }

      // Regular login successful
      await AsyncStorage.removeItem('admin_data');
      await AsyncStorage.removeItem('coach_data');
      await AsyncStorage.setItem('parent_data', JSON.stringify(parent));
      
      // If the parent doesn't have a user_id, update it with the current auth user's ID
      if (!parent.user_id && authData.user?.id) {
        try {
          const { error: updateError } = await supabase
            .from('parents')
            .update({ user_id: authData.user.id })
            .eq('id', parent.id);
            
          if (updateError) {
            console.error('Error updating parent user_id:', updateError);
          } else {
            console.log('Updated parent record with auth user ID');
            // Update the local parent data with the user_id
            parent.user_id = authData.user.id;
            await AsyncStorage.setItem('parent_data', JSON.stringify(parent));
          }
        } catch (err) {
          console.error('Error updating parent user_id:', err);
        }
      }
      
      if (global.reloadRole) {
        global.reloadRole();
      }
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
          <Text style={styles.title}>{t('parent.login.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('parent.login.enterPassword')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('parent.login.password')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError('');
            }}
            mode="flat"
            secureTextEntry={!showPassword}
            style={styles.input}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} color={COLORS.primary} onPress={() => setShowPassword(!showPassword)} />}
            placeholder={t('parent.login.password')}
          />
          
          {error ? (
            <Text style={styles.errorText}>{
              error === 'Please enter your password' ? t('parent.login.enterPasswordError') :
              error === 'Invalid phone or password' ? t('parent.login.invalidCredentials') :
              error === 'Parent profile not found' ? t('parent.login.parentNotFound') :
              error === 'Failed to migrate account. Please contact support.' ? t('parent.login.migrateFailed') :
              error === 'Account migrated but login failed. Please try again.' ? t('parent.login.migrateLoginFailed') :
              error === 'An error occurred. Please try again.' ? t('parent.login.error') : error
            }</Text>
          ) : null}

          <Pressable onPress={handleForgotPassword} style={styles.forgotPasswordBtn}>
            <Text style={styles.forgotPasswordText}>{t('parent.login.forgotPassword')}</Text>
          </Pressable>

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              style={[
                styles.loginButton, 
                SHADOWS.button,
                isLoading && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>{t('parent.login.login')}</Text>
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
  loginButtonDisabled: {
    backgroundColor: COLORS.grey[300],
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginTop: -SPACING.md,
  },
}); 