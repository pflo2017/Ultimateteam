import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type ParentProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ParentProfileScreen = () => {
  const [parentData, setParentData] = useState<any>(null);
  const navigation = useNavigation<ParentProfileScreenNavigationProp>();

  useEffect(() => {
    const loadParentData = async () => {
      try {
        // Get parent ID from AsyncStorage
        const data = await AsyncStorage.getItem('parent_data');
        if (!data) {
          console.error('No parent data found');
          return;
        }
        
        const parentInfo = JSON.parse(data);
        console.log('Loading parent profile data for:', parentInfo.id);
        
        // Get fresh data directly from the database
        const { data: freshData, error } = await supabase
          .from('parents')
          .select('*')
          .eq('id', parentInfo.id)
          .single();
          
        if (error) {
          console.error('Error fetching fresh data:', error);
          // Fall back to stored data
          setParentData(parentInfo);
        } else if (freshData) {
          console.log('Fresh data from database:', freshData);
          
          // Update AsyncStorage with fresh data
          await AsyncStorage.setItem('parent_data', JSON.stringify(freshData));
          
          // Update UI
          setParentData(freshData);
        }
      } catch (error) {
        console.error('Error loading parent data:', error);
      }
    };

    loadParentData();
    
    // Setup focus listener to reload data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadParentData);
    return unsubscribe;
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('parent_data');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons 
          name="arrow-left" 
          size={24} 
          color={COLORS.primary}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
        <Text variant="headlineMedium" style={styles.title}>Profile</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Manage your account settings
        </Text>
      </View>

      <View style={styles.content}>
        {parentData && (
          <>
            <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.label}>Name</Text>
              <Text variant="bodyLarge" style={styles.value}>{parentData.name}</Text>
              
              <Text variant="titleMedium" style={styles.label}>Phone Number</Text>
              <Text variant="bodyLarge" style={styles.value}>{parentData.phone_number}</Text>
            </View>
          </>
        )}

        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          contentStyle={styles.buttonContent}
          buttonColor={COLORS.error}
        >
          Logout
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  label: {
    color: COLORS.grey[600],
    marginBottom: 4,
    marginTop: 16,
  },
  value: {
    color: COLORS.text,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 'auto',
    borderRadius: 30,
  },
  buttonContent: {
    height: 56,
  },
}); 