import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import type { RouteProp } from '@react-navigation/native';
import type { AdminStackParamList } from '../../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type EditCoachScreenRouteProp = RouteProp<AdminStackParamList, 'EditCoach'>;
type EditCoachScreenNavigationProp = NativeStackNavigationProp<AdminStackParamList>;

export const EditCoachScreen = () => {
  const [coachName, setCoachName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<EditCoachScreenNavigationProp>();
  const route = useRoute<EditCoachScreenRouteProp>();
  const { coachId } = route.params;

  useEffect(() => {
    loadCoachData();
  }, []);

  const loadCoachData = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('name, phone_number')
        .eq('id', coachId)
        .single();

      if (error) throw error;
      if (data) {
        setCoachName(data.name);
        setPhoneNumber(data.phone_number);
      }
    } catch (error) {
      console.error('Error loading coach data:', error);
      Alert.alert('Error', 'Failed to load coach data');
    }
  };

  const handleUpdateCoach = async () => {
    if (!coachName.trim() || !phoneNumber.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          name: coachName.trim(),
          phone_number: phoneNumber.trim(),
        })
        .eq('id', coachId);

      if (error) throw error;

      Alert.alert(
        'Success',
        'Coach updated successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 1,
                  routes: [
                    { name: 'AdminTabs' },
                    {
                      name: 'AdminTabs',
                      params: { screen: 'Manage', params: { activeTab: 'coaches', refresh: true } }
                    }
                  ]
                })
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error updating coach:', error);
      Alert.alert('Error', 'Failed to update coach');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoach = () => {
    Alert.alert(
      'Delete Coach',
      'Are you sure you want to delete this coach? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await supabase
                .from('coaches')
                .update({ is_active: false })
                .eq('id', coachId);

              if (error) throw error;

              Alert.alert(
                'Success',
                'Coach deleted successfully',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.dispatch(
                        CommonActions.reset({
                          index: 1,
                          routes: [
                            { name: 'AdminTabs' },
                            {
                              name: 'AdminTabs',
                              params: { screen: 'Manage', params: { activeTab: 'coaches', refresh: true } }
                            }
                          ]
                        })
                      );
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error deleting coach:', error);
              Alert.alert('Error', 'Failed to delete coach');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.title}>Edit Coach</Text>
          <Text style={styles.subtitle}>Update coach information or delete coach</Text>
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
            left={<TextInput.Icon icon="phone" color={COLORS.primary} />}
            keyboardType="phone-pad"
          />

          <Pressable 
            onPress={handleUpdateCoach}
            disabled={isLoading}
            style={[styles.updateButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Updating...' : 'Update Coach'}
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleDeleteCoach}
            disabled={isLoading}
            style={[styles.deleteButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonText, styles.deleteButtonText]}>
              Delete Coach
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
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  deleteButton: {
    backgroundColor: COLORS.white,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
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
  deleteButtonText: {
    color: COLORS.error,
  },
}); 