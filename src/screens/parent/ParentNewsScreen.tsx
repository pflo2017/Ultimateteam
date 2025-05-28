import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NewsFeed } from '../../components/news/NewsFeed';
import { Post } from '../../components/news/types';
import { CommentModal } from '../../components/news/CommentModal';
import { COLORS } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// Stubbed onSubmitComment function
const onSubmitComment = async (postId: string, content: string): Promise<void> => {
  // TODO: Replace with real API call
  console.log('Adding comment to post', postId, ':', content);
  return new Promise<void>(resolve => setTimeout(resolve, 500));
};

export const ParentNewsScreen = () => {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [teamIds, setTeamIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeamIds = async () => {
      try {
        const parentData = await AsyncStorage.getItem('parent_data');
        if (!parentData) return;
        const parent = JSON.parse(parentData);
        // Get all children for this parent
        const { data: children, error } = await supabase
          .from('parent_children')
          .select('team_id')
          .eq('parent_id', parent.id)
          .eq('is_active', true);
        if (error) return;
        const ids = Array.from(new Set((children || []).map((c: any) => c.team_id).filter(Boolean)));
        setTeamIds(ids);
      } catch (err) {
        setTeamIds([]);
      }
    };
    fetchTeamIds();
  }, []);

  const handlePressComments = (post: Post) => {
    setSelectedPost(post);
    setShowCommentModal(true);
  };

  return (
    <View style={styles.container}>
      <NewsFeed filters={{ team_ids: teamIds }} onPressComments={handlePressComments} />
      {selectedPost && (
        <CommentModal
          visible={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          post={selectedPost}
          onSubmitComment={onSubmitComment}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: 24,
  },
}); 