import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, TouchableRipple, TextInput, Button } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Ultimate Team Design System
 * 
 * This file serves as a reference for all UI components and their styling.
 * Based on the administrator dashboard design.
 */

export const UIReference = () => {
  // Animation configurations
  const scale = useSharedValue(1);
  const springConfig: WithSpringConfig = {
    damping: 15,
    stiffness: 100,
  };

  // Example animation handlers
  const onPressIn = () => {
    scale.value = withSpring(0.95, springConfig);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Colors</Text>
        <View style={styles.colorContainer}>
          <View style={[styles.colorBox, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.colorText}>Primary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.colorText}>Secondary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: '#0CC1EC' }]}>
            <Text style={styles.colorText}>Card Blue</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: COLORS.white }]}>
            <Text style={[styles.colorText, { color: COLORS.text }]}>White</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dashboard Cards</Text>
        <View style={styles.cardsContainer}>
          {/* Standard Dashboard Card */}
          <Animated.View style={styles.cardWrapper}>
            <TouchableRipple
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={styles.touchable}
              borderless
            >
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <MaterialCommunityIcons 
                    name="account-group"
                    size={24} 
                    color={COLORS.white}
                    style={styles.cardIcon}
                  />
                  <Text style={styles.cardTitle}>Card Title</Text>
                  <Text style={styles.cardValue}>42</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardSubtitle}>Card subtitle here</Text>
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={20} 
                      color={COLORS.white}
                    />
                  </View>
                </Card.Content>
              </Card>
            </TouchableRipple>
          </Animated.View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Inputs</Text>
        <TextInput
          style={styles.input}
          label="Standard Input"
          mode="flat"
          theme={{ colors: { primary: '#0CC1EC' }}}
          left={<TextInput.Icon icon="account" color={COLORS.primary} style={{ marginRight: 30 }} />}
        />
        <TextInput
          style={styles.input}
          label="Password Input"
          mode="flat"
          theme={{ colors: { primary: '#0CC1EC' }}}
          secureTextEntry
          left={<TextInput.Icon icon="lock" color={COLORS.primary} style={{ marginRight: 30 }} />}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buttons</Text>
        <Button
          mode="contained"
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Primary Button
        </Button>
        <Button
          mode="outlined"
          style={[styles.button, styles.outlinedButton]}
          labelStyle={[styles.buttonLabel, { color: COLORS.primary }]}
        >
          Secondary Button
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typography</Text>
        <Text style={styles.heading1}>Heading 1 (28px)</Text>
        <Text style={styles.heading2}>Heading 2 (24px)</Text>
        <Text style={styles.heading3}>Heading 3 (20px)</Text>
        <Text style={styles.bodyText}>Body Text (16px)</Text>
        <Text style={styles.caption}>Caption Text (14px)</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Animations</Text>
        <View style={styles.animationInfo}>
          <Text style={styles.codeBlock}>
            {`// Entry Animation (FadeInUp)
Animated.View entering={FadeInUp.delay(200).duration(1000).springify()}

// Press Animation (Scale)
const scale = useSharedValue(1);
scale.value = withSpring(0.95, {
  damping: 15,
  stiffness: 100,
});`}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spacing System</Text>
        <View style={styles.spacingContainer}>
          <View style={[styles.spacingBox, { height: SPACING.xs }]}>
            <Text style={styles.spacingText}>XS: {SPACING.xs}px</Text>
          </View>
          <View style={[styles.spacingBox, { height: SPACING.sm }]}>
            <Text style={styles.spacingText}>SM: {SPACING.sm}px</Text>
          </View>
          <View style={[styles.spacingBox, { height: SPACING.md }]}>
            <Text style={styles.spacingText}>MD: {SPACING.md}px</Text>
          </View>
          <View style={[styles.spacingBox, { height: SPACING.lg }]}>
            <Text style={styles.spacingText}>LG: {SPACING.lg}px</Text>
          </View>
          <View style={[styles.spacingBox, { height: SPACING.xl }]}>
            <Text style={styles.spacingText}>XL: {SPACING.xl}px</Text>
          </View>
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
  section: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  colorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  colorBox: {
    width: 100,
    height: 100,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
    marginBottom: SPACING.lg,
    borderRadius: 16,
  },
  touchable: {
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#0CC1EC',
    elevation: 2,
    borderRadius: 16,
  },
  cardContent: {
    padding: SPACING.lg,
  },
  cardIcon: {
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    flex: 1,
    marginRight: SPACING.sm,
  },
  input: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  button: {
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  outlinedButton: {
    borderColor: COLORS.primary,
  },
  heading1: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  bodyText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  caption: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginBottom: SPACING.sm,
  },
  animationInfo: {
    backgroundColor: COLORS.grey[100],
    padding: SPACING.md,
    borderRadius: 8,
  },
  codeBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: COLORS.text,
  },
  spacingContainer: {
    gap: SPACING.md,
  },
  spacingBox: {
    backgroundColor: COLORS.grey[100],
    width: '100%',
    justifyContent: 'center',
    paddingLeft: SPACING.md,
    borderRadius: 4,
  },
  spacingText: {
    fontSize: 14,
    color: COLORS.text,
  },
}); 