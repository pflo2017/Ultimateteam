// Fix for the attendance bug - Activity ID handling fix
// Replace this in your app's AttendanceService.js or similar file

// CURRENT PROBLEMATIC CODE (likely something like this):
/*
export const fetchAttendanceRecords = async (activityId, teamId) => {
  try {
    // This is wrong - it might be stripping date suffixes or using base IDs
    const baseActivityId = activityId.split('-').slice(0, 5).join('-');
    
    const { data, error } = await supabase
      .from('activity_attendance')
      .select('*')
      .eq('activity_id', baseActivityId); // WRONG: Using base ID instead of full ID
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    throw error;
  }
};
*/

// FIXED CODE - Use the exact activity ID including any date suffix
export const fetchAttendanceRecords = async (activityId, teamId) => {
  try {
    console.log('[AttendanceService] Fetching attendance for EXACT activity ID:', activityId);
    
    // Use the complete activity ID as provided - don't strip date suffixes
    const { data, error } = await supabase
      .from('activity_attendance')
      .select('*')
      .eq('activity_id', activityId); // FIXED: Using complete activity ID
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    throw error;
  }
};

// Additionally, ensure that when creating a new activity ID for a recurring activity,
// we always append the date to make it unique
export const generateActivityIdForDate = (baseActivityId, date) => {
  // Ensure we're using just the base ID (first 5 parts of UUID)
  const baseId = baseActivityId.split('-').slice(0, 5).join('-');
  
  // Format date as YYYYMMDD
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  
  // Return the combined ID
  return `${baseId}-${dateStr}`;
};

// When initializing a new attendance record, start with no preselected status
export const initializeAttendanceForm = async (activityId, teamId, date) => {
  // Generate the proper activity ID with date suffix
  const fullActivityId = generateActivityIdForDate(activityId, date);
  
  // Fetch players but DON'T fetch previous attendance records
  const players = await fetchTeamPlayers(teamId);
  
  // Return players with empty/null status - don't preselect anything
  return players.map(player => ({
    player_id: player.id,
    player_name: player.name,
    status: null, // Start with no status selected
    activity_id: fullActivityId
  }));
}; 