import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

type RootStackParamList = {
  AdminLogin: undefined;
  AdminRegister: undefined;
  CoachLogin: undefined;
  ParentLogin: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormData {
  clubName: string;
  clubLocation: string;
  adminName: string;
  email: string;
  password: string;
  confirmPassword: string;
  clubLogo: string | null;
}

export const AdminRegisterScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [formData, setFormData] = useState<FormData>({
    clubName: '',
    clubLocation: '',
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
    clubLogo: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({ ...prev, clubLogo: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      // Read the file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert to array buffer
      const arrayBuffer = decode(base64);
      
      // Generate a unique file name with timestamp to avoid collisions
      const timestamp = new Date().getTime();
      const fileExt = uri.substring(uri.lastIndexOf('.') + 1);
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('club-logos')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('club-logos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload club logo');
    }
  };

  const handleRegister = async () => {
    try {
      setIsLoading(true);
      
      // Validate required fields
      if (!formData.clubName || !formData.clubLocation || !formData.adminName || 
          !formData.email || !formData.password || !formData.confirmPassword) {
        setRegistrationSuccess(false);
        Alert.alert('Missing Information', 'Please fill in all required fields');
        return;
      }

      // Validate password match
      if (formData.password !== formData.confirmPassword) {
        setRegistrationSuccess(false);
        Alert.alert('Password Mismatch', 'Passwords do not match');
        return;
      }

      // Validate password strength
      if (formData.password.length < 6) {
        setRegistrationSuccess(false);
        Alert.alert('Weak Password', 'Password must be at least 6 characters long');
        return;
      }

      // Create auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please use a different email or try logging in.');
        }
        throw new Error(authError.message);
      }

      if (!authData.user?.id) {
        throw new Error('Failed to create user account. Please try again.');
      }

      // Sign in immediately after signup to get a session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw new Error('Account created but failed to establish session. Please try logging in.');
      }

      // Verify we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Failed to establish a valid session. Please try logging in.');
      }

      // Upload image if selected
      let logoUrl = null;
      if (formData.clubLogo) {
        try {
          setUploadProgress(0);
          logoUrl = await uploadImage(formData.clubLogo);
          setUploadProgress(100);
        } catch (error: any) {
          console.error('Failed to upload logo:', error);
          const response = await new Promise((resolve) => {
            Alert.alert(
              'Upload Failed',
              'Failed to upload club logo. Would you like to continue registration without a logo?',
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Continue', onPress: () => resolve(true) }
              ]
            );
          });
          
          if (!response) {
            setIsLoading(false);
            // Sign out since we won't complete registration
            await supabase.auth.signOut();
            return;
          }
        }
      }

      // Create admin profile
      const { data: profileData, error: profileError } = await supabase
        .from('admin_profiles')
        .insert([
          {
            user_id: session.user.id, // Use the session user ID instead of authData
            club_name: formData.clubName,
            club_location: formData.clubLocation,
            admin_name: formData.adminName,
            club_logo: logoUrl,
          },
        ])
        .select();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        console.error('Profile error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        // Sign out since profile creation failed
        await supabase.auth.signOut();
        throw new Error(`Failed to create admin profile: ${profileError.message}`);
      }

      // Sign out after successful registration
      await supabase.auth.signOut();

      setRegistrationSuccess(true);
      Alert.alert(
        'Success',
        'Account created successfully! You can now log in.',
        [{ text: 'OK' }]
      );
      
      setTimeout(() => {
        navigation.navigate('AdminLogin');
      }, 2000);

    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Registration Error', error?.message || 'An error occurred during registration. Please try again.');
      setRegistrationSuccess(false);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  if (registrationSuccess) {
    return (
      <View style={styles.successContainer}>
        <Animated.View 
          entering={FadeInDown.duration(1000).springify()}
          style={styles.successContent}
        >
          <MaterialCommunityIcons 
            name="check-circle" 
            size={64} 
            color={COLORS.primary}
          />
          <Text style={styles.successTitle}>Congratulations!</Text>
          <Text style={styles.successMessage}>
            Your administrator account has been created successfully. You can now log in.
          </Text>
        </Animated.View>
      </View>
    );
  }

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

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInDown.duration(1000).springify()}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Admin Account</Text>
            <Text style={styles.subtitle}>Set up your club and administrator profile</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Club Name"
              value={formData.clubName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, clubName: text }))}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="domain" color={COLORS.primary} />}
            />

            <TextInput
              label="Club Location (City)"
              value={formData.clubLocation}
              onChangeText={(text) => setFormData(prev => ({ ...prev, clubLocation: text }))}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="map-marker" color={COLORS.primary} />}
            />

            <Pressable 
              style={styles.logoUploadButton} 
              onPress={pickImage}
            >
              <MaterialCommunityIcons 
                name={formData.clubLogo ? "check-circle" : "image"} 
                size={24} 
                color={COLORS.primary} 
              />
              <Text style={styles.logoUploadText}>
                {formData.clubLogo ? "Change Club Logo" : "Upload Club Logo (Optional)"}
              </Text>
            </Pressable>

            <TextInput
              label="Administrator Name"
              value={formData.adminName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, adminName: text }))}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="account" color={COLORS.primary} />}
            />

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="email" color={COLORS.primary} />}
            />

            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="lock" color={COLORS.primary} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off" : "eye"}
                  color={COLORS.primary}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            <TextInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              theme={{ colors: { primary: COLORS.primary }}}
              left={<TextInput.Icon icon="lock-check" color={COLORS.primary} />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  color={COLORS.primary}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
            />

            <Animated.View 
              entering={FadeInDown.delay(400).duration(1000).springify()}
            >
              <Pressable 
                onPress={handleRegister}
                disabled={isLoading}
                style={[
                  styles.registerButton,
                  SHADOWS.button,
                  isLoading && styles.registerButtonDisabled
                ]}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SPACING.xl * 3,
    paddingBottom: SPACING.xl,
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
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
    textAlign: 'center',
    lineHeight: 34,
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
  logoUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 100,
    borderStyle: 'dashed',
  },
  logoUploadText: {
    marginLeft: SPACING.sm,
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontFamily: 'Urbanist',
    fontWeight: '600',
  },
  registerButton: {
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
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  successContent: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    fontFamily: 'Urbanist',
  },
  successMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
}); 