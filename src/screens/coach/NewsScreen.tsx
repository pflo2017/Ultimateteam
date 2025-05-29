import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { NewsFeed } from '../../components/news/NewsFeed';
import { Post } from '../../components/news/types';
import { PostCreationModal } from '../../components/news/PostCreationModal';
import { CommentModal } from '../../components/news/CommentModal';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachStackParamList } from '../../navigation/CoachNavigator';

// Mocked available teams for coach
const MOCK_TEAMS = [
  { id: 't2', name: 'Grupa 2018-2019' },
  { id: 't3', name: 'Grupa 2020-2021' },
];

// Real createPost function
export const createPost = async (data: { title?: string; content: string; is_general: boolean; team_ids: string[] }) => {
  const { title, content, is_general, team_ids } = data;
  try {
    // Always get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch coach data from AsyncStorage
    const storedCoachData = await AsyncStorage.getItem('coach_data');
    if (!storedCoachData) throw new Error('No coach data in storage');
    const coachData = JSON.parse(storedCoachData);
    if (!coachData.club_id) throw new Error('Coach club_id is missing');

    // Insert post using the authenticated user's id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert([
        {
          title: title || null,
          content,
          author_id: user.id, // Use the authenticated user's id
          author_name: coachData.name,
          author_role: 'coach',
          is_general,
          club_id: coachData.club_id,
        },
      ])
      .select()
      .single();

    if (postError) {
      console.error('Post insert error:', postError);
      throw postError;
    }

    console.log('Post created successfully:', post);

    // If not general, insert into post_teams
    if (!is_general && team_ids.length > 0) {
      const postTeams = team_ids.map(team_id => ({ post_id: post.id, team_id }));
      const { error: ptError } = await supabase
        .from('post_teams')
        .insert(postTeams);
      if (ptError) {
        console.error('Error inserting post_teams:', ptError);
        throw ptError;
      }
    }

    return post;
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
  const storedCoachData = await AsyncStorage.getItem('coach_data');
  if (!storedCoachData) throw new Error('No coach data in storage');
  const coachData = JSON.parse(storedCoachData);
  const payload = {
    post_id: postId,
    author_id: user.id,
    author_name: coachData.name,
    author_role: 'coach',
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

export const CoachNewsScreen = () => {
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const navigation = useNavigation<NativeStackNavigationProp<CoachStackParamList>>();

  useEffect(() => {
    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        // Use the same logic as Schedule/Create Activity: get coachData from AsyncStorage
        const storedCoachData = await AsyncStorage.getItem('coach_data');
        if (!storedCoachData) {
          setAvailableTeams([]);
          setLoadingTeams(false);
          return;
        }
        const coachData = JSON.parse(storedCoachData);
        // Use the get_coach_teams RPC to get teams
        const { data: teamsData, error } = await supabase
          .rpc('get_coach_teams', { p_coach_id: coachData.id });
        if (error) {
          console.error('Error fetching teams:', error);
          setAvailableTeams([]);
        } else {
          const transformedTeams = (teamsData || []).map((team: { team_id: string; team_name: string }) => ({
            id: team.team_id,
            name: team.team_name
          }));
          setAvailableTeams(transformedTeams);
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
      isAdmin: false,
      onSave: () => setRefreshKey(k => k + 1),
    });
  };

  const handleEdit = (post: Post) => {
    navigation.navigate('PostEditor', {
      mode: 'edit',
      post,
      availableTeams,
      isAdmin: false,
      onSave: () => setRefreshKey(k => k + 1),
    });
  };

  return (
    <View style={styles.container}>
      <NewsFeed
        key={refreshKey}
        filters={{ team_ids: availableTeams.map(t => t.id) }}
        onPressComments={handlePressComments}
        onEdit={handleEdit}
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      {loadingTeams && (
        <View style={{ position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' }}>
          <Text>Loading teams...</Text>
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
    backgroundColor: COLORS.white,
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