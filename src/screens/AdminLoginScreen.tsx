import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

type RootStackParamList = {
  Home: undefined;
  AdminLogin: undefined;
  AdminRegister: undefined;
  CoachLogin: undefined;
  ParentLogin: undefined;
  AdminRoot: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AdminLoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (!email || !password) {
        setError(t('auth.emailPasswordRequired'));
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(t('auth.invalidCredentials'));
        return;
      }

      // Check if the user has an admin profile
      const { data: adminProfile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !adminProfile) {
        setError(t('auth.accountNotFound'));
        return;
      }

      // Set admin_data in AsyncStorage for role detection
      await AsyncStorage.setItem(
        'admin_data',
        JSON.stringify({
          id: data.user.id,
          email: data.user.email
        })
      );

      // Instead of navigating directly, use the global reloadRole function
      if (global.reloadRole) {
        global.reloadRole();
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(t('auth.loginError'));
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
            name="shield-account" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>{t('admin.loginTitle')}</Text>
          <Text style={styles.subtitle}>{t('admin.loginSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            mode="flat"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            theme={{ colors: { primary: '#0CC1EC' } }}
            left={<TextInput.Icon icon="email" color={COLORS.primary} style={{ marginRight: 30 }} />}
          />

          <TextInput
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            mode="flat"
            secureTextEntry={!showPassword}
            style={styles.input}
            theme={{ colors: { primary: '#0CC1EC' } }}
            left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                color={COLORS.primary}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => {}}>
            <Text style={styles.forgotPassword}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              onPress={handleLogin}
              disabled={isLoading}
              style={[
                styles.loginButton,
                SHADOWS.button,
                isLoading && styles.loginButtonDisabled
              ]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('auth.loggingIn') : t('auth.login')}
              </Text>
            </Pressable>
          </Animated.View>

          <View style={styles.createAccountContainer}>
            <Text style={styles.createAccountText}>{t('auth.noAccount')}</Text>
            <Pressable onPress={() => navigation.navigate('AdminRegister')}>
              <Text style={styles.createAccountLink}>{t('auth.createOne')}</Text>
            </Pressable>
          </View>
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
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
  forgotPassword: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -SPACING.md,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  createAccountText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
  },
  createAccountLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontFamily: 'Urbanist',
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
}); 