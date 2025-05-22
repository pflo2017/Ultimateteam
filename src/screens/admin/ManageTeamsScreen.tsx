import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, TouchableOpacity, TextInput, Animated, ViewStyle, TextStyle, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, IconButton, Card, Divider } from 'react-native-paper';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import * as Clipboard from 'expo-clipboard';

interface Team {
  id: string;
  name: string;
  access_code: string;
  created_at: string;
  is_active: boolean;
  coach_id: string | null;
  coach: {
    id: string;
    name: string;
  } | null;
  players_count: number;
  coach_name?: string;
}

interface TeamCardProps {
  team: Team;
  onPress: () => void;
  onCopyAccessCode: (code: string) => void;
  navigation: NativeStackNavigationProp<AdminStackParamList>;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onPress, onCopyAccessCode, navigation }) => {
  return (
    <Card 
      key={team.id} 
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
        borderColor: COLORS.grey[200],
        overflow: 'hidden'
      }}
      mode="outlined"
      onPress={onPress}
    >
      <Card.Content style={{ padding: SPACING.md }}>
        {/* Team Header */}
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
              backgroundColor: COLORS.primary + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: SPACING.md
            }}>
              <MaterialCommunityIcons 
                name="shield" 
                size={28} 
                color={COLORS.primary} 
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
                {team.name}
              </Text>
              <Text 
                style={{
                  fontSize: FONT_SIZES.sm,
                  color: COLORS.grey[600],
                }}
                numberOfLines={1}
              >
                Team
              </Text>
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
            onPress={() => navigation.navigate('EditTeam', { teamId: team.id })}
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
          {team.coach ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.sm
            }}>
              <MaterialCommunityIcons name="account-tie" size={20} color={COLORS.primary} />
              <Text style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.grey[600],
              }}>
                Coach: <Text style={{
                  fontWeight: '600',
                  color: COLORS.text
                }}>{team.coach.name}</Text>
              </Text>
            </View>
          ) : (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.sm
            }}>
              <MaterialCommunityIcons name="account-off" size={20} color={COLORS.primary} />
              <Text style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.grey[600],
                fontStyle: 'italic'
              }}>
                No coach assigned
              </Text>
            </View>
          )}
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm
          }}>
            <MaterialCommunityIcons name="run" size={20} color={COLORS.primary} />
            <Text style={{
              fontSize: FONT_SIZES.sm,
              color: COLORS.grey[600],
            }}>
              Players: <Text style={{
                fontWeight: '600',
                color: COLORS.text
              }}>{team.players_count || '0'}</Text>
            </Text>
          </View>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm,
            justifyContent: 'space-between'
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.sm,
              flex: 1
            }}>
              <MaterialCommunityIcons name="key" size={20} color={COLORS.primary} />
              <Text style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.grey[600],
              }}>
                Access: <Text style={{
                  fontWeight: '600',
                  color: COLORS.text
                }}>{team.access_code}</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onCopyAccessCode(team.access_code)}
              style={{
                padding: SPACING.xs,
                backgroundColor: COLORS.primary + '15',
                borderRadius: 8
              }}
            >
              <MaterialCommunityIcons name="content-copy" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

interface ManageTeamsScreenProps {
  teams: Team[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  onCopyAccessCode: (code: string) => void;
}

export const ManageTeamsScreen: React.FC<ManageTeamsScreenProps> = ({
  teams,
  isLoading,
  onRefresh,
  refreshing,
  onCopyAccessCode
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={COLORS.primary} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionTitle}>Teams</Text>
            <Text style={styles.totalCount}>Total: {teams.length} teams</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddTeam')}
          >
            <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add Team</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.grey[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search team"
            placeholderTextColor={COLORS.grey[400]}
          />
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {!teams?.length ? (
            <Text style={styles.emptyText}>No teams found</Text>
          ) : (
            teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onPress={() => {}}
                onCopyAccessCode={onCopyAccessCode}
                navigation={navigation}
              />
            ))
          )}
        </ScrollView>
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
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalCount: {
    fontSize: FONT_SIZES.sm,
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
    fontSize: FONT_SIZES.sm,
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
    fontSize: FONT_SIZES.md,
  },
  scrollContent: {
    paddingBottom: SPACING.xl * 4,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.grey[400],
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.xl,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 