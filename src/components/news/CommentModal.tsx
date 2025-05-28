import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { Post } from './types';

// Mocked comments for now
const MOCK_COMMENTS = [
  { id: 'c1', author: 'Parent Alice', content: 'Great news!', created_at: new Date().toISOString() },
  { id: 'c2', author: 'Coach John', content: 'Looking forward to it.', created_at: new Date().toISOString() },
];

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
  const [comments, setComments] = useState(MOCK_COMMENTS);

  const handleSubmit = async () => {
    setError(null);
    if (!comment.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await onSubmitComment(post.id, comment.trim());
      setComments(prev => [
        { id: Math.random().toString(), author: 'You', content: comment.trim(), created_at: new Date().toISOString() },
        ...prev,
      ]);
      setComment('');
    } catch (e) {
      setError('Failed to add comment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.header}>Comments</Text>
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Text style={styles.commentAuthor}>{item.author}</Text>
                <Text style={styles.commentContent}>{item.content}</Text>
                <Text style={styles.commentDate}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
            style={{ flex: 1 }}
          />
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
}); 