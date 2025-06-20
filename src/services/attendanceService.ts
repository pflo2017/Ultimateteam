import { supabase } from '../lib/supabase';
import { generateActivityIdForDate } from './activitiesService';

// Define Player type inline instead of importing it
interface Player {
  id: string;
  name: string;
  team_id: string;
}

// FIXED CODE - Use the exact activity ID including any date suffix
export const fetchAttendanceRecords = async (
  activityId: string,
  teamId?: string
): Promise<any[]> => {
  try {
    console.log('[AttendanceService] Fetching attendance for EXACT activity ID:', activityId);
    
    // Use the complete activity ID as provided - don't strip date suffixes
    const { data, error } = await supabase
      .from('activity_attendance')
      .select('*')
      .eq('activity_id', activityId); // FIXED: Using complete activity ID
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    throw error;
  }
};

// Additionally, ensure that when creating a new activity ID for a recurring activity,
// we always append the date to make it unique
export const fetchPlayerAttendanceStats = async (
  playerId: string,
  teamId?: string,
  startDate?: string,
  endDate?: string,
  activityType?: string
): Promise<any> => {
  try {
    console.log(`[AttendanceService] Fetching attendance stats for player: ${playerId}`);
    
    // Use the attendance_with_correct_dates view that handles composite IDs
    let query = supabase
      .from('attendance_with_correct_dates')
      .select('*')
      .eq('player_id', playerId);
    
    // NOTE: Removed team_id filter as the view doesn't have this column
    // We'll filter by activity type and date range only
    
    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType);
    }
    
    if (startDate) {
      query = query.gte('actual_activity_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('actual_activity_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to fetch attendance: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in fetchPlayerAttendanceStats:', error);
    throw error;
  }
};

// When initializing a new attendance record, start with no preselected status
export const initializeAttendanceForm = async (
  activityId: string, 
  teamId: string, 
  date: Date
): Promise<any[]> => {
  try {
    // Generate the proper activity ID with date suffix
    const fullActivityId = generateActivityIdForDate(activityId, date);
    
    // Fetch players for the team
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    // Return players with empty/null status - don't preselect anything
    return (players || []).map(player => ({
      player_id: player.id,
      player_name: player.name,
      status: null, // Start with no status selected
      activity_id: fullActivityId
    }));
  } catch (error) {
    console.error('Error initializing attendance form:', error);
    throw error;
  }
};

// Fetch team attendance statistics
export const fetchTeamAttendanceStats = async (
  teamId: string,
  startDate?: string,
  endDate?: string,
  activityType?: string
): Promise<any> => {
  try {
    console.log(`[AttendanceService] Fetching team attendance stats for team: ${teamId}`);
    
    // First get all players for the team
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_active', true);
    
    if (playersError) {
      console.error('Error loading players for team', teamId, ':', playersError);
      throw playersError;
    }
    
    if (!players || players.length === 0) {
      return [];
    }
    
    // Get player IDs
    const playerIds = players.map(p => p.id);
    
    // Use the attendance_with_correct_dates view that handles composite IDs
    let query = supabase
      .from('attendance_with_correct_dates')
      .select(`
        player_id,
        player_name,
        status,
        activity_id,
        activity_title,
        activity_type,
        actual_activity_date
      `)
      .in('player_id', playerIds); // Filter by player IDs instead of team_id
    
    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType);
    }
    
    if (startDate) {
      query = query.gte('actual_activity_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('actual_activity_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error loading attendance for team', teamId, ':', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in fetchTeamAttendanceStats:', error);
    throw error;
  }
}; 