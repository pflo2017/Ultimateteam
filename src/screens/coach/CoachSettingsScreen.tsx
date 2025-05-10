import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CoachSettingsScreen = () => {
  const [profile, setProfile] = useState({
    name: '',
    phone_number: '',
    accessCode: '',
  });

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
          accessCode: coachData.access_code || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
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
                  To update your account details, please contact your administrator.
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
                label="Access Code"
                value={profile.accessCode}
                mode="flat"
                style={styles.input}
                theme={{ colors: { primary: '#0CC1EC' }}}
                left={<TextInput.Icon icon="key" color={COLORS.primary} style={{ marginRight: 30 }} />}
                disabled
              />
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