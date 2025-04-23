import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export const AdminHomeScreen = () => {
  const [clubName, setClubName] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');

  useEffect(() => {
    loadProfile();
  }, []);

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome back, {adminName}!</Text>
        <Text style={styles.clubName}>{clubName}</Text>
        
        <View style={styles.cardsContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Teams</Text>
              <Text style={styles.cardValue}>0</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Coaches</Text>
              <Text style={styles.cardValue}>0</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Players</Text>
              <Text style={styles.cardValue}>0</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Pending Payments</Text>
              <Text style={styles.cardValue}>0</Text>
            </Card.Content>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  clubName: {
    fontSize: 18,
    color: COLORS.grey[600],
    marginBottom: SPACING.xl,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -SPACING.sm,
  },
  card: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: SPACING.lg,
    backgroundColor: '#EEFBFF',
  },
  cardTitle: {
    fontSize: 16,
    color: COLORS.grey[600],
    marginBottom: SPACING.sm,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
}); 