import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Post } from '../types/post';
import { format } from 'date-fns';
import ParsedText from 'react-native-parsed-text';
import { Linking } from 'react-native';

interface LatestPostHeadlineProps {
  post: Post | null;
  onPress: () => void;
}

export const LatestPostHeadline: React.FC<LatestPostHeadlineProps> = ({ post, onPress }) => {
  if (!post) {
    return null;
  }

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Recent news</Text>
      </View>
      <TouchableOpacity 
        style={styles.container} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {post.title || 'Latest News'}
            </Text>
            <Text style={styles.date}>
              {format(new Date(post.created_at), 'MMM d, yyyy')}
            </Text>
          </View>
          
          <ParsedText
            style={styles.content}
            numberOfLines={2}
            parse={[
              { type: 'url', style: { color: COLORS.primary, textDecorationLine: 'underline' }, onPress: (url: string) => Linking.openURL(url) },
            ]}
            childrenProps={{ allowFontScaling: false }}
          >
            {post.content}
          </ParsedText>

          <View style={styles.footer}>
            <Text style={styles.readMore}>
              Read more &gt;
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: COLORS.grey[200],
    marginHorizontal: SPACING.lg,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: SPACING.lg,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.button,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  date: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
  content: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  readMore: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
}); 