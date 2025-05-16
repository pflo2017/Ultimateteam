import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export const ParentDashboardScreen = () => {
  const [parentName, setParentName] = useState('');
  
  useFocusEffect(
    React.useCallback(() => {
      loadParentInfo();
      return () => {};
    }, [])
  );
  
  const loadParentInfo = async () => {
    try {
      const storedParentData = await AsyncStorage.getItem('parent_data');
      if (storedParentData) {
        const parentData = JSON.parse(storedParentData);
        setParentName(parentData.name);
      }
    } catch (error) {
      console.error('Error loading parent info:', error);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Welcome, {parentName}</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Stay connected with your child's sports journey
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.dashboardContent}>
          <Text style={styles.sectionTitle}>Your Dashboard</Text>
          
          <Card style={styles.dashboardCard}>
            <Card.Content>
              <View style={styles.dashboardCardContent}>
                <MaterialCommunityIcons name="calendar-month" size={40} color={COLORS.primary} />
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>Upcoming Events</Text>
                  <Text style={styles.cardDescription}>
                    View your child's upcoming matches and training sessions
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
          
          <Card style={styles.dashboardCard}>
            <Card.Content>
              <View style={styles.dashboardCardContent}>
                <MaterialCommunityIcons name="clipboard-text" size={40} color={COLORS.primary} />
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>Team News</Text>
                  <Text style={styles.cardDescription}>
                    Stay updated with the latest team announcements and news
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
          
          <Card style={styles.dashboardCard}>
            <Card.Content>
              <View style={styles.dashboardCardContent}>
                <MaterialCommunityIcons name="account-group" size={40} color={COLORS.primary} />
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>My Children</Text>
                  <Text style={styles.cardDescription}>
                    Manage your children's information and registrations
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
          
          <Card style={styles.dashboardCard}>
            <Card.Content>
              <View style={styles.dashboardCardContent}>
                <MaterialCommunityIcons name="cash-multiple" size={40} color={COLORS.primary} />
                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>Payments</Text>
                  <Text style={styles.cardDescription}>
                    View payment history and status for your children
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.xl,
    backgroundColor: COLORS.primary,
  },
  title: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  dashboardContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  dashboardCard: {
    marginBottom: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  dashboardCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
}); 