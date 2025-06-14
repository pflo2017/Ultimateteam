import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';

// Define types
type Team = {
  id: string;
  name: string;
  is_active?: boolean;
  club_id?: string;
};

interface TeamFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTeam: (team: Team | null) => void;
  selectedTeam: Team | null;
  styles: any;
}

export const TeamFilterModal: React.FC<TeamFilterModalProps> = ({
  visible,
  onClose,
  onSelectTeam,
  selectedTeam,
  styles,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load teams when modal is opened
  useEffect(() => {
    if (visible) {
      loadTeams();
    }
  }, [visible]);

  // Direct implementation to load teams by club_id
  const loadTeams = async () => {
    try {
      setIsLoading(true);
      console.log('[TeamFilterModal] Loading teams...');
      
      // Get user's club_id directly
      let userClubId = null;
      
      // First try AsyncStorage
      try {
        const adminDataStr = await AsyncStorage.getItem('admin_data');
        if (adminDataStr) {
          const adminData = JSON.parse(adminDataStr);
          userClubId = adminData.club_id;
          console.log('[TeamFilterModal] Found club_id in AsyncStorage:', userClubId);
        }
      } catch (e) {
        console.error('[TeamFilterModal] Error reading from AsyncStorage:', e);
      }
      
      // If not found in AsyncStorage, try Supabase auth
      if (!userClubId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if admin
          const { data: club } = await supabase
            .from('clubs')
            .select('id')
            .eq('admin_id', user.id)
            .single();
          
          if (club) {
            userClubId = club.id;
            console.log('[TeamFilterModal] Found club_id via admin check:', userClubId);
          } else {
            // Check if coach
            const { data: coach } = await supabase
              .from('coaches')
              .select('club_id')
              .eq('user_id', user.id)
              .single();
            
            if (coach) {
              userClubId = coach.club_id;
              console.log('[TeamFilterModal] Found club_id via coach check:', userClubId);
            }
          }
        }
      }
      
      if (!userClubId) {
        console.error('[TeamFilterModal] Could not determine user club_id');
        setTeams([]);
        setIsLoading(false);
        return;
      }
      
      // Direct query with club_id filter
      console.log('[TeamFilterModal] Querying teams with club_id:', userClubId);
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, is_active, club_id')
        .eq('club_id', userClubId)
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('[TeamFilterModal] Error loading teams:', error);
        setTeams([]);
      } else if (teamsData) {
        console.log('[TeamFilterModal] Loaded teams:', teamsData.length);
        setTeams(teamsData);
      }
    } catch (error) {
      console.error('[TeamFilterModal] Error in loadTeams:', error);
      setTeams([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Team</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text>Loading teams...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.optionItem, !selectedTeam && styles.optionSelected]}
                onPress={() => { 
                  onSelectTeam(null); 
                  onClose(); 
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.optionText, !selectedTeam && styles.optionTextSelected]}>All Teams</Text>
                </View>
                {!selectedTeam && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              
              <ScrollView>
                {teams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  
                  return (
                    <TouchableOpacity
                      key={team.id}
                      style={[styles.optionItem, isSelected && styles.optionSelected]}
                      onPress={() => { 
                        onSelectTeam(team);
                        onClose(); 
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="account-group" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{team.name}</Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}; 