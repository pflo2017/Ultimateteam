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
import { useTranslation } from 'react-i18next';

type EditCoachScreenRouteProp = RouteProp<AdminStackParamList, 'EditCoach'>;
type EditCoachScreenNavigationProp = NativeStackNavigationProp<AdminStackParamList>;

export const EditCoachScreen = () => {
  const [coachName, setCoachName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<EditCoachScreenNavigationProp>();
  const route = useRoute<EditCoachScreenRouteProp>();
  const { coachId } = route.params;
  const { t } = useTranslation();

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
      Alert.alert(t('common.error'), t('admin.editCoach.failedToLoadData'));
    }
  };

  const handleUpdateCoach = async () => {
    if (!coachName.trim() || !phoneNumber.trim()) {
      Alert.alert(t('common.error'), t('admin.editCoach.pleaseFillAllFields'));
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
        t('common.success'),
        t('admin.editCoach.coachUpdated'),
        [
          {
            text: t('admin.addCoach.ok'),
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
      Alert.alert(t('common.error'), t('admin.editCoach.failedToUpdateCoach'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoach = () => {
    Alert.alert(
      t('admin.editCoach.deleteCoach'),
      t('admin.editCoach.deleteConfirmation'),
      [
        {
          text: t('admin.addCoach.cancel'),
          style: 'cancel',
        },
        {
          text: t('admin.addCoach.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              console.log('Attempting to delete coach with ID:', coachId);
              
              // First check if coach has a user_id
              const { data: coachData, error: fetchError } = await supabase
                .from('coaches')
                .select('user_id, name')
                .eq('id', coachId)
                .single();
                
              if (fetchError) {
                console.error('Error fetching coach data:', fetchError);
                throw fetchError;
              }
              
              let error;
              
              // For coaches without user_id (pending registration), actually delete them from database
              if (!coachData.user_id) {
                console.log(`Coach ${coachData.name} has no user_id - performing actual DELETE from database`);
                const { error: deleteError } = await supabase
                  .from('coaches')
                  .delete()
                  .eq('id', coachId);
                  
                error = deleteError;
              } else {
                // For registered coaches, just mark as inactive (soft delete)
                console.log(`Coach ${coachData.name} has user_id - performing soft delete by setting is_active=false`);
                const { error: updateError } = await supabase
                  .from('coaches')
                  .update({ is_active: false })
                  .eq('id', coachId);
                  
                error = updateError;
              }

              if (error) throw error;
              
              // Verify the operation worked
              if (!coachData.user_id) {
                // For deleted coaches, verify they're gone
                const { data: verifyDelete, error: verifyError } = await supabase
                  .from('coaches')
                  .select('id')
                  .eq('id', coachId);
                  
                if (verifyError) {
                  console.error('Error verifying coach deletion:', verifyError);
                } else {
                  console.log('Coach deletion verified, records found:', verifyDelete?.length || 0);
                }
              } else {
                // For soft-deleted coaches, verify is_active=false
                const { data: verifyCoach, error: verifyError } = await supabase
                  .from('coaches')
                  .select('is_active')
                  .eq('id', coachId)
                  .single();
                  
                if (verifyError) {
                  console.error('Error verifying coach deletion:', verifyError);
                } else {
                  console.log('Coach soft deletion verified, is_active set to:', verifyCoach.is_active);
                }
              }

              Alert.alert(
                t('common.success'),
                t('admin.editCoach.coachDeleted'),
                [
                  {
                    text: t('admin.addCoach.ok'),
                    onPress: () => {
                      navigation.dispatch(
                        CommonActions.reset({
                          index: 1,
                          routes: [
                            { name: 'AdminTabs' },
                            {
                              name: 'AdminTabs',
                              params: { screen: 'Manage', params: { activeTab: 'coaches', refresh: Date.now() } }
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
              Alert.alert(t('common.error'), t('admin.editCoach.failedToDeleteCoach'));
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
          <Text style={styles.title}>{t('admin.editCoach.title')}</Text>
          <Text style={styles.subtitle}>{t('admin.editCoach.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('admin.editCoach.coachName')}
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
            label={t('admin.editCoach.phoneNumber')}
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
              {isLoading ? t('admin.editCoach.updating') : t('admin.editCoach.updateCoach')}
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleDeleteCoach}
            disabled={isLoading}
            style={[styles.deleteButton, isLoading && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonText, styles.deleteButtonText]}>
              {t('admin.editCoach.deleteCoach')}
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