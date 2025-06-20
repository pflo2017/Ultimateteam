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
    
    // First get all activities for this team
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, title, type, start_time')
      .eq('team_id', teamId)
      .order('start_time', { ascending: false });
    
    if (activitiesError) {
      console.error('Error loading activities for team', teamId, ':', activitiesError);
      throw activitiesError;
    }
    
    // Filter activities by type if needed
    let filteredActivities = activities || [];
    if (activityType && activityType !== 'all') {
      filteredActivities = filteredActivities.filter(act => act.type === activityType);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filteredActivities = filteredActivities.filter(act => {
        const actDate = new Date(act.start_time);
        let isInRange = true;
        
        if (startDate) {
          const startDateObj = new Date(startDate);
          isInRange = isInRange && actDate >= startDateObj;
        }
        
        if (endDate) {
          const endDateObj = new Date(endDate);
          isInRange = isInRange && actDate <= endDateObj;
        }
        
        return isInRange;
      });
    }
    
    if (filteredActivities.length === 0) {
      return [];
    }
    
    // Get all activity IDs (including base IDs)
    const activityIds = filteredActivities.map(a => a.id);
    
    // Now get attendance records for these players and activities
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('activity_attendance')
      .select('player_id, status, activity_id')
      .in('player_id', playerIds);
    
    if (attendanceError) {
      console.error('Error loading attendance records:', attendanceError);
      throw attendanceError;
    }
    
    // Create a map of activity data for easy lookup
    const activityMap = new Map();
    filteredActivities.forEach(act => {
      activityMap.set(act.id, {
        id: act.id,
        title: act.title,
        type: act.type,
        start_time: act.start_time
      });
    });
    
    // Filter attendance records to only include those for our filtered activities
    // This includes handling composite IDs (with date suffixes)
    const relevantAttendance = (attendanceData || []).filter(record => {
      // Extract base ID if it's a composite ID
      const baseId = record.activity_id.includes('-202') 
        ? record.activity_id.substring(0, 36)
        : record.activity_id;
      
      return activityIds.includes(baseId);
    });
    
    // Enrich attendance data with activity information
    const enrichedAttendance = relevantAttendance.map(record => {
      // Extract base ID if it's a composite ID
      const baseId = record.activity_id.includes('-202') 
        ? record.activity_id.substring(0, 36)
        : record.activity_id;
      
      const activityInfo = activityMap.get(baseId);
      
      return {
        ...record,
        activity_title: activityInfo?.title || 'Unknown Activity',
        activity_type: activityInfo?.type || 'other',
        actual_activity_date: activityInfo?.start_time || new Date().toISOString()
      };
    });
    
    return enrichedAttendance;
  } catch (error) {
    console.error('Error in fetchTeamAttendanceStats:', error);
    throw error;
  }
}; 