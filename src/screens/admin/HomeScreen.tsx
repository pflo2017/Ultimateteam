import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { getActivitiesByDateRange, Activity } from '../../services/activitiesService';
import { format, addDays } from 'date-fns';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AdminStackParamList, AdminTabParamList } from '../../types/navigation';
import { EventCard } from '../../components/Schedule/ScheduleCalendar';

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
  const navigation = useNavigation<AdminNavigationProp>();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadProfile();
      loadUpcomingActivities();
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

  const handleActivityPress = (activity: Activity) => {
    navigation.navigate('ActivityDetails', { activityId: activity.id });
  };

  const handleSeeAll = () => {
    navigation.navigate('Schedule');
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
        {activities.length > 3 && (
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllActionWrapper} activeOpacity={0.7}>
            <Text style={styles.seeAllActionText}>See all &gt;</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Welcome, {adminName}</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Manage and stay connected with your club
        </Text>
      </View>
      {/* Carousel at the top */}
      {renderCarousel()}
    </View>
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
    justifyContent: 'flex-start',
    paddingLeft: SPACING.lg,
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
}); 