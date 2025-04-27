import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaterialCommunityIcons as IconType } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import Animated, { 
  FadeInUp,
  useAnimatedStyle, 
  withSpring,
  withTiming,
  useSharedValue,
  WithSpringConfig,
} from 'react-native-reanimated';

type CardType = 'teams' | 'coaches' | 'players' | 'payments';

type ScreenType = keyof AdminStackParamList | 'Payments';

export const AdminHomeScreen = () => {
  const [clubName, setClubName] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [stats, setStats] = useState({
    teams: 0,
    coaches: 0,
    players: 0,
    pendingPayments: 0
  });
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadProfile();
      loadStats();
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

  const loadStats = async () => {
    try {
      console.log('Loading stats...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }

      // Get club ID
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('admin_id', user.id)
        .single();

      if (!club) {
        console.error('No club found');
        return;
      }

      console.log('Loading stats for club:', club.id);

      // Get teams data and count
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('club_id', club.id)
        .eq('is_active', true);

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return;
      }

      const teamsCount = teamsData?.length || 0;
      console.log('Active teams data:', teamsData);
      console.log('Active teams count:', teamsCount);

      // Get coaches count
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('id')
        .eq('club_id', club.id)
        .eq('is_active', true);

      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
        return;
      }

      const coachesCount = coachesData?.length || 0;
      console.log('Active coaches count:', coachesCount);

      // Get players count
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id')
        .eq('club_id', club.id)
        .eq('is_active', true);

      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }

      const playersCount = playersData?.length || 0;
      console.log('Active players count:', playersCount);

      console.log('Setting stats:', {
        teams: teamsCount,
        coaches: coachesCount,
        players: playersCount
      });

      setStats({
        teams: teamsCount,
        coaches: coachesCount,
        players: playersCount,
        pendingPayments: 0 // We'll implement this later
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCardPress = (screen: ScreenType, type: CardType) => {
    if (screen === 'Manage') {
      navigation.navigate('Manage', { activeTab: type });
    } else if (screen === 'Payments') {
      // Handle payments navigation when implemented
      console.log('Payments screen not implemented yet');
    } else if (screen === 'TeamDetails') {
      // TeamDetails requires teamId parameter
      console.log('TeamDetails navigation not implemented here');
    } else {
      // @ts-ignore - We know these screens don't require params
      navigation.navigate(screen);
    }
  };

  const renderCard = (
    title: string, 
    value: number, 
    subtitle: string, 
    icon: keyof typeof IconType.glyphMap, 
    screen: ScreenType,
    type: CardType,
    delay: number
  ) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }]
    }));

    const onPressIn = () => {
      scale.value = withSpring(0.95, {
        damping: 15,
        stiffness: 100,
      } as WithSpringConfig);
    };

    const onPressOut = () => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      } as WithSpringConfig);
    };

    return (
      <Animated.View 
        entering={FadeInUp.delay(delay).duration(1000).springify()}
        style={styles.cardWrapper}
      >
        <Animated.View style={animatedStyle}>
          <TouchableRipple
            onPress={() => handleCardPress(screen as ScreenType, type)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={styles.touchable}
            borderless
          >
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <MaterialCommunityIcons 
                  name={icon}
                  size={24} 
                  color={COLORS.white}
                  style={styles.cardIcon}
                />
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardValue}>{value}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardSubtitle}>{subtitle}</Text>
                  <MaterialCommunityIcons 
                    name="chevron-right" 
                    size={20} 
                    color={COLORS.white}
                  />
                </View>
              </Card.Content>
            </Card>
          </TouchableRipple>
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.cardsContainer}>
          {renderCard(
            'Total Players',
            stats.players,
            'Registered in your academy',
            'run',
            'Manage',
            'players',
            200
          )}
          {renderCard(
            'Total Teams',
            stats.teams,
            'Active in your academy',
            'account-multiple',
            'Manage',
            'teams',
            400
          )}
          {renderCard(
            'Total Coaches',
            stats.coaches,
            'Active in your academy',
            'account-tie',
            'Manage',
            'coaches',
            600
          )}
          {renderCard(
            'Payment status',
            stats.pendingPayments,
            'Pending payments',
            'credit-card-outline',
            'Payments',
            'payments',
            800
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 120 : 100, // Account for header + status bar
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
    marginBottom: SPACING.lg,
    borderRadius: 16,
  },
  touchable: {
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#0CC1EC',
    elevation: 2,
    borderRadius: 16,
  },
  cardContent: {
    padding: SPACING.lg,
  },
  cardIcon: {
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    flex: 1,
    marginRight: SPACING.sm,
    height: 40,
    lineHeight: 20,
  },
}); 