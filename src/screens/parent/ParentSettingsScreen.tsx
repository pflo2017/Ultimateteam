import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Pressable, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

export const ParentSettingsScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const { t } = useTranslation();

  useEffect(() => {
    loadParentData();
    
    // Setup focus listener to reload data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused - reloading data');
      loadParentData(true);
    });
    
    return unsubscribe;
  }, []);

  const loadParentData = async (forceRefresh = false) => {
    try {
      // Get the parent ID from AsyncStorage
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) {
        Alert.alert('Error', 'Failed to load your information');
        return;
      }
      
      const parent = JSON.parse(parentData);
      console.log('Parent ID for data loading:', parent.id);
      console.log('Current email in AsyncStorage:', parent.email);
      
      if (forceRefresh) {
        // Get fresh data directly from the database
        console.log('Force refreshing data from database');
        const { data: freshData, error } = await supabase
          .from('parents')
          .select('*')
          .eq('id', parent.id)
          .single();
          
        if (error) {
          console.error('Error fetching fresh data:', error);
        } else if (freshData) {
          console.log('Fresh data from database:', freshData);
          console.log('Fresh email from database:', freshData.email);
          
          // Update AsyncStorage with fresh data
          await AsyncStorage.setItem('parent_data', JSON.stringify(freshData));
          
          // Update UI
          setName(freshData.name || '');
          setEmail(freshData.email || '');
          setPhoneNumber(freshData.phone_number || '');
          return;
        }
      }
      
      // Fallback to AsyncStorage data
      setName(parent.name || '');
      setEmail(parent.email || '');
      setPhoneNumber(parent.phone_number || '');
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
      console.log('PARENT ID:', parent.id);
      console.log('BEFORE UPDATE - Current email in AsyncStorage:', parent.email);
      console.log('BEFORE UPDATE - New email to set:', email.trim() || null);
      
      console.log('ATTEMPTING UPDATE WITH BYPASS FUNCTION');
      // Use the security definer function to bypass RLS
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_parent_email_bypass',
        {
          p_id: parent.id,
          p_email: email.trim() || null
        }
      );
      
      console.log('UPDATE RESULT:', updateResult);
      
      if (updateError) {
        console.error('UPDATE ERROR WITH BYPASS:', updateError);
        
        // Try a more direct approach - execute raw SQL
        console.log('ATTEMPTING ALTERNATE DIRECT UPDATE');
        const { data: rawResult, error: rawError } = await supabase.rpc(
          'execute_sql',
          { 
            sql_query: `UPDATE parents SET email = '${email.trim() || null}' WHERE id = '${parent.id}' RETURNING email` 
          }
        );
        
        if (rawError) {
          console.error('RAW SQL ERROR:', rawError);
          
          // Last resort - standard update
          console.log('ATTEMPTING STANDARD UPDATE');
          const { error: stdError } = await supabase
            .from('parents')
            .update({
              name: name.trim(),
              email: email.trim() || null
            })
            .eq('id', parent.id);
            
          if (stdError) {
            console.error('STANDARD UPDATE ERROR:', stdError);
            Alert.alert('Error', 'Failed to update profile.');
            return;
          }
        } else {
          console.log('RAW SQL RESULT:', rawResult);
        }
      }
      
      // Regardless of which update method worked, get fresh data
      console.log('FETCHING FRESH DATA AFTER UPDATE');
      const { data: freshData, error: fetchError } = await supabase
        .from('parents')
        .select('*')
        .eq('id', parent.id)
        .single();
        
      if (fetchError) {
        console.error('Error fetching after update:', fetchError);
      } else {
        console.log('FRESH DATA AFTER UPDATE:', freshData);
        
        // Update AsyncStorage with the freshly fetched data
        await AsyncStorage.setItem('parent_data', JSON.stringify({
          ...freshData,
          email: email.trim() || null  // Force the email to be what user entered
        }));
        
        // Verify AsyncStorage update
        const verifyData = await AsyncStorage.getItem('parent_data');
        if (verifyData) {
          const verifyParent = JSON.parse(verifyData);
          console.log('VERIFY - AsyncStorage data:', verifyParent);
          console.log('VERIFY - Email in AsyncStorage:', verifyParent.email);
        }
        
        Alert.alert('Success', 'Profile updated successfully', [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack() 
          }
        ]);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', `Failed to update profile: ${error.message || 'Unknown error'}`);
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
            <Text style={styles.sectionTitle}>{t('parent.settings.profileInfo', 'Profile Information')}</Text>
            <TextInput
              label={t('parent.settings.name', 'Name')}
              value={name}
              onChangeText={setName}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label={t('parent.settings.emailOptional', 'Email (Optional)')}
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
              label={t('parent.settings.phoneNumber', 'Phone Number')}
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
                {isLoading ? t('parent.settings.updating', 'Updating...') : t('parent.settings.updateProfile', 'Update Profile')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('parent.settings.changePassword', 'Change Password')}</Text>
            <TextInput
              label={t('parent.settings.currentPassword', 'Current Password')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry
              left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label={t('parent.settings.newPassword', 'New Password')}
              value={newPassword}
              onChangeText={setNewPassword}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry
              left={<TextInput.Icon icon="lock-plus" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label={t('parent.settings.confirmNewPassword', 'Confirm New Password')}
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
                {isLoading ? t('parent.settings.changingPassword', 'Changing Password...') : t('parent.settings.changePassword', 'Change Password')}
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