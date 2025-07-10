import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  useSharedValue
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/LanguageSelector';

const { width } = Dimensions.get('window');
const BUTTON_WIDTH = Math.min(380, width - 32);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type RootStackParamList = {
  AdminLogin: undefined;
  CoachLogin: undefined;
  ParentLogin: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  // Animation values for each button
  const adminScale = useSharedValue(1);
  const coachScale = useSharedValue(1);
  const parentScale = useSharedValue(1);
  const adminRotate = useSharedValue(0);
  const coachRotate = useSharedValue(0);
  const parentRotate = useSharedValue(0);

  const handlePressIn = (scale: Animated.SharedValue<number>, rotate: Animated.SharedValue<number>) => {
    scale.value = withSpring(0.95, { damping: 15 });
    rotate.value = withSequence(
      withTiming(0.05, { duration: 100, easing: Easing.inOut(Easing.ease) }),
      withTiming(-0.05, { duration: 100, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) })
    );
  };

  const handlePressOut = (scale: Animated.SharedValue<number>) => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const getAnimatedStyle = (scale: Animated.SharedValue<number>, rotate: Animated.SharedValue<number>) => 
    useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { rotate: `${interpolate(rotate.value, [-1, 1], [-45, 45])}deg` }
      ]
    }));

  return (
    <View style={styles.container}>
      <Animated.View 
        entering={FadeInDown.duration(1000).springify()} 
        style={styles.header}
      >
        <Text style={styles.welcomeText}>{t('home.welcomeMessage')}</Text>
        <Text style={styles.appName}>{t('home.title')}</Text>
      </Animated.View>

      <LanguageSelector style={styles.languageSelector} />

      <View style={styles.buttonContainer}>
        <Animated.View entering={FadeInUp.delay(200).duration(1000).springify()}>
          <AnimatedPressable
            style={[styles.button, getAnimatedStyle(adminScale, adminRotate)]}
            onPressIn={() => handlePressIn(adminScale, adminRotate)}
            onPressOut={() => handlePressOut(adminScale)}
            onPress={() => navigation.navigate('AdminLogin')}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="shield-account" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.buttonText}>{t('home.loginAsAdmin')}</Text>
          </AnimatedPressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(1000).springify()}>
          <AnimatedPressable
            style={[styles.button, getAnimatedStyle(coachScale, coachRotate)]}
            onPressIn={() => handlePressIn(coachScale, coachRotate)}
            onPressOut={() => handlePressOut(coachScale)}
            onPress={() => navigation.navigate('CoachLogin')}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="whistle" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.buttonText}>{t('home.loginAsCoach')}</Text>
          </AnimatedPressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(1000).springify()}>
          <AnimatedPressable
            style={[styles.button, getAnimatedStyle(parentScale, parentRotate)]}
            onPressIn={() => handlePressIn(parentScale, parentRotate)}
            onPressOut={() => handlePressOut(parentScale)}
            onPress={() => navigation.navigate('ParentLogin')}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="account-child" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.buttonText}>{t('home.loginAsParent')}</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl * 2,
  },
  welcomeText: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.grey[600],
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
    fontWeight: '700',
  },
  appName: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    fontFamily: 'Urbanist',
  },
  buttonContainer: {
    gap: SPACING.xl,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    width: BUTTON_WIDTH,
    height: 58,
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    ...SHADOWS.button,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
    flex: 1,
    textAlign: 'center',
    ...SHADOWS.text,
  },
  languageSelector: {
    marginBottom: SPACING.lg,
  },
}); 