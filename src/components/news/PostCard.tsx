import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import ParsedText from 'react-native-parsed-text';
import { Linking } from 'react-native';

export interface PostCardProps {
  post: {
    id: string;
    title?: string;
    content: string;
    author_id?: string;
    author_name?: string;
    author_avatar?: string;
    created_at: string;
    teams?: { id: string; name: string }[];
    comment_count?: number;
    reaction_count?: number;
    author_role?: string;
    media_urls?: string[];
  };
  onPressComments: (postId: string) => void;
  onEdit?: (post: any) => void;
  onDelete?: (post: any) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const imageWidth = screenWidth - (SPACING.lg * 2) - (SPACING.lg * 2); // Account for card padding and screen padding

export const PostCard: React.FC<PostCardProps> = ({ post, onPressComments, onEdit, onDelete }) => {
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsCreator(Boolean(user && post.author_id && user.id === post.author_id));
    })();
  }, [post.author_id]);

  return (
    <View style={styles.card}>
      {isCreator && onEdit && (
        <TouchableOpacity
          style={styles.editIconBtn}
          onPress={() => onEdit(post)}
        >
          <MaterialIcons name="edit" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        {post.author_avatar ? (
          <Image source={{ uri: post.author_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.author}>{post.author_name || 'Unknown'}</Text>
          </View>
          {post.author_role && (
            <Text style={styles.role}>{post.author_role === 'admin' ? 'admin' : post.author_role}</Text>
          )}
          <Text style={styles.date}>{new Date(post.created_at).toLocaleString()}</Text>
        </View>
      </View>
      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
      {/* Post Content with link support */}
      <ParsedText
        style={styles.content}
        parse={[
          { type: 'url', style: { color: COLORS.primary, textDecorationLine: 'underline' }, onPress: (url: string) => Linking.openURL(url) },
        ]}
        childrenProps={{ allowFontScaling: false }}
      >
        {post.content}
      </ParsedText>
      
      {/* Media Gallery */}
      {post.media_urls && post.media_urls.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media_urls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      {post.teams && post.teams.length > 0 && (
        <View style={styles.teamsRow}>
          {post.teams.map(team => (
            <View key={team.id} style={styles.teamBadge}>
              <Text style={styles.teamText}>{team.name}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => onPressComments(post.id)} style={styles.commentButton}>
          <Text style={styles.commentText}>
            {post.comment_count || 0} comment{(post.comment_count || 0) !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
        <Text style={styles.reactionText}>
          {post.reaction_count || 0} like{(post.reaction_count || 0) !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.button,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
    backgroundColor: COLORS.grey[300],
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.md,
    backgroundColor: COLORS.grey[300],
  },
  author: {
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  role: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    fontWeight: '500',
    marginBottom: 2,
  },
  date: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
  title: {
    fontWeight: 'bold',
    fontSize: FONT_SIZES.lg,
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  content: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  teamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
  },
  teamBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  teamText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  commentButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.grey[100],
  },
  commentText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.sm,
  },
  reactionText: {
    color: COLORS.grey[600],
    fontSize: FONT_SIZES.sm,
  },
  editIconBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaContainer: {
    marginVertical: SPACING.sm,
  },
  mediaImage: {
    width: imageWidth,
    height: imageWidth * 0.75, // 4:3 aspect ratio
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
}); 