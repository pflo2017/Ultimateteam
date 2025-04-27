import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaterialCommunityIcons as IconType } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachTabParamList } from '../../navigation/CoachNavigator';
import Animated, { 
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Team {
  id: string;
  name: string;
  player_count: number;
}

interface RawTeam {
  team_id: string;
  team_name: string;
  player_count: number;
}

type CardType = 'teams' | 'players' | 'payments';

export const CoachDashboardScreen = () => {
  const [stats, setStats] = useState({
    teams: [] as Team[],
    totalPlayers: 0,
    pendingPayments: 0
  });
  const navigation = useNavigation<NativeStackNavigationProp<CoachTabParamList>>();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      console.log('=== Starting loadStats ===');
      
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      if (!storedCoachData) {
        console.log('No stored coach data found');
        return;
      }

      const coachData = JSON.parse(storedCoachData);
      console.log('Coach data from storage:', coachData);

      // Get teams using the get_coach_teams function
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });

      console.log('Teams query result:', {
        query: {
          coach_id: coachData.id,
          is_active: true
        },
        teams: teamsData,
        error: teamsError,
        errorMessage: teamsError?.message,
        errorDetails: teamsError?.details
      });

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return;
      }

      if (!teamsData || teamsData.length === 0) {
        console.log('No teams returned from query');
        setStats({
          teams: [],
          totalPlayers: 0,
          pendingPayments: 0
        });
        return;
      }

      console.log('Found teams:', teamsData);

      // Transform teams with player counts
      const transformedTeams = teamsData.map((team: { team_id: string; team_name: string; player_count?: number }) => ({
        id: team.team_id,
        name: team.team_name,
        player_count: team.player_count || 0
      }));

      console.log('Transformed teams:', transformedTeams);

      // Calculate total players
      const totalPlayers = transformedTeams.reduce((sum: number, team: Team) => sum + team.player_count, 0);

      console.log('Setting stats:', {
        teams: transformedTeams,
        totalPlayers,
        pendingPayments: 0
      });

      setStats({
        teams: transformedTeams,
        totalPlayers,
        pendingPayments: 0
      });
    } catch (error) {
      console.error('Error in loadStats:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
    }
  };

  const handleCardPress = (screen: keyof CoachTabParamList, type: CardType) => {
    navigation.navigate(screen);
  };

  const renderCard = (
    title: string, 
    value: number, 
    subtitle: string, 
    icon: keyof typeof IconType.glyphMap, 
    screen: keyof CoachTabParamList,
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
            onPress={() => handleCardPress(screen, type)}
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
            stats.totalPlayers,
            'In your teams',
            'run',
            'CoachDashboard',
            'players',
            200
          )}
          {renderCard(
            'Your Teams',
            stats.teams.length,
            'Your teams',
            'account-multiple',
            'Manage',
            'teams',
            400
          )}
          {renderCard(
            'Payment Status',
            stats.pendingPayments,
            'Pending payments',
            'cash-multiple',
            'Payments',
            'payments',
            600
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