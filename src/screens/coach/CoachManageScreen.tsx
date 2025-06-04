import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert, Text, TouchableOpacity } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachManageTeamsScreen } from './CoachManageTeamsScreen';
import { CoachManagePlayersScreen } from './CoachManagePlayersScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { CoachTabParamList } from '../../navigation/CoachNavigator';
import { useDataRefresh } from '../../utils/useDataRefresh';

interface Team {
  id: string;
  name: string;
  players_count: number;
}

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  medical_visa_status: string;
  payment_status: string;
  parent_id: string | null;
  created_at?: string;
  birth_date?: string;
  last_payment_date?: string;
  medical_visa_issue_date?: string;
}

export const CoachManageScreen = () => {
  const route = useRoute<RouteProp<CoachTabParamList, 'Manage'>>();
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>(route.params?.activeTab || 'teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(route.params?.teamId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
    if (route.params?.teamId) {
      setSelectedTeamId(route.params.teamId);
    }
    loadData();
  }, [route.params?.activeTab, route.params?.teamId]);

  // Use the data refresh hook to listen for payment status changes
  useDataRefresh('players', () => {
    console.log("Payment status change detected - refreshing players data");
    loadData();
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const storedCoachData = await AsyncStorage.getItem('coach_data');
      console.log('[DEBUG] Stored coach data:', storedCoachData);
      
      if (!storedCoachData) {
        console.log('[DEBUG] No stored coach data found');
        setIsLoading(false);
        return;
      }

      const coachData = JSON.parse(storedCoachData);
      console.log('[DEBUG] Loading data for coach:', {
        id: coachData.id,
        name: coachData.name,
        access_code: coachData.access_code
      });

      // Load teams using the get_coach_teams function
      console.log('[DEBUG] Fetching teams for coach (using coach.id):', coachData.id);
      const { data: teamsData, error: teamsError } = await supabase
        .rpc('get_coach_teams', { p_coach_id: coachData.id });

      if (teamsError) {
        console.error('[DEBUG] Error fetching teams:', teamsError);
        Alert.alert('Error', 'Failed to load teams. Please try again.');
      } else {
        console.log('[DEBUG] Teams fetched:', teamsData);
        const transformedTeams = (teamsData || []).map((team: { team_id: string; team_name: string; player_count?: number }) => ({
          id: team.team_id,
          name: team.team_name,
          players_count: team.player_count || 0
        }));
        console.log('[DEBUG] Transformed teams:', transformedTeams);
        setTeams(transformedTeams);
      }

      // Load players using the get_coach_players function
      console.log('[DEBUG] Fetching players for coach (using coach.id):', coachData.id);
      const { data: playersData, error: playersError } = await supabase
        .rpc('get_coach_players', { p_coach_id: coachData.id });

      if (playersError) {
        console.error('[DEBUG] Error fetching players:', playersError);
        Alert.alert('Error', 'Failed to load players. Please try again.');
        setPlayers([]);
      } else {
        console.log('[DEBUG] Players fetched from RPC:', {
          count: playersData?.length || 0,
          data: playersData?.map((p: { 
            player_id: string; 
            player_name: string; 
            team_id: string; 
            team_name: string; 
          }) => ({
            id: p.player_id,
            name: p.player_name,
            team_id: p.team_id,
            team_name: p.team_name
          }))
        });
        
        // If no players data, set empty array and continue
        if (!playersData || playersData.length === 0) {
          console.log('[DEBUG] No players data returned from RPC');
          setPlayers([]);
          return;
        }
        
        // COMPLETE FIX: Forget about enhancing the RPC data, just fetch the complete player data directly
        if (playersData && playersData.length > 0) {
          const playerIds = playersData.map((player: any) => player.player_id);
          
          // Get complete player data directly from the players table 
          console.log("QUERY - Fetching player data for IDs:", playerIds);
          const { data: completePlayerData, error: completePlayerError } = await supabase
            .from('players')
            .select(`
              id,
              name,
              created_at,
              birth_date,
              payment_status,
              last_payment_date,
              medical_visa_status,
              medical_visa_issue_date,
              team_id,
              parent_id
            `)
            .in('id', playerIds);
            
          if (completePlayerError) {
            console.error("Error fetching complete player data:", completePlayerError);
          } else if (completePlayerData && completePlayerData.length > 0) {
            console.log("QUERY - Raw results example:", {
              id: completePlayerData[0].id,
              name: completePlayerData[0].name,
              payment_status: completePlayerData[0].payment_status,
              last_payment_date: completePlayerData[0].last_payment_date,
              medical_visa_status: completePlayerData[0].medical_visa_status,
              medical_visa_issue_date: completePlayerData[0].medical_visa_issue_date
            });
            
            // Log all players' medical visa status for debugging
            console.log("QUERY - All players medical visa status:", completePlayerData.map(p => ({
              id: p.id,
              name: p.name,
              medical_visa_status: p.medical_visa_status,
              medical_visa_issue_date: p.medical_visa_issue_date
            })));
            
            // Map the complete data to the RPC data format
            const enhancedPlayers = playersData.map((rpcPlayer: any) => {
              console.log("STEP 2 - Processing player:", rpcPlayer.player_id);
              const completePlayer = completePlayerData.find(p => p.id === rpcPlayer.player_id);
              if (completePlayer) {
                console.log("STEP 3 - Found matching complete player data:", {
                  id: completePlayer.id,
                  raw_last_payment_date: completePlayer.last_payment_date,
                  medical_visa_status: completePlayer.medical_visa_status,
                  medical_visa_issue_date: completePlayer.medical_visa_issue_date
                });
                
                // Format last_payment_date to match admin screen format
                const lastPaymentDate = completePlayer.last_payment_date
                  ? new Date(completePlayer.last_payment_date).toLocaleDateString('en-GB')
                  : null;
                  
                console.log("STEP 4 - Formatted last payment date:", lastPaymentDate);
                
                return {
                  ...rpcPlayer,
                  id: rpcPlayer.player_id,
                  created_at: completePlayer.created_at,
                  birth_date: completePlayer.birth_date,
                  last_payment_date: lastPaymentDate,
                  medical_visa_status: completePlayer.medical_visa_status,
                  medical_visa_issue_date: completePlayer.medical_visa_issue_date
                };
              }
              console.log("STEP 5 - No matching complete player data found");
              // If no complete player data found, try to fetch last_payment_date separately
              return {
                ...rpcPlayer,
                id: rpcPlayer.player_id
              };
            });
            
            console.log("STEP 6 - Final enhanced players:", enhancedPlayers.map((p: any) => ({
              player_id: p.player_id,
              last_payment_date: p.last_payment_date,
              medical_visa_status: p.medical_visa_status,
              medical_visa_issue_date: p.medical_visa_issue_date
            })));
            
            setPlayers(enhancedPlayers);
            return;
          }
        }
        
        // If we reach here, the direct approach failed, fallback to the previous method
        // We need to fetch the missing last_payment_date field separately
        let playersWithPaymentDates = [...playersData];
        
        if (playersData && playersData.length > 0) {
          // Get all player IDs
          const playerIds = playersData.map((player: any) => player.player_id);
          
          // Fetch last payment dates directly
          const { data: paymentData, error: paymentError } = await supabase
            .from('players')
            .select('id, last_payment_date, medical_visa_status, medical_visa_issue_date')
            .in('id', playerIds);
            
          if (!paymentError && paymentData) {
            console.log("Payment dates fetched:", paymentData);
            
            // Log a specific example
            if (paymentData.length > 0) {
              console.log("Example player payment date:", paymentData[0]);
              console.log("Payment date type:", typeof paymentData[0].last_payment_date);
              if (paymentData[0].last_payment_date) {
                try {
                  console.log("Formatted date:", new Date(paymentData[0].last_payment_date).toLocaleDateString('en-GB'));
                } catch (e) {
                  console.error("Error formatting date:", e);
                }
              }
            }
            
            // Create a map for quick lookup
            const paymentDateMap = new Map();
            paymentData.forEach(item => {
              paymentDateMap.set(item.id, {
                last_payment_date: item.last_payment_date,
                medical_visa_status: item.medical_visa_status,
                medical_visa_issue_date: item.medical_visa_issue_date
              });
            });
            
            // Add last_payment_date to each player
            playersWithPaymentDates = playersData.map((player: any) => {
              const playerData = paymentDateMap.get(player.player_id);
              const rawLastPaymentDate = playerData?.last_payment_date;
              const formattedLastPaymentDate = rawLastPaymentDate
                ? new Date(rawLastPaymentDate).toLocaleDateString('en-GB')
                : null;
                
              return {
                ...player,
                id: player.player_id,
                last_payment_date: formattedLastPaymentDate,
                medical_visa_status: playerData?.medical_visa_status,
                medical_visa_issue_date: playerData?.medical_visa_issue_date
              };
            });
          } else {
            console.error("Error fetching payment dates:", paymentError);
          }
        }
        
        // Fetch player birthdates from parent_children table
        const { data: parentChildrenData, error: parentChildrenError } = await supabase
          .from('parent_children')
          .select('parent_id, full_name, birth_date')
          .eq('is_active', true);
          
        if (parentChildrenError) {
          console.error('Error fetching parent children data:', parentChildrenError);
        }
        
        // Fetch team creation dates for join date fallback
        const { data: teamsCreateDates, error: teamsCreateDatesError } = await supabase
          .from('teams')
          .select('id, created_at');
          
        if (teamsCreateDatesError) {
          console.error('Error fetching teams creation dates:', teamsCreateDatesError);
        }
        
        // Enhance player data with team creation dates and birthdates
        const enhancedPlayersData = (playersWithPaymentDates || []).map((player: any) => {
          // Find team creation date as fallback for player join date
          const teamCreationDate = teamsCreateDates?.find(t => t.id === player.team_id)?.created_at;
          
          // Find matching child record for birthdate
          const childRecord = parentChildrenData?.find(
            child => child.parent_id === player.parent_id && 
                    child.full_name.toLowerCase() === player.player_name.toLowerCase()
          );
          
          return {
            ...player,
            id: player.player_id,
            // Use team creation date as fallback if player has no creation date
            created_at: player.created_at || teamCreationDate,
            // Use birthdate from parent_children if available
            birth_date: childRecord?.birth_date || player.birth_date,
            // Include last_payment_date if present
            last_payment_date: player.last_payment_date || undefined,
            // Include medical visa fields - log the value for debugging
            medical_visa_status: (() => {
              const status = player.medical_visa_status;
              console.log(`[DEBUG] Player ${player.player_name} medical visa status: ${status}`);
              return status;
            })(),
            medical_visa_issue_date: player.medical_visa_issue_date
          };
        });
        
        setPlayers(enhancedPlayersData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
      setTeams([]);
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.horizontalTabsRow}>
        <View style={styles.horizontalTabsContainer}>
          <TouchableOpacity
            style={styles.horizontalTabButton}
            onPress={() => setActiveTab('teams')}
          >
            <Text style={[styles.horizontalTabText, activeTab === 'teams' && styles.horizontalTabTextActive]}>Teams</Text>
            {activeTab === 'teams' && <View style={styles.horizontalTabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.horizontalTabButton}
            onPress={() => setActiveTab('players')}
          >
            <Text style={[styles.horizontalTabText, activeTab === 'players' && styles.horizontalTabTextActive]}>Players</Text>
            {activeTab === 'players' && <View style={styles.horizontalTabUnderline} />}
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'teams' && (
        <CoachManageTeamsScreen
          teams={teams}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {activeTab === 'players' && (
        <CoachManagePlayersScreen
          players={players}
          teams={teams}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTeamId={selectedTeamId}
          onTeamSelect={setSelectedTeamId}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  horizontalTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  horizontalTabsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
    flex: 1,
  },
  horizontalTabButton: {
    alignItems: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 4,
  },
  horizontalTabText: {
    fontSize: 16,
    color: COLORS.grey[600],
    fontWeight: '400',
  },
  horizontalTabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  horizontalTabUnderline: {
    marginTop: 2,
    height: 4,
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
}); 