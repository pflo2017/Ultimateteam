import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text, TextInput, Card } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';

type ParentManageScreenNavigationProp = NativeStackNavigationProp<ParentStackParamList>;

interface Child {
  id: string;
  full_name: string;
  birth_date: string;
  team_id: string;
  team_name: string;
  medical_visa_status: 'valid' | 'pending' | 'expired';
  medical_visa_issue_date?: string;
}

export const ParentManageScreen = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<ParentManageScreenNavigationProp>();

  useFocusEffect(
    useCallback(() => {
      console.log('ParentManageScreen focused - loading children');
      loadChildren();
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const loadChildren = async () => {
    try {
      setIsLoading(true);
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('No parent data found');

      const parent = JSON.parse(parentData);
      console.log('Parent data:', parent);
      
      // Use a simpler query with direct selection rather than nested selection
      const { data, error } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', parent.id)
        .eq('is_active', true);

      if (error) throw error;

      console.log('Loaded children count:', data ? data.length : 0);
      console.log('Loaded children data:', JSON.stringify(data, null, 2));

      if (!data || data.length === 0) {
        setChildren([]);
        setIsLoading(false);
        return;
      }

      // Fetch team names separately
      const teamIds = [...new Set(data.map(child => child.team_id))]; // Use Set to get unique team IDs
      console.log('Team IDs to fetch:', teamIds);
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        throw teamsError;
      }

      console.log('Teams data:', teamsData);

      // Map team names to children
      const teamMap = new Map();
      teamsData.forEach(team => {
        teamMap.set(team.id, team.name);
      });

      const formattedChildren = data.map(child => {
        const formatted = {
          ...child,
          team_name: teamMap.get(child.team_id) || 'No Team',
        };
        console.log('Formatted child:', formatted);
        return formatted;
      });

      console.log('Setting children state with:', formattedChildren.length, 'items');
      setChildren(formattedChildren);
    } catch (error) {
      console.error('Error loading children:', error);
      Alert.alert('Error', 'Failed to load children');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChild = () => {
    navigation.navigate('AddChild');
  };

  const handleEditChild = (childId: string) => {
    navigation.navigate('EditChild', { childId });
  };

  const handleDeleteChild = (childId: string) => {
    Alert.alert(
      "Delete Child",
      "Are you sure you want to delete this child? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await supabase
                .from('parent_children')
                .update({ is_active: false })
                .eq('id', childId);
                
              if (error) throw error;
              
              Alert.alert("Success", "Child deleted successfully");
              loadChildren();
            } catch (error) {
              console.error('Error deleting child:', error);
              Alert.alert("Error", "Failed to delete child");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getMedicalVisaColor = (status: 'valid' | 'pending' | 'expired') => {
    switch (status) {
      case 'valid':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'expired':
        return COLORS.error;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Children</Text>
          <Text style={styles.subtitle}>Manage your children's information</Text>
          {__DEV__ && (
            <Text style={styles.debugText}>
              State: {isLoading ? 'Loading...' : `Loaded (${children.length} children)`}
            </Text>
          )}
        </View>

        <Pressable 
          onPress={handleAddChild}
          style={styles.addButtonAdminConsistent}
        >
          <MaterialCommunityIcons 
            name="account-plus" 
            size={24} 
            color={COLORS.white}
          />
          <Text style={styles.addButtonText}>Add Child</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Loading children...</Text>
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="account-child" 
              size={48} 
              color={COLORS.grey[400]}
            />
            <Text style={styles.emptyStateText}>
              No children added yet. Add your first child to get started.
            </Text>
          </View>
        ) : (
          <View style={styles.childrenList}>
            {children.map(child => (
              <View
                key={child.id}
                style={styles.childCard}
              >
                <View style={styles.childHeader}>
                  <MaterialCommunityIcons 
                    name="account-circle" 
                    size={24} 
                    color={COLORS.primary}
                  />
                  <Text style={styles.childName}>{child.full_name}</Text>
                  <View style={styles.actionButtons}>
                    <Pressable 
                      style={styles.actionButton}
                      onPress={() => handleEditChild(child.id)}
                    >
                      <MaterialCommunityIcons 
                        name="pencil" 
                        size={18} 
                        color={COLORS.primary}
                      />
                    </Pressable>
                    <Pressable 
                      style={styles.actionButton}
                      onPress={() => handleDeleteChild(child.id)}
                    >
                      <MaterialCommunityIcons 
                        name="delete" 
                        size={18} 
                        color={COLORS.error}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.childInfo}>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons 
                      name="calendar" 
                      size={20} 
                      color={COLORS.primary}
                    />
                    <Text style={styles.infoText}>
                      {new Date(child.birth_date).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons 
                      name="account-group" 
                      size={20} 
                      color={COLORS.primary}
                    />
                    <Text style={styles.infoText}>{child.team_name}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons 
                      name="medical-bag" 
                      size={20} 
                      color={getMedicalVisaColor(child.medical_visa_status)}
                    />
                    <Text style={[styles.infoText, { color: getMedicalVisaColor(child.medical_visa_status) }]}>
                      {child.medical_visa_status.charAt(0).toUpperCase() + child.medical_visa_status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontFamily: 'Urbanist',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    fontFamily: 'Urbanist',
    letterSpacing: 0.2,
  },
  addButtonFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 58,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
    alignSelf: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  addButtonAdminConsistent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 48,
    width: '100%',
    alignSelf: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    textAlign: 'center',
    marginTop: SPACING.md,
    fontFamily: 'Urbanist',
  },
  childrenList: {
    gap: SPACING.md,
  },
  childCard: {
    backgroundColor: '#EEFBFF',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    justifyContent: 'space-between',
  },
  childName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Urbanist',
    flex: 1,
  },
  childInfo: {
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    fontFamily: 'Urbanist',
  },
  debugText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
    marginTop: 4,
    fontFamily: 'Urbanist',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.grey[200],
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignSelf: 'center',
  },
  debugButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[700],
    marginLeft: 4,
    fontFamily: 'Urbanist',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: 6,
    borderRadius: 100,
    backgroundColor: COLORS.grey[100],
  },
}); 