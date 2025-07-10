import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { NewsFeed } from '../../components/news/NewsFeed';
import { Post } from '../../components/news/types';
import { CommentModal } from '../../components/news/CommentModal';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { updatePost, deletePost } from '../../components/news/postsService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import { useTranslation } from 'react-i18next';
import { registerEventListener } from '../../utils/events';

// Real createPost function
const createPost = async (data: { title?: string; content: string; is_general: boolean; team_ids: string[] }) => {
  const { title, content, is_general, team_ids } = data;
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('DEBUG: Current user:', user);
    if (!user) throw new Error('Not authenticated');

    // Get admin's club
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .single();
    if (!club) throw new Error('No club found for admin');

    // Get admin's name
    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('admin_name')
      .eq('user_id', user.id)
      .single();
    if (!adminProfile) throw new Error('No admin profile found');

    // Insert post
    const postPayload = {
      title: title || null,
      content,
      author_id: user.id,
      author_name: adminProfile.admin_name,
      author_role: 'admin',
      is_general,
      club_id: club.id,
    };
    console.log('DEBUG: Post insert payload:', postPayload);
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert([postPayload])
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

// Real onSubmitComment function
const onSubmitComment = async (postId: string, content: string): Promise<void> => {
  console.log('onSubmitComment called with postId:', postId, 'content:', content);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('admin_name')
    .eq('user_id', user.id)
    .single();
  if (!adminProfile) throw new Error('No admin profile found');
  const payload = {
    post_id: postId,
    author_id: user.id,
    author_name: adminProfile.admin_name,
    author_role: 'admin',
    content,
    is_active: true,
  };
  console.log('Inserting comment with payload:', payload);
  const { data: insertData, error } = await supabase
    .from('post_comments')
    .insert([payload])
    .select('*');
  console.log('Supabase insert result (data):', insertData);
  console.log('Supabase insert result (error):', error);
  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
};

export const AdminNewsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);

  // Add event listeners for post save/delete events
  useEffect(() => {
    const handlePostSaved = () => {
      console.log('[AdminNewsScreen] Post saved event received, refreshing news feed');
      setRefreshKey(k => k + 1);
    };

    const handlePostDeleted = () => {
      console.log('[AdminNewsScreen] Post deleted event received, refreshing news feed');
      setRefreshKey(k => k + 1);
    };

    const unregisterSaved = registerEventListener('post_saved', handlePostSaved);
    const unregisterDeleted = registerEventListener('post_deleted', handlePostDeleted);

    return () => {
      unregisterSaved();
      unregisterDeleted();
    };
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        console.log('DEBUG: Admin user ID:', user.id);
        
        const { data: club } = await supabase
          .from('clubs')
          .select('id')
          .eq('admin_id', user.id)
          .single();
          
        console.log('DEBUG: Club data from query:', club);
        
        if (!club) {
          console.warn('DEBUG: No club found for admin user:', user.id);
          return;
        }
        
        // Store the club ID
        console.log('DEBUG: Setting clubId to:', club.id);
        setClubId(club.id);
        
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

  const handleCreate = () => {
    navigation.navigate('PostEditor', {
      mode: 'create',
      availableTeams,
      isAdmin: true,
    });
  };

  const handleEdit = (post: Post) => {
    navigation.navigate('PostEditor', {
      mode: 'edit',
      post,
      availableTeams,
      isAdmin: true,
    });
  };

  return (
    <View style={styles.container}>
      {clubId ? (
        <>
          <NewsFeed
            key={refreshKey}
            filters={{ club_id: clubId }}
            onPressComments={handlePressComments}
            onEdit={handleEdit}
          />
          <TouchableOpacity style={styles.fab} onPress={handleCreate}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.centered}>
          <Text>{t('admin.news.loadingClubInfo')}</Text>
        </View>
      )}
      {loadingTeams && (
        <View style={{ position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' }}>
          <Text>{t('admin.news.loadingTeams')}</Text>
        </View>
      )}
      {selectedPost && (
        <CommentModal
          visible={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setRefreshKey(k => k + 1);
          }}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 