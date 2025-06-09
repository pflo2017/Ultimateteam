import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { Post } from './types';
import { supabase } from '../../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
}

interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  post: Post;
  onSubmitComment: (postId: string, content: string) => Promise<void>;
}

export const CommentModal: React.FC<CommentModalProps> = ({ visible, onClose, post, onSubmitComment }) => {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [fetching, setFetching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchComments = async () => {
    setFetching(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, author_id, author_name, author_role, content, created_at')
        .eq('post_id', post.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
      console.log('fetchComments result:', data);
    } catch (e) {
      setError('Failed to load comments.');
      setComments([]);
      console.error('Fetch comments error:', e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
    if (visible) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, post.id]);

  const handleSubmit = async () => {
    setError(null);
    if (!comment.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    setLoading(true);
    console.log('handleSubmit called, comment:', comment);
    try {
      await onSubmitComment(post.id, comment.trim());
      console.log('onSubmitComment finished');
      setComment('');
      await fetchComments();
      console.log('fetchComments finished after add');
    } catch (e) {
      setError('Failed to add comment.');
      console.error('Add comment error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('post_comments').delete().eq('id', commentId);
            await fetchComments();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.header}>Comments</Text>
          {fetching ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.commentAuthor}>{item.author_name}</Text>
                      <Text style={styles.commentRole}>{capitalize(item.author_role)}</Text>
                    </View>
                    {currentUserId === item.author_id && (
                      <TouchableOpacity onPress={() => handleDeleteComment(item.id)} style={styles.trashBtn}>
                        <MaterialCommunityIcons name="trash-can" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentContent}>{item.content}</Text>
                  <Text style={styles.commentDate}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
              style={{ flex: 1 }}
            />
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              value={comment}
              onChangeText={setComment}
              editable={!loading}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Send</Text>}
            </TouchableOpacity>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    maxHeight: '90%',
    flex: 1,
  },
  header: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  commentItem: {
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
    paddingBottom: SPACING.sm,
  },
  commentAuthor: {
    fontWeight: 'bold',
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
  },
  commentRole: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[500],
    fontWeight: 'normal',
    marginBottom: 2,
  },
  commentContent: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginVertical: 2,
  },
  commentDate: {
    color: COLORS.grey[500],
    fontSize: FONT_SIZES.xs,
  },
  empty: {
    color: COLORS.grey[500],
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.grey[100],
    marginRight: SPACING.sm,
  },
  submitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  error: {
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: SPACING.md,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: COLORS.grey[300],
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  trashBtn: {
    marginLeft: 8,
    padding: 4,
  },
}); 