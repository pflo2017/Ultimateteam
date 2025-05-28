import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../../constants/theme';

export interface PostCardProps {
  post: {
    id: string;
    title?: string;
    content: string;
    author_name?: string;
    author_avatar?: string;
    created_at: string;
    teams?: { id: string; name: string }[];
    comment_count?: number;
    reaction_count?: number;
  };
  onPressComments: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPressComments }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.author_avatar ? (
          <Image source={{ uri: post.author_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{post.author_name || 'Unknown'}</Text>
          <Text style={styles.date}>{new Date(post.created_at).toLocaleString()}</Text>
        </View>
      </View>
      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
      <Text style={styles.content}>{post.content}</Text>
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
}); 