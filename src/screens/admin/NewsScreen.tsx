import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NewsFeed } from '../../components/news/NewsFeed';
import { Post } from '../../components/news/types';
import { PostCreationModal } from '../../components/news/PostCreationModal';
import { CommentModal } from '../../components/news/CommentModal';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// Real createPost function
const createPost = async (data: { title?: string; content: string; is_general: boolean; team_ids: string[] }) => {
  const { title, content, is_general, team_ids } = data;
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get admin's club
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .single();
    if (!club) throw new Error('No club found for admin');

    // Insert post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert([
        {
          title: title || null,
          content,
          author_id: user.id,
          is_general,
          club_id: club.id,
        },
      ])
      .select()
      .single();
    if (postError) throw postError;

    // If not general, insert into post_teams
    if (!is_general && team_ids.length > 0) {
      const postTeams = team_ids.map(team_id => ({ post_id: post.id, team_id }));
      const { error: ptError } = await supabase
        .from('post_teams')
        .insert(postTeams);
      if (ptError) throw ptError;
    }
  } catch (err) {
    console.error('Error creating post:', err);
    throw err;
  }
};

// Stubbed onSubmitComment function
const onSubmitComment = async (postId: string, content: string): Promise<void> => {
  // TODO: Replace with real API call
  console.log('Adding comment to post', postId, ':', content);
  return new Promise<void>(resolve => setTimeout(resolve, 500));
};

export const AdminNewsScreen = () => {
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: club } = await supabase
          .from('clubs')
          .select('id')
          .eq('admin_id', user.id)
          .single();
        if (!club) return;
        const { data: teamsData, error } = await supabase
          .from('teams')
          .select('id, name')
          .eq('club_id', club.id)
          .eq('is_active', true)
          .order('name');
        if (error) {
          console.error('Error fetching teams:', error);
          setAvailableTeams([]);
        } else {
          setAvailableTeams(teamsData || []);
        }
      } catch (err) {
        console.error('Error loading teams:', err);
        setAvailableTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };
    fetchTeams();
  }, []);

  const handlePressComments = (post: Post) => {
    setSelectedPost(post);
    setShowCommentModal(true);
  };

  const handleCreatePost = async (data: any) => {
    await createPost(data);
    setRefreshKey(k => k + 1); // trigger NewsFeed refresh
  };

  return (
    <View style={styles.container}>
      <NewsFeed key={refreshKey} onPressComments={handlePressComments} />
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <PostCreationModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreatePost}
        availableTeams={availableTeams}
        isAdmin
      />
      {loadingTeams && (
        <View style={{ position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' }}>
          <Text>Loading teams...</Text>
        </View>
      )}
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
    backgroundColor: COLORS.background,
    paddingTop: SPACING.lg,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  fabText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
  },
}); 