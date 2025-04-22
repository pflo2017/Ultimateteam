import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const CoachLoginScreen = () => {
  const [accessCode, setAccessCode] = useState('');
  const navigation = useNavigation();

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

      <Animated.View 
        entering={FadeInDown.duration(1000).springify()}
        style={styles.content}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons 
            name="whistle" 
            size={48} 
            color={COLORS.primary}
          />
          <Text style={styles.title}>Coach Login</Text>
          <Text style={styles.subtitle}>Enter your access code provided by the administrator</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Access Code"
            value={accessCode}
            onChangeText={setAccessCode}
            mode="outlined"
            autoCapitalize="characters"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            theme={{ colors: { primary: COLORS.primary }}}
            left={<TextInput.Icon icon="key" color={COLORS.primary} />}
          />

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000).springify()}
          >
            <Pressable 
              style={[styles.loginButton, SHADOWS.button]}
            >
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
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
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
}); 