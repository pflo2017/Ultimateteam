import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Text, TextInput, ActivityIndicator, Button } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { supabase } from '../lib/supabase';
import { Activity, getActivitiesByDateRange } from '../services/activitiesService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Utility function to extract the base UUID from a recurring activity ID
// NOTE: We're keeping this function for reference, but we'll now use the FULL activity ID
// to ensure each recurring instance has its own independent attendance data
const extractBaseActivityId = (id: string): string => {
  // Check if the ID has a date suffix (format: uuid-date)
  if (id.includes('-2025') || id.includes('-2024')) {
    // Extract the base UUID part (first 36 characters which is a standard UUID)
    return id.substring(0, 36);
  }
  return id;
};

export default function AddAttendanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { activityId, teamId } = (route.params || {}) as { activityId?: string; teamId?: string };
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendance, setAttendance] = useState<{ [playerId: string]: 'present' | 'absent' | null }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeam) { loadPlayers(selectedTeam.id); loadActivitiesForTeam(selectedTeam.id); } }, [selectedTeam]);
  useEffect(() => { if (selectedActivity) { loadAttendance(); } else { setAttendance({}); } }, [selectedActivity]);

  // Pre-select team if teamId is provided
  useEffect(() => {
    if (teamId && teams.length > 0) {
      const found = teams.find(t => t.id === teamId);
      if (found) setSelectedTeam(found);
    }
  }, [teamId, teams]);

  // Pre-select activity if activityId is provided
  useEffect(() => {
    if (activityId && activities.length > 0) {
      const found = activities.find(a => a.id === activityId);
      if (found) setSelectedActivity(found);
      else {
        // If not found, fetch the activity directly and add to list
        (async () => {
          const { data, error } = await supabase.from('activities').select('*').eq('id', activityId).single();
          if (data) setActivities(prev => [data, ...prev.filter(a => a.id !== data.id)]);
        })();
      }
    }
  }, [activityId, activities]);

  const loadTeams = async () => {
    try {
      const adminData = await AsyncStorage.getItem('admin_data');
      const coachData = await AsyncStorage.getItem('coach_data');
      if (adminData) {
        const { data, error } = await supabase.from('teams').select('id, name').eq('is_active', true).order('name');
        if (!error && data) setTeams(data);
      } else if (coachData) {
        const coach = JSON.parse(coachData);
        const { data, error } = await supabase.rpc('get_coach_teams', { p_coach_id: coach.id });
        if (!error && data) {
          const formatted = data.map((team: any) => ({ id: team.team_id, name: team.team_name }));
          setTeams(formatted);
        }
      }
    } catch (e) { console.error(e); }
  };
  const loadPlayers = async (teamId: string) => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase.from('players').select('id, name, team_id').eq('team_id', teamId).eq('is_active', true).order('name');
      if (!error && data) setPlayers(data);
    } catch (e) { console.error(e); }
    setIsLoadingPlayers(false);
  };
  const loadActivitiesForTeam = async (teamId: string) => {
    setIsLoadingActivities(true);
    try {
      const weekStart = new Date();
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const { data, error } = await getActivitiesByDateRange(weekStart.toISOString(), weekEnd.toISOString(), teamId);
      let allActivities = data || [];
      // If activityId is provided and not in the list, fetch and add it
      if (activityId && !allActivities.find(a => a.id === activityId)) {
        const { data: act, error: actErr } = await supabase.from('activities').select('*').eq('id', activityId).single();
        if (act) allActivities = [act, ...allActivities];
      }
      setActivities(allActivities);
    } catch (e) { console.error(e); }
    setIsLoadingActivities(false);
  };
  const loadAttendance = async () => {
    if (!selectedActivity) return;
    setIsLoadingPlayers(true);
    try {
      // Use the FULL activity ID to ensure we're loading attendance for this specific instance
      const activityIdToUse = selectedActivity.id;
      
      console.log('Loading attendance for specific activity instance:', {
        activityId: activityIdToUse,
        title: selectedActivity.title
      });
      
      const { data, error } = await supabase
        .from('activity_attendance')
        .select('*')
        .eq('activity_id', activityIdToUse);
        
      if (!error && data) {
        const attendanceMap = data.reduce((acc: any, record: any) => {
          acc[record.player_id] = record.status;
          return acc;
        }, {});
        setAttendance(attendanceMap);
      }
    } catch (e) { console.error(e); }
    setIsLoadingPlayers(false);
  };
  const toggleAttendance = (playerId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({ ...prev, [playerId]: status }));
  };
  const handleSave = async () => {
    if (!selectedActivity?.id) { alert('Please select an activity first'); return; }
    setIsSaving(true);
    try {
      // Use the FULL activity ID to ensure each instance has its own attendance data
      const activityIdToUse = selectedActivity.id;
      
      console.log('Saving attendance for specific activity instance:', {
        activityId: activityIdToUse,
        title: selectedActivity.title
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      const attendanceRecords = Object.entries(attendance)
        .filter(([_, status]) => status !== null)
        .map(([playerId, status]) => ({
          activity_id: activityIdToUse,
          player_id: playerId,
          status: status,
          recorded_by: user?.id,
          recorded_at: new Date().toISOString()
        }));
        
      if (attendanceRecords.length > 0) {
        const { error } = await supabase
          .from('activity_attendance')
          .upsert(attendanceRecords, { onConflict: 'activity_id,player_id', ignoreDuplicates: false });
          
        if (error) throw error;
      }
      
      alert('Attendance saved successfully');
      if (navigation.canGoBack()) {
        navigation.pop(2);
      }
    } catch (e) { alert('Failed to save attendance'); console.error(e); }
    setIsSaving(false);
  };
  const filteredPlayers = players.filter(player => player.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          labelStyle={styles.saveButtonLabel}
          loading={isSaving}
          disabled={isSaving || !selectedActivity}
        >
          Save
        </Button>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Team Selector */}
        <Text style={styles.label}>Select Team</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowTeamModal(true)}>
          <View>
            <Text style={styles.selectorText}>{selectedTeam ? selectedTeam.name : 'Select a team'}</Text>
            <Text style={styles.selectorSubtext}>Attendance will be marked for this team</Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        {/* Team Modal */}
        <Modal visible={showTeamModal} animationType="slide" transparent onRequestClose={() => setShowTeamModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Team</Text>
                <TouchableOpacity onPress={() => setShowTeamModal(false)} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.teamsList}>
                {teams.length > 0 ? (
                  teams.map(team => (
                    <TouchableOpacity key={team.id} style={[styles.teamItem, selectedTeam?.id === team.id && styles.selectedTeamItem]} onPress={() => { setSelectedTeam(team); setShowTeamModal(false); }}>
                      <View style={styles.teamItemContent}>
                        <MaterialCommunityIcons name="account-group" size={24} color={COLORS.primary} />
                        <Text style={styles.teamName}>{team.name}</Text>
                      </View>
                      {selectedTeam?.id === team.id && (
                        <MaterialCommunityIcons name="check" size={24} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noTeamsText}>No teams available</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* Activity Selector */}
        <Text style={styles.label}>Select Activity</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowActivityModal(true)} disabled={!selectedTeam}>
          <View>
            <Text style={styles.selectorText}>{selectedActivity ? selectedActivity.title : 'Select an activity'}</Text>
            <Text style={styles.selectorSubtext}>Choose the activity for attendance</Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        {/* Activity Modal */}
        <Modal visible={showActivityModal} animationType="slide" transparent onRequestClose={() => setShowActivityModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Activity</Text>
                <TouchableOpacity onPress={() => setShowActivityModal(false)} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.teamsList}>
                {activities.length > 0 ? (
                  activities.map(activity => (
                    <TouchableOpacity key={activity.id} style={[styles.teamItem, selectedActivity?.id === activity.id && styles.selectedTeamItem]} onPress={() => { setSelectedActivity(activity); setShowActivityModal(false); }}>
                      <View style={styles.teamItemContent}>
                        <MaterialCommunityIcons name="calendar" size={24} color={COLORS.primary} />
                        <Text style={styles.teamName}>{activity.title}</Text>
                      </View>
                      {selectedActivity?.id === activity.id && (
                        <MaterialCommunityIcons name="check" size={24} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noTeamsText}>No activities available</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* Search Players */}
        <Text style={styles.label}>Players</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            mode="outlined"
            placeholder="Search players..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            left={<TextInput.Icon icon="magnify" color={COLORS.primary} />}
            outlineStyle={styles.searchOutline}
            dense
          />
        </View>
        {/* Player List */}
        {isLoadingPlayers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading players...</Text>
          </View>
        ) : filteredPlayers.length > 0 ? (
          <View style={styles.playersContainer}>
            {filteredPlayers.map(item => (
              <View key={item.id} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                </View>
                <View style={styles.attendanceRadioContainer}>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity style={[styles.radioButton, attendance[item.id] === 'present' && styles.presentRadio, attendance[item.id] === 'present' && styles.radioButtonSelected]} onPress={() => toggleAttendance(item.id, 'present')}>
                      {attendance[item.id] === 'present' && (<View style={[styles.radioInner, { backgroundColor: COLORS.primary }]} />)}
                    </TouchableOpacity>
                    <Text style={styles.radioLabel}>Present</Text>
                  </View>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity style={[styles.radioButton, attendance[item.id] === 'absent' && styles.absentRadio, attendance[item.id] === 'absent' && styles.radioButtonSelected]} onPress={() => toggleAttendance(item.id, 'absent')}>
                      {attendance[item.id] === 'absent' && (<View style={[styles.radioInner, { backgroundColor: COLORS.error }]} />)}
                    </TouchableOpacity>
                    <Text style={styles.radioLabel}>Absent</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-question" size={50} color={COLORS.grey[400]} />
            <Text style={styles.emptyText}>{selectedTeam ? 'No players found for this team' : 'Select a team to view players'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  saveButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    minWidth: 80,
    height: 36,
    justifyContent: 'center',
    elevation: 0,
  },
  saveButtonLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grey[200],
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    elevation: 1,
  },
  selectorText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  selectorSubtext: {
    fontSize: 12,
    color: COLORS.grey[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  teamsList: {
    marginTop: 8,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[100],
  },
  selectedTeamItem: {
    backgroundColor: COLORS.grey[100],
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 15,
    marginLeft: 10,
    color: COLORS.text,
  },
  noTeamsText: {
    textAlign: 'center',
    color: COLORS.grey[500],
    marginTop: 20,
  },
  searchContainer: {
    marginBottom: SPACING.md,
  },
  searchInput: {
    backgroundColor: COLORS.white,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: 8,
    borderColor: COLORS.grey[300],
  },
  playersContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 0,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  playerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  attendanceRadioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 150,
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentRadio: {
    borderColor: COLORS.primary,
  },
  absentRadio: {
    borderColor: COLORS.error,
  },
  radioButtonSelected: {
    borderWidth: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 12,
    marginLeft: 4,
    marginRight: 8,
    color: COLORS.text,
  },
  loadingContainer: {
    padding: SPACING.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
  },
  emptyContainer: {
    padding: SPACING.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.grey[600],
    fontSize: 16,
  },
}); 