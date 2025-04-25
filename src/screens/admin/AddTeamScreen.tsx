import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

export const AddTeamScreen = () => {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const generateAccessCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;

    setIsLoading(true);
    try {
      console.log('Starting team creation...');
      
      // First get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auth check result:', { user, userError });
      
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Get the club_id for the current admin
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();

      if (clubError) throw clubError;
      if (!club) throw new Error('No club found for this admin');

      const access_code = generateAccessCode();
      console.log('Generated access code:', access_code);
      
      const newTeam = {
        name: teamName.trim(),
        access_code,
        created_at: new Date().toISOString(),
        admin_id: user.id,
        club_id: club.id,
        is_active: true
      };
      
      console.log('Attempting to create team:', newTeam);
      
      // Insert the team with the admin_id and club_id
      const { data, error } = await supabase
        .from('teams')
        .insert([newTeam])
        .select()
        .single();

      console.log('Insert result:', { data, error });

      if (error) {
        console.error('Database error:', error);
        Alert.alert(
          'Error',
          'Failed to create team. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Team created successfully:', data);
      
      // Success! Go back to the teams list
      navigation.goBack();
    } catch (error) {
      console.error('Error adding team:', error);
      Alert.alert(
        'Error',
        'Something went wrong while creating the team.',
        [{ text: 'OK' }]
      );
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

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Create New Team</Text>
          <Text style={styles.subtitle}>Enter team name to generate access code</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Team Name"
            value={teamName}
            onChangeText={setTeamName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            placeholder="e.g., Grupa 2016-2017"
            left={<TextInput.Icon icon="account-multiple-plus" color={COLORS.primary} />}
          />

          <Pressable 
            onPress={handleCreateTeam}
            disabled={isLoading}
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating Team...' : 'Create Team'}
            </Text>
          </Pressable>
        </View>
      </View>
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
    paddingTop: SPACING.xl * 4,
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
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  createButtonDisabled: {
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