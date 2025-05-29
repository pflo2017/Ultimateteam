import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { updatePost, deletePost } from '../../components/news/postsService';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPost as createCoachPost } from '../../screens/coach/NewsScreen';
import { ScrollView as RNScrollView } from 'react-native';
import { Chip } from 'react-native-paper';

type PostEditorParams = {
  mode: 'create' | 'edit';
  post?: any;
  availableTeams?: any[];
  isAdmin?: boolean;
  onSave?: () => void;
};

export const PostEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, PostEditorParams>, string>>();
  const { mode = 'create', post = {}, availableTeams = [], isAdmin = false } = route.params || {};

  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [selectedTeams, setSelectedTeams] = useState<string[]>(post?.teams?.map((t: any) => t.id) || (isAdmin ? [] : (availableTeams.length === 1 ? [availableTeams[0].id] : [])));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(post?.title || '');
    setContent(post?.content || '');
    setSelectedTeams(post?.teams?.map((t: any) => t.id) || (isAdmin ? [] : (availableTeams.length === 1 ? [availableTeams[0].id] : [])));
  }, [post?.id, availableTeams, isAdmin]);

  const handleSave = async () => {
    setError(null);
    if (!content.trim()) {
      setError('Content is required.');
      return;
    }
    if (!isAdmin && selectedTeams.length === 0) {
      setError('Please select at least one team.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'edit') {
        const { error } = await updatePost(post.id, { title, content });
        if (error) throw error;
      } else {
        if (isAdmin) {
          // Admin create logic
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          // Get admin name and club_id
          const { data: profile, error: profileError } = await supabase
            .from('admin_profiles')
            .select('admin_name')
            .eq('user_id', user.id)
            .single();
          if (profileError || !profile) throw new Error('Admin profile not found');
          const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('id')
            .eq('admin_id', user.id)
            .single();
          if (clubError || !club) throw new Error('Club not found');
          // Insert post
          const { data: postData, error: postError } = await supabase
            .from('posts')
            .insert([
              {
                title: title || null,
                content,
                author_id: user.id,
                author_name: profile.admin_name,
                author_role: 'admin',
                is_general: selectedTeams.length === 0,
                club_id: club.id,
              },
            ])
            .select()
            .single();
          if (postError) throw postError;
          // If teams are selected, insert into post_teams
          if (selectedTeams.length > 0) {
            const postTeams = selectedTeams.map(team_id => ({ post_id: postData.id, team_id }));
            const { error: ptError } = await supabase
              .from('post_teams')
              .insert(postTeams);
            if (ptError) throw ptError;
          }
        } else {
          // Coach create logic
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          // Only allow posting to coach's teams
          const { error } = await createCoachPost({
            title,
            content,
            is_general: false,
            team_ids: selectedTeams,
          });
          if (error) throw error;
        }
      }
      if (route.params && route.params.onSave) route.params.onSave();
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Failed to save post');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await deletePost(post.id);
            setLoading(false);
            if (error) {
              Alert.alert('Error', 'Failed to delete post.');
            } else {
              if (route.params && route.params.onSave) route.params.onSave();
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Safe Area Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{mode === 'edit' ? 'Edit Post' : 'New Post'}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {/* Team Chips for Admin or Coach */}
          {isAdmin ? (
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <Chip
                selected={selectedTeams.length === 0}
                onPress={() => setSelectedTeams([])}
                style={{ marginRight: 8 }}
                mode="outlined"
              >
                All Teams
              </Chip>
              {availableTeams.map(team => (
                <Chip
                  key={team.id}
                  selected={selectedTeams.includes(team.id)}
                  onPress={() => {
                    if (selectedTeams.includes(team.id)) {
                      setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                    } else {
                      setSelectedTeams([...selectedTeams, team.id]);
                    }
                  }}
                  style={{ marginRight: 8 }}
                  mode="outlined"
                >
                  {team.name}
                </Chip>
              ))}
            </RNScrollView>
          ) : (
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {availableTeams.map(team => (
                <Chip
                  key={team.id}
                  selected={selectedTeams.includes(team.id)}
                  onPress={() => {
                    if (selectedTeams.includes(team.id)) {
                      setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                    } else {
                      setSelectedTeams([...selectedTeams, team.id]);
                    }
                  }}
                  style={{ marginRight: 8 }}
                  mode="outlined"
                >
                  {team.name}
                </Chip>
              ))}
            </RNScrollView>
          )}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            editable={!loading}
            placeholder="Title (optional)"
            returnKeyType="next"
          />
          <Text style={styles.label}>Content</Text>
          <TextInput
            style={[styles.input, { minHeight: 100 }]}
            value={content}
            onChangeText={setContent}
            editable={!loading}
            multiline
            placeholder="Share with the team..."
            returnKeyType="default"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            <Text style={styles.saveText}>{mode === 'edit' ? 'Save' : 'Post'}</Text>
          </TouchableOpacity>
          {mode === 'edit' && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
              <Text style={styles.deleteBtnText}>Delete Post</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  form: {
    padding: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  error: {
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
  deleteBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
}); 