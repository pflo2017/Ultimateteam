import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { getActivitiesByDateRange, Activity } from '../../services/activitiesService';
import { format, addDays } from 'date-fns';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AdminStackParamList, AdminTabParamList } from '../../types/navigation';
import { EventCard } from '../../components/Schedule/ScheduleCalendar';
import { Post } from '../../components/news/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Define a composite navigation type that can access both stack and tab navigators
// (kept for navigation to details and schedule)
type AdminNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AdminStackParamList>,
  BottomTabNavigationProp<AdminTabParamList>
>;

export const AdminHomeScreen = () => {
  const [clubName, setClubName] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [latestPost, setLatestPost] = useState<Post | null>(null);
  const navigation = useNavigation<AdminNavigationProp>();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadProfile();
      loadUpcomingActivities();
      loadLatestPost();
    }
  }, [isFocused]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('club_name, admin_name')
        .eq('user_id', user.id)
        .single();
      if (profile) {
        setClubName(profile.club_name);
        setAdminName(profile.admin_name);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadUpcomingActivities = async () => {
    try {
      const today = new Date();
      const sevenDaysLater = addDays(today, 7);
      const { data, error } = await getActivitiesByDateRange(
        today.toISOString(),
        sevenDaysLater.toISOString()
      );
      if (error) throw error;
      if (data) {
        // Sort by start_time ascending
        const sorted = [...data].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        setActivities(sorted);
      }
    } catch (error) {
      console.error('Error loading upcoming activities:', error);
    }
  };

  const loadLatestPost = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get admin's club
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();
      if (!club) return;

      // Fetch the latest post for this club
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          id, title, content, author_id, author_name, author_role, created_at, is_general, club_id,
          post_teams:post_teams ( team_id, team:team_id ( id, name ) )
        `)
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (posts) {
        // Format the post to match the Post type
        const formattedPost: Post = {
          id: posts.id,
          title: posts.title,
          content: posts.content,
          author_id: posts.author_id,
          author_name: posts.author_name,
          author_role: posts.author_role,
          created_at: posts.created_at,
          teams: posts.post_teams?.map((pt: any) => pt.team) || [],
        };
        setLatestPost(formattedPost);
      }
    } catch (error) {
      console.error('Error loading latest post:', error);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    navigation.navigate('ActivityDetails', { activityId: activity.id });
  };

  const handleSeeAll = () => {
    navigation.navigate('Schedule');
  };

  const handlePostPress = () => {
    navigation.navigate('News');
  };

  // Carousel render
  const renderCarousel = () => {
    if (activities.length === 0) {
      return (
        <View style={styles.emptyCarousel}>
          <Text style={styles.emptyText}>No upcoming activities in the next 7 days.</Text>
        </View>
      );
    }
    return (
      <>
        <View style={styles.divider} />
        <View style={styles.carouselHeaderRow}>
          <Text style={styles.carouselTitle}>Future activities</Text>
          {activities.length > 3 && (
            <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllButton} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all &gt;</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.carouselContainer}>
          <FlatList
            data={activities.slice(0, 3)}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.carouselCardWrapper}
                onPress={() => handleActivityPress(item)}
                activeOpacity={0.85}
              >
                <EventCard activity={item} />
              </TouchableOpacity>
            )}
          />
        </View>
      </>
    );
  };

  const renderLatestPost = () => {
    if (!latestPost) {
      return (
        <View style={styles.emptyPost}>
          <Text style={styles.emptyText}>No recent posts.</Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.divider} />
        <View style={styles.postHeaderRow}>
          <Text style={styles.postTitle}>Latest Post</Text>
          <TouchableOpacity onPress={handlePostPress} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See all &gt;</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.postCard}
          onPress={handlePostPress}
          activeOpacity={0.7}
        >
          <View style={styles.postHeader}>
            <View style={styles.postAuthor}>
              <MaterialCommunityIcons 
                name={latestPost.author_role === 'admin' ? 'shield-account' : 'account'} 
                size={24} 
                color={COLORS.primary} 
              />
              <View style={styles.postAuthorInfo}>
                <Text style={styles.postAuthorName}>{latestPost.author_name}</Text>
                <Text style={styles.postDate}>
                  {new Date(latestPost.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
          {latestPost.title && (
            <Text style={styles.postTitle} numberOfLines={1}>
              {latestPost.title}
            </Text>
          )}
          <Text style={styles.postContent} numberOfLines={3}>
            {latestPost.content}
          </Text>
          {latestPost.teams && latestPost.teams.length > 0 && (
            <View style={styles.teamsRow}>
              {latestPost.teams.map(team => (
                <View key={team.id} style={styles.teamBadge}>
                  <Text style={styles.teamText}>{team.name}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Welcome, {adminName}</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Manage and stay connected with your club
        </Text>
      </View>
      {/* Carousel at the top */}
      {renderCarousel()}
      {/* Latest post section */}
      {renderLatestPost()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.lg,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
    fontSize: 22,
  },
  subtitle: {
    color: COLORS.grey[600],
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grey[200],
    marginHorizontal: SPACING.lg,
    marginBottom: 16,
  },
  carouselHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: 16,
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  carouselContainer: {
    paddingLeft: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselCardWrapper: {
    marginRight: SPACING.md,
    width: 280,
  },
  seeAllActionWrapper: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  seeAllActionText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyCarousel: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.grey[500],
    fontSize: 16,
  },
  emptyPost: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: 16,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAllButton: {
    padding: 4,
  },
  seeAllText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  postCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.button,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthorInfo: {
    marginLeft: SPACING.sm,
  },
  postAuthorName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: COLORS.text,
  },
  postDate: {
    fontSize: 12,
    color: COLORS.grey[600],
  },
  postContent: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  teamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
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
    fontSize: 12,
  },
}); 