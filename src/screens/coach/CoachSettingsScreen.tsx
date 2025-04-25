import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CoachSettingsScreen = () => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (storedCoachData) {
        const coachData = JSON.parse(storedCoachData);
        
        const { data: coachProfile } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', coachData.id)
          .single();

        if (coachProfile) {
          setProfile({
            name: coachProfile.name || '',
            email: coachProfile.email || '',
            phone: coachProfile.phone || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    }
  };

  const handleSave = async () => {
    try {
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) return;

      const coachData = JSON.parse(storedCoachData);
      
      const { error } = await supabase
        .from('coaches')
        .update({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
        })
        .eq('id', coachData.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Profile Information</Text>

          <TextInput
            label="Name"
            value={profile.name}
            onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
            mode="outlined"
            style={styles.input}
            outlineColor={COLORS.grey[300]}
            activeOutlineColor={COLORS.primary}
          />

          <TextInput
            label="Email"
            value={profile.email}
            onChangeText={(text) => setProfile(prev => ({ ...prev, email: text }))}
            mode="outlined"
            style={styles.input}
            outlineColor={COLORS.grey[300]}
            activeOutlineColor={COLORS.primary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            label="Phone"
            value={profile.phone}
            onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
            mode="outlined"
            style={styles.input}
            outlineColor={COLORS.grey[300]}
            activeOutlineColor={COLORS.primary}
            keyboardType="phone-pad"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.xl,
  },
  title: {
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl * 2,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  input: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
  },
}); 