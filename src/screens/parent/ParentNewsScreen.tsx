import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { NewsFeed } from '../../components/news/NewsFeed';
import { Post } from '../../components/news/types';
import { CommentModal } from '../../components/news/CommentModal';
import { COLORS } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// Real onSubmitComment function
const onSubmitComment = async (postId: string, content: string): Promise<void> => {
  console.log('onSubmitComment called with postId:', postId, 'content:', content);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const storedParentData = await AsyncStorage.getItem('parent_data');
  if (!storedParentData) throw new Error('No parent data in storage');
  const parentData = JSON.parse(storedParentData);
  const payload = {
    post_id: postId,
    author_id: user.id,
    author_name: parentData.name,
    author_role: 'parent',
    content,
    is_active: true,
  };
  console.log('Inserting comment with payload:', payload);
  const { data, error } = await supabase
    .from('post_comments')
    .insert([payload])
    .select('*');
  console.log('Supabase insert result (data):', data);
  console.log('Supabase insert result (error):', error);
  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
};

export const ParentNewsScreen = () => {
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    const fetchParentInfo = async () => {
      try {
        const parentData = await AsyncStorage.getItem('parent_data');
        if (!parentData) return;
        const parent = JSON.parse(parentData);
        
        // Set the club_id if available
        if (parent.club_id) {
          setClubId(parent.club_id);
        }
        
        // Get all children for this parent
        const { data: children, error } = await supabase
          .from('parent_children')
          .select('team_id')
          .eq('parent_id', parent.id)
          .eq('is_active', true);
        if (error) return;
        const ids = Array.from(new Set((children || []).map((c: any) => c.team_id).filter(Boolean)));
        setTeamIds(ids);
        console.log('Parent teamIds:', ids);
        
        // If no club_id in parent data, try to get it from team
        if (!parent.club_id && ids.length > 0) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('club_id')
            .eq('id', ids[0])
            .single();
          
          if (teamData?.club_id) {
            setClubId(teamData.club_id);
          }
        }
      } catch (err) {
        setTeamIds([]);
      }
    };
    fetchParentInfo();
  }, []);

  const handlePressComments = (post: Post) => {
    setSelectedPost(post);
    setShowCommentModal(true);
  };

  console.log('Rendering NewsFeed with teamIds:', teamIds, 'clubId:', clubId);
  return (
    <View style={styles.container}>
      {clubId ? (
        <NewsFeed 
          key={refreshKey} 
          filters={{ team_ids: teamIds, club_id: clubId }} 
          onPressComments={handlePressComments} 
        />
      ) : (
        <View style={styles.centered}>
          <Text>Loading club information...</Text>
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
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 