import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, TouchableOpacity, Platform } from 'react-native';
import { Text, Card, Divider, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParentStackParamList } from '../../types/navigation';
import { useTranslation } from 'react-i18next';

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

interface Coach {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
}

interface Team {
  id: string;
  name: string;
  access_code: string;
  coaches: Coach[];
  players: {id: string; name: string}[];
}

// Define type for the tab selection
type TabType = 'children' | 'team';

// Add interface for the nested coach data returned from Supabase
interface TeamCoachResponse {
  coach: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

// Add this interface to properly type the nested coach data
interface CoachTeamRelation {
  coach_id: string;
  coaches: {
    id: string;
    name: string;
    phone_number: string;
  };
}

export const ParentManageScreen = () => {
  const [activeTab, setActiveTab] = useState<TabType>('children');
  const [children, setChildren] = useState<Child[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const navigation = useNavigation<ParentManageScreenNavigationProp>();
  const { t } = useTranslation();
  
  useFocusEffect(
    useCallback(() => {
      console.log('ParentManageScreen focused');
      if (activeTab === 'children') {
        loadChildren();
      } else {
        loadTeamsInfo();
      }
      return () => {
        // Cleanup if needed
      };
    }, [activeTab])
  );

  const loadChildren = async () => {
    try {
      setIsLoading(true);
      // Clear children list first to avoid showing stale data
      setChildren([]);
      
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
      Alert.alert(t('parent.manage.error'), t('parent.manage.failedToLoadChildren'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamsInfo = async () => {
    try {
      setIsLoading(true);
      console.log('Starting to load teams info');
      
      const parentData = await AsyncStorage.getItem('parent_data');
      if (!parentData) throw new Error('No parent data found');

      const parent = JSON.parse(parentData);
      console.log('Parent data loaded:', parent.id);
      
      // First get the parent's children and their team IDs
      const { data: childrenData, error: childrenError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', parent.id)
        .eq('is_active', true);

      if (childrenError) throw childrenError;
      
      console.log('Children data loaded:', childrenData?.length || 0);
      
      if (!childrenData || childrenData.length === 0) {
        setTeams([]);
        setIsLoading(false);
        return;
      }
      
      // Get unique team IDs
      const teamIds = [...new Set(childrenData.map(child => child.team_id))];
      console.log('Unique team IDs:', teamIds);
      
      // Get all coaches - we'll match them with teams later
      const { data: allCoaches, error: coachesError } = await supabase
        .from('coaches')
        .select('id, name, phone_number')
        .eq('is_active', true);
        
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError);
      }
      
      console.log(`Loaded ${allCoaches?.length || 0} coaches`);
      
      // Create a map of coaches for easy lookup
      const coachesMap = new Map();
      if (allCoaches) {
        allCoaches.forEach(coach => {
          coachesMap.set(coach.id, coach);
        });
      }
      
      // Fetch full team details for each team ID
      const teamsWithDetails: Team[] = [];
      
      for (const teamId of teamIds) {
        try {
          console.log(`Processing team ${teamId}`);
          
          // Get team details including coach_id
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('id, name, access_code, coach_id')
            .eq('id', teamId)
            .single();
            
          if (teamError) {
            console.error(`Error fetching team ${teamId} details:`, teamError);
            continue;
          }
          
          console.log(`Team ${teamId} details loaded:`, teamData);
          
          // Find the coach for this team if coach_id exists
          const teamCoaches: Coach[] = [];
          if (teamData.coach_id && coachesMap.has(teamData.coach_id)) {
            const coach = coachesMap.get(teamData.coach_id);
            teamCoaches.push({
              id: String(coach.id || ''),
              name: String(coach.name || ''),
              phone_number: String(coach.phone_number || '')
            });
            console.log(`Found coach for team ${teamId}:`, coach.name);
          }
          
          // Get players for this team
          let players: {id: string; name: string}[] = [];
          
          try {
            const { data: playersData, error: playersError } = await supabase
              .from('players')
              .select('id, name')
              .eq('team_id', teamId)
              .eq('is_active', true);
              
            if (playersError) {
              console.error(`Error fetching players for team ${teamId}:`, playersError);
            } else {
              console.log(`Loaded ${playersData?.length || 0} players for team ${teamId}`);
              players = playersData || [];
            }
          } catch (playerError) {
            console.error(`Error in player fetching for team ${teamId}:`, playerError);
          }
          
          // Add the team to our list
          teamsWithDetails.push({
            id: teamData.id,
            name: teamData.name,
            access_code: teamData.access_code || '',
            coaches: teamCoaches,
            players: players
          });
          
          console.log(`Successfully processed team ${teamId}`);
        } catch (error) {
          console.error(`Error processing team ${teamId}:`, error);
          // Continue with next team
        }
      }
      
      console.log(`Setting teams state with ${teamsWithDetails.length} teams`);
      setTeams(teamsWithDetails);
    } catch (error) {
      console.error('Error in loadTeamsInfo:', error);
      Alert.alert('Error', 'Failed to load teams information');
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
      t('parent.manage.deleteChild'),
      t('parent.manage.deleteChildConfirmation'),
      [
        { text: t('parent.manage.cancel'), style: 'cancel' },
        {
          text: t('parent.manage.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              console.log("Starting deletion process for child ID:", childId);
              
              // First, get the child data to get the team_id and other details
              const { data: childData, error: childFetchError } = await supabase
                .from('parent_children')
                .select('*')
                .eq('id', childId)
                .single();
                
              if (childFetchError) {
                console.error('Error fetching child data:', childFetchError);
                throw new Error('Could not find child data');
              }
              
              console.log("Child data found:", childData);
              
              // Get parent data from AsyncStorage
              const parentData = await AsyncStorage.getItem('parent_data');
              if (!parentData) {
                throw new Error('Parent data not found');
              }
              const parent = JSON.parse(parentData);
              
              // Delete players linked to this child
              console.log("Attempting to update player with name:", childData.full_name);
              const { data: updatePlayerData, error: playerUpdateError } = await supabase
                .from('players')
                .update({ is_active: false })
                .eq('name', childData.full_name)
                .eq('parent_id', parent.id);
                
              if (playerUpdateError) {
                console.error('Error updating player:', playerUpdateError);
                // We'll continue with child deletion even if player update fails
              } else {
                console.log("Player update result:", updatePlayerData);
              }
              
              // Now delete the child record
              console.log("Attempting to delete child with ID:", childId);
              const { data: updateChildData, error: childUpdateError } = await supabase
                .from('parent_children')
                .update({ is_active: false })
                .eq('id', childId)
                .select(); // Request the updated row to confirm update
                
              if (childUpdateError) {
                console.error('Error updating child:', childUpdateError);
                throw new Error('Failed to delete child');
              }
              
              console.log("Child update result:", updateChildData);
              
              if (!updateChildData || updateChildData.length === 0) {
                console.error('Child not updated, no rows affected');
                throw new Error('Failed to delete child - no rows affected');
              }
              
              // Verify child is now inactive
              console.log("Verifying child is now inactive...");
              const { data: verifyData, error: verifyError } = await supabase
                .from('parent_children')
                .select('*')
                .eq('id', childId)
                .single();
                
              if (verifyError) {
                console.error('Error verifying child update:', verifyError);
              } else {
                console.log("Child after update:", verifyData);
                if (verifyData.is_active === true) {
                  console.error('Child is still active after update!');
                  throw new Error('Failed to delete child - it is still active');
                }
              }
              
              Alert.alert(t('common.success'), t('parent.manage.childDeleted'));
              
              // Force reload from database with a slight delay to ensure DB consistency
              setTimeout(async () => {
                await loadChildren();
                setIsLoading(false);
              }, 500);
            } catch (error) {
              console.error('Error in delete process:', error);
              Alert.alert(t('common.error'), error instanceof Error ? error.message : t('parent.manage.failedToDeleteChild'));
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

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeamId(expandedTeamId === teamId ? null : teamId);
  };

  const renderChildrenTab = () => {
    return (
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable 
          onPress={handleAddChild}
          style={styles.addButtonAdminConsistent}
        >
          <MaterialCommunityIcons 
            name="account-plus" 
            size={24} 
            color={COLORS.white} 
          />
          <Text style={styles.addButtonText}>{t('parent.addChild.addChild')}</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('parent.manage.loadingChildren')}</Text>
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="account-multiple-outline" 
              size={64} 
              color={COLORS.grey[300]} 
            />
            <Text style={styles.emptyText}>{t('parent.manage.noChildrenAdded')}</Text>
            <Text style={styles.emptySubtext}>
              {t('parent.manage.noChildrenSubtext')}
            </Text>
          </View>
        ) : (
          <>
            {children.map((child) => (
              <Card 
                key={child.id} 
                style={styles.childCard}
                mode="outlined"
              >
                <Card.Content>
                  <View style={styles.childHeader}>
                    <View style={styles.nameContainer}>
                      <MaterialCommunityIcons 
                        name="account" 
                        size={28} 
                        color={COLORS.primary} 
                        style={styles.icon}
                      />
                      <View>
                        <Text style={styles.childName}>{child.full_name}</Text>
                        <Text style={styles.teamName}>{child.team_name}</Text>
                      </View>
                    </View>

                    <View style={styles.ageContainer}>
                      <Text style={styles.ageLabel}>{t('parent.manage.birthDate')}</Text>
                      <Text style={styles.ageValue}>
                        {new Date(child.birth_date).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <Divider style={styles.divider} />

                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('parent.manage.medicalVisa')}</Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: getMedicalVisaColor(child.medical_visa_status) }
                      ]}>
                        <Text style={styles.statusText}>
                          {t(`parent.manage.medicalVisaStatus.${child.medical_visa_status}`)}
                        </Text>
                      </View>
                    </View>

                    {child.medical_visa_issue_date && (
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>{t('parent.manage.issueDate')}</Text>
                        <Text style={styles.infoValue}>
                          {new Date(child.medical_visa_issue_date).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionButtons}>
                    <Pressable 
                      style={styles.editButton}
                      onPress={() => handleEditChild(child.id)}
                    >
                      <MaterialCommunityIcons 
                        name="pencil" 
                        size={16} 
                        color={COLORS.white} 
                      />
                      <Text style={styles.buttonText}>{t('parent.manage.edit')}</Text>
                    </Pressable>

                    <Pressable 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteChild(child.id)}
                    >
                      <MaterialCommunityIcons 
                        name="delete" 
                        size={16} 
                        color={COLORS.white} 
                      />
                      <Text style={styles.buttonText}>{t('parent.manage.delete')}</Text>
                    </Pressable>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderTeamTab = () => {
    return (
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('parent.manage.loadingTeamInfo')}</Text>
          </View>
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="account-group-outline" 
              size={64} 
              color={COLORS.grey[300]} 
            />
            <Text style={styles.emptyText}>{t('parent.manage.noTeamsFound')}</Text>
            <Text style={styles.emptySubtext}>
              {t('parent.manage.noTeamsSubtext')}
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {teams.map(team => (
              <Card 
                key={team.id} 
                style={styles.teamCard}
                mode="outlined"
              >
                <Card.Content>
                  <View style={styles.teamHeader}>
                    <View style={styles.teamTitleContainer}>
                      <MaterialCommunityIcons 
                        name="account-group" 
                        size={28} 
                        color={COLORS.primary} 
                        style={styles.icon}
                      />
                      <Text style={styles.teamName}>{team.name}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.teamCodeContainer}>
                    <Text style={styles.teamCodeLabel}>{t('parent.manage.teamAccessCode')}</Text>
                    <Text style={styles.teamCodeValue}>{team.access_code}</Text>
                  </View>

                  <Divider style={styles.divider} />
                  
                  <Text style={styles.sectionTitle}>{t('parent.manage.coaches')}</Text>
                  <View style={styles.playersList}>
                    {team.coaches.length === 0 ? (
                      <View style={styles.noCoachContainer}>
                        <MaterialCommunityIcons 
                          name="account-alert-outline" 
                          size={24} 
                          color={COLORS.grey[400]} 
                        />
                        <Text style={styles.noCoachText}>{t('parent.manage.noCoaches')}</Text>
                      </View>
                    ) : (
                      team.coaches.map(coach => (
                        <View key={coach.id} style={[styles.coachItem, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}> 
                          <MaterialCommunityIcons 
                            name="account" 
                            size={20} 
                            color={COLORS.primary} 
                          />
                          <Text style={styles.coachName}>{coach.name}</Text>
                          <Text style={styles.coachPhone}>{coach.phone_number}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  <Divider style={styles.divider} />
                  
                  <Text style={styles.sectionTitle}>{t('parent.manage.players')}</Text>
                  {team.players.length === 0 ? (
                    <View style={styles.noPlayersContainer}>
                      <MaterialCommunityIcons 
                        name="account-multiple-outline" 
                        size={24} 
                        color={COLORS.grey[400]} 
                      />
                      <Text style={styles.noPlayersText}>{t('parent.manage.noPlayers')}</Text>
                    </View>
                  ) : (
                    team.players.map(player => (
                      <View key={player.id} style={styles.playerItem}>
                        <MaterialCommunityIcons 
                          name="account" 
                          size={20} 
                          color={COLORS.primary} 
                        />
                        <Text style={styles.playerName}>{player.name}</Text>
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabType)}
          buttons={[
            { 
              value: 'children', 
              label: t('parent.manage.children'),
              icon: 'account-multiple'
            },
            { 
              value: 'team', 
              label: t('parent.manage.team'),
              icon: 'account-group'
            }
          ]}
          style={styles.segmentedButtons}
          theme={{
            colors: {
              primary: COLORS.primary,
              secondaryContainer: '#EEFBFF',
              onSecondaryContainer: COLORS.primary,
              outline: COLORS.grey[200],
            }
          }}
        />
      </View>

      {activeTab === 'children' ? renderChildrenTab() : renderTeamTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContainer: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  segmentedButtons: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    elevation: 0,
    shadowColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[700],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.grey[700],
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[600],
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  addButtonAdminConsistent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.lg,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
    marginLeft: SPACING.sm,
  },
  childCard: {
    marginBottom: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  childName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  teamName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
  },
  ageContainer: {
    alignItems: 'flex-end',
  },
  ageLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[600],
  },
  ageValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grey[200],
    marginVertical: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.grey[600],
    marginBottom: 4,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginRight: SPACING.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    marginLeft: 4,
  },
  teamCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderColor: COLORS.grey[200],
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  teamTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
  },
  coachItem: {
    marginBottom: SPACING.sm,
  },
  coachInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  coachName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  coachPhone: {
    fontSize: FONT_SIZES.md,
    color: COLORS.grey[700],
  },
  noCoachContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
  },
  noCoachText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    fontStyle: 'italic',
    marginLeft: SPACING.sm,
  },
  playersToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  playersList: {
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  playerName: {
    fontSize: FONT_SIZES.md,
    marginLeft: SPACING.sm,
    color: COLORS.text,
  },
  noPlayersText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    fontStyle: 'italic',
    padding: SPACING.sm,
  },
  teamCodeContainer: {
    backgroundColor: COLORS.grey[100],
    borderRadius: 6,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCodeLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[700],
    fontWeight: '500',
  },
  teamCodeValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  playersHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.grey[600],
    marginLeft: SPACING.xs,
  },
  noPlayersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.grey[100],
    borderRadius: 8,
  },
}); 