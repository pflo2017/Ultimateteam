import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PhoneInput from 'react-native-phone-number-input';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AddCoachScreen = () => {
  const [coachName, setCoachName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const phoneInputRef = React.useRef<PhoneInput>(null);

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

      // First get the club_id for the current admin
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();

      if (clubError) throw clubError;
      if (!clubData) throw new Error('No club found for this admin');

      // Check if phone number already exists for a coach in this club
      const { data: existingCoach } = await supabase
        .from('coaches')
        .select('id')
        .eq('phone_number', phoneNumber.trim())
        .eq('club_id', clubData.id)
        .single();

      if (existingCoach) {
        Alert.alert('Error', 'A coach with this phone number already exists in this club.');
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('coaches')
        .insert([
          {
            name: coachName.trim(),
            phone_number: phoneNumber.trim(),
            admin_id: user.id,
            club_id: clubData.id,
            is_active: true
          }
        ]);

      if (error) throw error;

      // Show success message
      Alert.alert(
        'Coach Created',
        `Coach has been created successfully!\n\nPhone Number: ${phoneNumber.trim()}\n\nShare this phone number with the coach so they can complete their registration.`,
        [
          { 
            text: 'OK',
            onPress: () => navigation.navigate('AdminManage', { refresh: true })
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

          {/* Phone Number Input with Country Picker */}
          {React.createElement(PhoneInput as any, {
            ref: phoneInputRef,
            defaultValue: phoneNumber,
            defaultCode: "RO",
            layout: "first",
            onChangeFormattedText: setPhoneNumber,
            containerStyle: { marginBottom: 16 },
            textInputProps: {
              placeholder: 'Enter phone number',
              keyboardType: 'phone-pad',
            },
            textContainerStyle: { backgroundColor: COLORS.background },
            codeTextStyle: { color: COLORS.text },
            countryPickerButtonStyle: { borderRadius: 8 },
          })}

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