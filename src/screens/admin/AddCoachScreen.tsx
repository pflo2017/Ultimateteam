import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

export const AddCoachScreen = () => {
  const [coachName, setCoachName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const generateAccessCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'C-'; // Prefix to distinguish coach codes
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleCreateCoach = async () => {
    if (!coachName.trim() || !phoneNumber.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Authentication error');
      }

      const accessCode = generateAccessCode();

      // First check if access code already exists
      const { data: existingCode } = await supabase
        .from('coaches')
        .select('id')
        .eq('access_code', accessCode)
        .single();

      if (existingCode) {
        // In the rare case of a collision, generate a new code
        throw new Error('Access code collision, please try again');
      }

      const { error } = await supabase
        .from('coaches')
        .insert([
          {
            name: coachName.trim(),
            phone_number: phoneNumber.trim(),
            admin_id: user.id,
            is_active: true,
            access_code: accessCode
          }
        ]);

      if (error) throw error;

      // Show success message with the access code
      Alert.alert(
        'Coach Created',
        `Coach has been created successfully!\n\nAccess Code: ${accessCode}\n\nPlease share this code with the coach.`,
        [
          { 
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error) {
      console.error('Error creating coach:', error);
      Alert.alert(
        'Error',
        'Failed to create coach. Please try again.',
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
          <Text style={styles.title}>Add New Coach</Text>
          <Text style={styles.subtitle}>Enter coach details</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Coach Name"
            value={coachName}
            onChangeText={setCoachName}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            placeholder="Enter full name"
            left={<TextInput.Icon icon="account-tie" color={COLORS.primary} />}
          />

          <TextInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" color={COLORS.primary} />}
          />

          <Pressable 
            onPress={handleCreateCoach}
            disabled={isLoading}
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating Coach...' : 'Create Coach'}
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