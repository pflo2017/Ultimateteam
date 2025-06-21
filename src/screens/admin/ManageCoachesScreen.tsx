import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { Text, ActivityIndicator, Card, Snackbar, IconButton, Divider } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import { supabase } from '../../lib/supabase';

interface Coach {
  id: string;
  name: string;
  phone_number: string;
  created_at: string;
  is_active: boolean;
  user_id?: string;
  teams: {
    id: string;
    name: string;
  }[];
}

interface ManageCoachesScreenProps {
  coaches: Coach[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  onCopyAccessCode: (code: string) => void;
}

export const ManageCoachesScreen: React.FC<ManageCoachesScreenProps> = ({
  coaches,
  isLoading,
  onRefresh,
  refreshing,
  onCopyAccessCode
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Filter coaches to show:
  // 1. Active coaches (is_active=true)
  // 2. Pending registration coaches (no user_id) regardless of is_active status
  const filteredCoaches = coaches.filter(coach => {
    // For debugging - check each coach's status
    console.log(`Coach ${coach.id} (${coach.name}): is_active=${coach.is_active}, user_id=${coach.user_id ? 'set' : 'undefined'}`);
    
    // Show active coaches OR pending registration coaches (no user_id)
    return coach.is_active === true || !coach.user_id;
  });

  const renderCoachCard = (coach: Coach) => (
    <Card 
      key={coach.id} 
      style={{
        marginBottom: SPACING.md,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: coach.is_active ? COLORS.grey[200] : COLORS.warning,
        overflow: 'hidden'
      }}
      mode="outlined"
    >
      <Card.Content style={{ padding: SPACING.md }}>
        {/* Coach Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.md,
          paddingTop: SPACING.sm
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 3
          }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: coach.is_active ? COLORS.primary + '15' : COLORS.warning + '30',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: SPACING.md
            }}>
              <MaterialCommunityIcons 
                name="account-tie" 
                size={28} 
                color={coach.is_active ? COLORS.primary : COLORS.warning} 
              />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text 
                style={{
                  fontSize: FONT_SIZES.lg,
                  fontWeight: '700',
                  color: COLORS.text,
                  marginBottom: 2
                }}
                numberOfLines={1}
              >
                {coach.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text 
                  style={{
                    fontSize: FONT_SIZES.sm,
                    color: COLORS.grey[600],
                    marginRight: 4
                  }}
                  numberOfLines={1}
                >
                  Coach
                </Text>
                
                {!coach.is_active && (
                  <View style={{
                    backgroundColor: COLORS.warning + '20',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4
                  }}>
                    <Text style={{
                      fontSize: FONT_SIZES.xs,
                      color: COLORS.warning,
                      fontWeight: '600'
                    }}>
                      Pending Registration
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          <IconButton
            icon="pencil"
            size={20}
            iconColor={COLORS.primary}
            style={{
              backgroundColor: COLORS.primary + '15',
              margin: 0
            }}
            onPress={() => navigation.navigate('EditCoach', { coachId: coach.id })}
          />
        </View>
        
        <Divider style={{ 
          height: 1,
          backgroundColor: COLORS.grey[200],
          marginBottom: SPACING.md
        }} />
        
        {/* Info Section */}
        <View style={{
          gap: SPACING.md,
          marginBottom: SPACING.md
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm
          }}>
            <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
            <Text style={{
              fontSize: FONT_SIZES.sm,
              color: COLORS.grey[600],
            }}>
              Phone: <Text style={{
                fontWeight: '600',
                color: COLORS.text
              }}>{coach.phone_number}</Text>
            </Text>
          </View>
        </View>
        
        {/* Teams Section */}
        <View>
          <Text style={{
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
            color: COLORS.text,
            marginBottom: SPACING.xs
          }}>
            Assigned Teams:
          </Text>
          
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: SPACING.xs
          }}>
            {coach.teams.length > 0 ? (
              coach.teams.map(team => (
                <View key={team.id} style={{
                  backgroundColor: COLORS.primary,
                  paddingHorizontal: SPACING.sm,
                  paddingVertical: SPACING.xs,
                  borderRadius: 100
                }}>
                  <Text style={{
                    color: COLORS.white,
                    fontSize: FONT_SIZES.xs,
                    fontWeight: '500'
                  }}>{team.name}</Text>
                </View>
              ))
            ) : (
              <Text style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.grey[400],
                fontStyle: 'italic'
              }}>No teams assigned</Text>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionTitle}>Coaches</Text>
            <Text style={styles.totalCount}>Total: {coaches.length} coaches</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddCoach')}
          >
            <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add Coach</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coach"
            placeholderTextColor={COLORS.grey[400]}
          />
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {!filteredCoaches?.length ? (
            <Text style={styles.emptyText}>No coaches found</Text>
          ) : (
            filteredCoaches.map(renderCoachCard)
          )}
        </ScrollView>

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={3000}
        >
          {snackbarMessage}
        </Snackbar>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: 14,
    color: COLORS.grey[600],
    marginTop: SPACING.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  addButtonText: {
    color: COLORS.white,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: COLORS.text,
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: SPACING.xl * 4,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 