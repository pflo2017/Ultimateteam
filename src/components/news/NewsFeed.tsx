import React, { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Alert } from 'react-native';
import { fetchPosts, updatePost, deletePost } from './postsService';
import { Post } from './types';
import { PostCard } from './PostCard';
import { COLORS, SPACING } from '../../constants/theme';

interface NewsFeedProps {
  filters?: any; // PostFilters
  onPressComments?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  onDelete?: (post: Post) => void;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ filters, onPressComments, onEdit, onDelete }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosts(filters);
      setPosts(data);
    } catch (e) {
      setError('Failed to load news.');
      console.error('Failed to load news:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleEdit = (post: Post) => {
    console.log('Edit post:', post);
    // TODO: Open edit modal and handle update
  };

  const handleDelete = (post: Post) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deletePost(post.id);
            if (error) {
              Alert.alert('Error', 'Failed to delete post.');
            } else {
              await loadPosts();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={{ color: COLORS.error, textAlign: 'center', marginTop: 40 }}>{error}</Text>;
  }
  if (posts.length === 0) {
    return <Text style={{ color: COLORS.grey[600], textAlign: 'center', marginTop: 40 }}>No news yet.</Text>;
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: SPACING.lg }}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onPressComments={() => onPressComments?.(item)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}; 