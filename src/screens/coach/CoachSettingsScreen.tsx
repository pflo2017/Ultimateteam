import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { getCoachData, getCoachInternalId } from '../../utils/coachUtils';

export const CoachSettingsScreen = () => {
  const [profile, setProfile] = useState({
    name: '',
    phone_number: '',
    email: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (storedCoachData) {
        const coachData = JSON.parse(storedCoachData);
        console.log('Loading coach data:', coachData); // Debug log
        
        // Make sure we're using the exact field names from the database
        setProfile({
          name: coachData.name || '',
          phone_number: coachData.phone_number || '', // This matches the database field name
          email: coachData.email || coachData.user_metadata?.email || '',
        });
        setEmailInput(coachData.email || coachData.user_metadata?.email || '');
        
        // If the email is missing in AsyncStorage but we have a user_id, try to get it from the database
        if (!coachData.email && coachData.id) {
          console.log('Email missing in local storage, fetching from database...');
          const { data, error } = await supabase
            .from('coaches')
            .select('email')
            .eq('id', coachData.id)
            .single();
            
          if (!error && data?.email) {
            console.log('Found email in database:', data.email);
            setProfile(prev => ({ ...prev, email: data.email }));
            setEmailInput(data.email);
            
            // Update the local storage with the email
            await AsyncStorage.setItem('coach_data', JSON.stringify({
              ...coachData,
              email: data.email
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    setIsLoading(true);
    try {
      // Re-authenticate coach with current password
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: profile.phone_number,
        password: currentPassword
      });
      if (signInError) {
        Alert.alert('Error', 'Current password is incorrect');
        setIsLoading(false);
        return;
      }
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        Alert.alert('Error', updateError.message || 'Failed to change password');
        setIsLoading(false);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!emailInput.trim()) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setIsSavingEmail(true);
    try {
      // Update email in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ email: emailInput.trim() });
      if (authError) {
        Alert.alert('Error', authError.message || 'Failed to update email');
        setIsSavingEmail(false);
        return;
      }
      
      // Get the coach's internal ID from the stored data
      const coachId = await getCoachInternalId();
      if (!coachId) {
        console.error('No coach ID found in stored data');
        Alert.alert('Error', 'Could not identify coach record');
        setIsSavingEmail(false);
        return;
      }
      
      // Update the coach's email in the coaches table
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ email: emailInput.trim() })
        .eq('id', coachId);
      
      if (updateError) {
        console.error('Failed to update email in coaches table:', updateError);
        // Proceed anyway since auth update was successful
      } else {
        console.log('Successfully updated email in coaches table');
      }
      
      // Get the stored coach data
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (storedCoachData) {
        const coachData = JSON.parse(storedCoachData);
        
        // Update AsyncStorage with the new email
        const updatedCoachData = { 
          ...coachData, 
          email: emailInput.trim(),
          user_metadata: {
            ...(coachData.user_metadata || {}),
            email: emailInput.trim()
          }
        };
        
        await AsyncStorage.setItem('coach_data', JSON.stringify(updatedCoachData));
        setProfile((prev) => ({ ...prev, email: emailInput.trim() }));
      }
      
      Alert.alert('Success', 'Email updated successfully');
    } catch (error) {
      console.error('Error updating email:', error);
      Alert.alert('Error', 'Failed to update email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Information</Text>
              
              <View style={styles.infoMessageContainer}>
                <Text style={styles.infoMessage}>
                  To change your phone number, please contact your administrator.
                </Text>
              </View>

              <TextInput
                label="Name"
                value={profile.name}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="account" color={COLORS.primary} style={{ marginRight: 30 }} />}
                disabled
              />
              <TextInput
                label="Phone Number"
                value={profile.phone_number}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="phone" color={COLORS.primary} style={{ marginRight: 30 }} />}
                disabled
              />
              <TextInput
                label="Email"
                value={emailInput}
                onChangeText={setEmailInput}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="email" color={COLORS.primary} style={{ marginRight: 30 }} />}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable
                onPress={handleSaveEmail}
                disabled={isSavingEmail || !emailInput.trim()}
                style={[styles.input, { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 100, opacity: isSavingEmail ? 0.7 : 1 }]}
              >
                <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 16 }}>
                  {isSavingEmail ? 'Saving...' : 'Save Email'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Change Password</Text>
              <TextInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                secureTextEntry
                left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                secureTextEntry
                left={<TextInput.Icon icon="lock-plus" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <TextInput
                label="Confirm New Password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                secureTextEntry
                left={<TextInput.Icon icon="lock-check" color={COLORS.primary} style={{ marginRight: 30 }} />}
              />
              <Pressable 
                onPress={handleChangePassword}
                disabled={isLoading}
                style={[styles.input, { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 100, opacity: isLoading ? 0.7 : 1 }]}
              >
                <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 16 }}>
                  {isLoading ? 'Changing Password...' : 'Change Password'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxl,
  },
  form: {
    padding: SPACING.md,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  input: {
    marginBottom: SPACING.md,
    backgroundColor: '#fff',
    height: 58,
  },
  inputOutline: {
    borderRadius: 100,
    borderWidth: 1,
  },
  inputContent: {
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
  },
  infoMessageContainer: {
    backgroundColor: COLORS.grey[100],
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.xl,
  },
  infoMessage: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
}); 