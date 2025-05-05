import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { Text, ActivityIndicator, Card, Snackbar } from 'react-native-paper';
import { COLORS, SPACING } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types/navigation';
import { supabase } from '../../lib/supabase';

interface Coach {
  id: string;
  name: string;
  phone_number: string;
  access_code: string;
  created_at: string;
  is_active: boolean;
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

  const renderCoachCard = (coach: Coach) => (
    <Card key={coach.id} style={[styles.card, { backgroundColor: '#EEFBFF' }]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <MaterialCommunityIcons name="account-tie" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{coach.name}</Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditCoach', { coachId: coach.id })}
              style={styles.actionButton}
            >
              <MaterialCommunityIcons name="pencil" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{coach.phone_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="key" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>Access code: {coach.access_code}</Text>
            <TouchableOpacity
              onPress={() => onCopyAccessCode(coach.access_code)}
              style={styles.copyButton}
            >
              <MaterialCommunityIcons name="content-copy" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.teamsContainer}>
            <Text style={styles.teamsLabel}>Assigned Teams:</Text>
            <View style={styles.teamsList}>
              {coach.teams.length > 0 ? (
                coach.teams.map(team => (
                  <View key={team.id} style={styles.teamChip}>
                    <Text style={styles.teamChipText}>{team.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noTeams}>No teams assigned</Text>
              )}
            </View>
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
          {!coaches?.length ? (
            <Text style={styles.emptyText}>No coaches found</Text>
          ) : (
            coaches.map(renderCoachCard)
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
  card: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  cardContent: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.grey[600],
  },
  copyButton: {
    marginLeft: 'auto',
  },
  teamsContainer: {
    marginTop: SPACING.sm,
  },
  teamsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  teamsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  teamChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 100,
  },
  teamChipText: {
    color: COLORS.white,
    fontSize: 12,
  },
  noTeams: {
    fontSize: 14,
    color: COLORS.grey[400],
    fontStyle: 'italic',
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