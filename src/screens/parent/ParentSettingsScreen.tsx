import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Pressable, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export const ParentSettingsScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    loadParentData();
  }, []);

  const loadParentData = async () => {
    try {
      const parentData = await AsyncStorage.getItem('parent_data');
      if (parentData) {
        const parent = JSON.parse(parentData);
        setName(parent.name || '');
        setEmail(parent.email || '');
        setPhoneNumber(parent.phone_number || '');
      }
    } catch (error) {
      console.error('Error loading parent data:', error);
      Alert.alert('Error', 'Failed to load your information');
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      setIsLoading(true);
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('No parent data found');
      
      const parent = JSON.parse(parentData);
      
      const { error } = await supabase
        .from('parents')
        .update({
          name: name.trim(),
          email: email.trim() || null,
        })
        .eq('id', parent.id);

      if (error) throw error;

      // Update local storage
      const updatedParent = { ...parent, name: name.trim(), email: email.trim() || null };
      await AsyncStorage.setItem('parent_data', JSON.stringify(updatedParent));

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('No parent data found');
      
      const parent = JSON.parse(parentData);

      // Verify current password
      const { data: verifiedParent, error: verifyError } = await supabase
        .from('parents')
        .select('id')
        .eq('id', parent.id)
        .eq('password', currentPassword)
        .single();

      if (verifyError || !verifiedParent) {
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('parents')
        .update({ password: newPassword })
        .eq('id', parent.id);

      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label="Email (Optional)"
              value={email}
              onChangeText={setEmail}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label="Phone Number"
              value={phoneNumber}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              disabled
              left={<TextInput.Icon icon="phone" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <Pressable 
              onPress={handleUpdateProfile}
              disabled={isLoading}
              style={[styles.updateButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Updating...' : 'Update Profile'}
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
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry
              left={<TextInput.Icon icon="lock-check" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <Pressable 
              onPress={handleChangePassword}
              disabled={isLoading}
              style={[styles.updateButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Changing Password...' : 'Change Password'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.xl,
  },
  form: {
    gap: SPACING.xl * 2,
  },
  section: {
    gap: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Urbanist',
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
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
}); 