import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ParentTabParamList } from '../../types/navigation';
import { supabase } from '../../lib/supabase';

type ParentDashboardScreenNavigationProp = BottomTabNavigationProp<ParentTabParamList>;

export const ParentDashboardScreen = () => {
  const [parentName, setParentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<ParentDashboardScreenNavigationProp>();
  
  // Load parent data when the component mounts and when the screen comes into focus
  useEffect(() => {
    loadParentInfo();
  }, []);
  
  useFocusEffect(
    React.useCallback(() => {
      loadParentInfo();
      return () => {};
    }, [])
  );
  
  const loadParentInfo = async () => {
    try {
      setIsLoading(true);
      
      // First try to get data from AsyncStorage as a quick way to display something
      const storedParentData = await AsyncStorage.getItem('parent_data');
      let parentData = storedParentData ? JSON.parse(storedParentData) : null;
      
      if (parentData) {
        setParentName(parentData.name || '');
      }
      
      // Get the current auth session
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id;
      
      if (!userId) {
        console.error('No authenticated user found');
        setIsLoading(false);
        return;
      }
      
      // Try to get fresh parent data from the database using the auth user ID
      const { data: freshParentData, error } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Using maybeSingle instead of single to avoid errors
      
      if (error) {
        console.error('Error fetching parent data by user_id:', error);
        
        // If we couldn't find by user_id, try by email as a fallback
        const email = authData?.session?.user?.email;
        if (email) {
          const { data: emailParentData, error: emailError } = await supabase
            .from('parents')
            .select('*')
            .eq('email', email)
            .maybeSingle();
            
          if (!emailError && emailParentData) {
            // Found parent by email, update the user_id field
            const { error: updateError } = await supabase
              .from('parents')
              .update({ user_id: userId })
              .eq('id', emailParentData.id);
              
            if (updateError) {
              console.error('Error updating parent user_id:', updateError);
            } else {
              console.log('Updated parent record with auth user ID');
              // Update our local reference
              emailParentData.user_id = userId;
            }
            
            // Store the updated parent data
            await AsyncStorage.setItem('parent_data', JSON.stringify(emailParentData));
            setParentName(emailParentData.name || '');
            parentData = emailParentData;
          }
        }
      } else if (freshParentData) {
        // Update AsyncStorage with fresh data
        await AsyncStorage.setItem('parent_data', JSON.stringify(freshParentData));
        setParentName(freshParentData.name || '');
        parentData = freshParentData;
      }
      
      // If we still don't have parent data, something is wrong with the account
      if (!parentData) {
        console.error('No parent data found for this user');
        Alert.alert(
          'Account Issue',
          'There seems to be an issue with your account. Please contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error loading parent info:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = () => {
    setRefreshing(true);
    loadParentInfo();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {isLoading ? 'Loading...' : `Welcome, ${parentName || 'Parent'}`}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Stay connected with your child's sports journey
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        ) : (
        <View style={styles.dashboardContent}>
          <Text style={styles.sectionTitle}>Your Dashboard</Text>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('Events')}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('News')}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('Manage')}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('Payments')}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
        </View>
        )}
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
    minHeight: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl * 2,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.grey[600],
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