import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Pressable, ActivityIndicator, Image, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import { SUPABASE_URL } from '@env';
import { useTranslation } from 'react-i18next';

export const ClubSettingsScreen = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState({
    clubName: '',
    clubLocation: '',
    adminName: '',
    email: '',
    clubLogo: null as string | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setProfile({
        clubName: profile.club_name,
        clubLocation: profile.club_location,
        adminName: profile.admin_name,
        email: user.email || '',
        clubLogo: profile.club_logo,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('common.error'), t('admin.clubSettings.failedToLoadProfile'));
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const updates = {
        club_name: profile.clubName,
        club_location: profile.clubLocation,
        admin_name: profile.adminName,
        club_logo: profile.clubLogo,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from('admin_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      Alert.alert(t('common.success'), t('admin.clubSettings.profileUpdated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(t('common.error'), t('admin.clubSettings.failedToUpdateProfile'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setIsLoading(true);

      if (newPassword !== confirmNewPassword) {
        Alert.alert(t('common.error'), t('admin.clubSettings.passwordsDoNotMatch'));
        return;
      }

      if (newPassword.length < 6) {
        Alert.alert(t('common.error'), t('admin.clubSettings.passwordTooShort'));
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(t('common.success'), t('admin.clubSettings.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert(t('common.error'), t('admin.clubSettings.failedToUpdatePassword'));
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Check if bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketName = 'club-logos';
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

        if (!bucketExists) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 1024 * 1024 * 2, // 2MB
            allowedMimeTypes: ['image/jpeg', 'image/png']
          });
        }

        // Upload the new image
        const base64FileData = result.assets[0].base64;
        if (!base64FileData) throw new Error('No image data');

        const fileName = `${user.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Update local state with the new filename
        setProfile(prev => ({ ...prev, clubLogo: fileName }));
      }
    } catch (error) {
      console.error('Error picking/uploading image:', error);
      Alert.alert(t('common.error'), t('admin.clubSettings.failedToUploadImage'));
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
            <Text style={styles.sectionTitle}>{t('admin.clubSettings.clubInformation')}</Text>
            
            <View style={styles.logoSection}>
              <Pressable 
                onPress={pickImage}
                style={styles.logoContainer}
              >
                {isLoading ? (
                  <ActivityIndicator size="large" color={COLORS.primary} />
                ) : profile.clubLogo ? (
                  <Image
                    source={{ 
                      uri: `${SUPABASE_URL}/storage/v1/object/public/club-logos/${profile.clubLogo}`,
                    }}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="shield-account"
                    size={48}
                    color={COLORS.grey[400]}
                  />
                )}
                <View style={styles.changePhotoButton}>
                  <MaterialCommunityIcons
                    name="camera"
                    size={16}
                    color={COLORS.white}
                  />
                </View>
              </Pressable>
              <Text style={styles.logoHint}>{t('admin.clubSettings.tapToChangeLogo')}</Text>
            </View>

            <TextInput
              label={t('admin.clubSettings.clubName')}
              value={profile.clubName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, clubName: text }))}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="shield" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />

            <TextInput
              label={t('admin.clubSettings.clubLocation')}
              value={profile.clubLocation}
              onChangeText={(text) => setProfile(prev => ({ ...prev, clubLocation: text }))}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="map-marker" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />

            <TextInput
              label={t('admin.clubSettings.administratorName')}
              value={profile.adminName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, adminName: text }))}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              left={<TextInput.Icon icon="account" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />

            <TextInput
              label={t('admin.clubSettings.email')}
              value={profile.email}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              disabled
              left={<TextInput.Icon icon="email" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />

            <Pressable 
              onPress={handleUpdateProfile}
              disabled={isLoading}
              style={[styles.updateButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('admin.clubSettings.updating') : t('admin.clubSettings.updateProfile')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.clubSettings.changePassword')}</Text>
            <TextInput
              label={t('admin.clubSettings.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry
              left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label={t('admin.clubSettings.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              mode="flat"
              style={styles.input}
              theme={{ colors: { primary: '#0CC1EC' }}}
              secureTextEntry
              left={<TextInput.Icon icon="lock-plus" color={COLORS.primary} style={{ marginRight: 30 }} />}
            />
            <TextInput
              label={t('admin.clubSettings.confirmNewPassword')}
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
              style={[styles.updateButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isLoading ? t('admin.clubSettings.changingPassword') : t('admin.clubSettings.changePasswordButton')}
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
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  logoHint: {
    color: COLORS.grey[600],
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
    fontFamily: 'Urbanist',
  },
}); 