# Ultimate Team Design System

This design system is based on the administrator dashboard's UI and should be used as a reference for all future development to maintain consistency across the application.

## Core Elements

### Colors
- Primary: Used for main actions and primary branding
- Secondary: Used for secondary actions and accents
- Card Blue (#0CC1EC): Used for dashboard cards and interactive elements
- White: Background color and text on dark backgrounds
- Grey Scale: Used for text, borders, and subtle backgrounds

### Typography
- Heading 1: 28px, Semi-bold (600)
- Heading 2: 24px, Semi-bold (600)
- Heading 3: 20px, Semi-bold (600)
- Body Text: 16px, Regular (400)
- Caption: 14px, Regular (400)

### Spacing
- XS: Smallest spacing unit
- SM: Small spacing for tight layouts
- MD: Medium spacing for general use
- LG: Large spacing for section separation
- XL: Extra large spacing for major sections

## Components

### Dashboard Cards
- Width: 48% of container
- Background: #0CC1EC
- Border Radius: 16px
- Padding: SPACING.lg
- White text and icons
- Scale animation on press (0.95)
- FadeInUp entry animation

### Text Inputs
- Outlined style
- Left icon in primary color
- White background
- Full width
- Consistent padding

### Buttons
- Contained (Primary)
- Outlined (Secondary)
- Consistent height and padding
- Clear touch feedback

## Animations

### Entry Animations
```typescript
// FadeInUp with spring effect
entering={FadeInUp.delay(200).duration(1000).springify()}
```

### Press Animations
```typescript
// Scale with spring
const scale = useSharedValue(1);
scale.value = withSpring(0.95, {
  damping: 15,
  stiffness: 100,
});
```

## Usage Guidelines

1. Always use the spacing constants from `SPACING` for consistency
2. Maintain the card layout pattern (48% width, 2 columns)
3. Use the standard animations for entry and interaction
4. Follow the color scheme strictly
5. Use the typography scale for all text elements
6. Implement press feedback on interactive elements

## Implementation Example

```typescript
// Card implementation
<Animated.View 
  entering={FadeInUp.delay(delay).duration(1000).springify()}
  style={styles.cardWrapper}
>
  <TouchableRipple
    onPress={onPress}
    style={styles.touchable}
    borderless
  >
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <MaterialCommunityIcons 
          name={icon}
          size={24} 
          color={COLORS.white}
          style={styles.cardIcon}
        />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
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
```

## Best Practices

1. Always use the provided components from `UIReference.tsx`
2. Maintain consistent spacing using the SPACING constants
3. Follow the established animation patterns
4. Use the correct typography styles for each text type
5. Implement proper touch feedback on interactive elements
6. Keep the color scheme consistent
7. Ensure proper contrast for accessibility
8. Use icons consistently across similar components

## File Structure

```
src/
  design/
    UIReference.tsx    # Component showcase and reference
    README.md         # Documentation and guidelines
  constants/
    theme.ts          # Colors, spacing, and other theme constants
``` 