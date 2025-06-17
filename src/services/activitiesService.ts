import { supabase } from '../lib/supabase';
import { addDays, addWeeks, addMonths, format, parseISO, isBefore, isAfter, isSameDay, getDay } from 'date-fns';

// Add helper function to get user's club_id
export const getUserClubId = async (): Promise<string | null> => {
  try {
    // DIRECT FIX: Add more debugging
    console.log('[getUserClubId] Starting club ID lookup...');
    
    // First try to get admin data from AsyncStorage
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const adminDataStr = await AsyncStorage.getItem('admin_data');
      console.log('[getUserClubId] Admin data from AsyncStorage:', adminDataStr ? 'Found' : 'Not found');
      
      if (adminDataStr) {
        const adminData = JSON.parse(adminDataStr);
        if (adminData.club_id) {
          console.log('[getUserClubId] Found club_id in admin_data:', adminData.club_id);
          return adminData.club_id;
        } else {
          console.log('[getUserClubId] admin_data found but no club_id in it');
        }
      }
    } catch (e) {
      console.log('[getUserClubId] Error reading admin_data from AsyncStorage:', e);
    }
    
    // Check if user is authenticated via Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[getUserClubId] No authenticated user found');
      return null;
    }
    
    console.log('[getUserClubId] Authenticated user found:', user.id);

    // Try to get club_id if user is an admin
    let { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .single();
    
    if (clubError) {
      console.log('[getUserClubId] Error or no result when checking if user is admin:', clubError.message);
    }

    if (club) {
      console.log('[getUserClubId] Found club via admin_id:', club.id);
      
      // DIRECT FIX: Save to AsyncStorage for future use
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const adminDataStr = await AsyncStorage.getItem('admin_data');
        if (adminDataStr) {
          const adminData = JSON.parse(adminDataStr);
          if (!adminData.club_id) {
            adminData.club_id = club.id;
            await AsyncStorage.setItem('admin_data', JSON.stringify(adminData));
            console.log('[getUserClubId] Updated admin_data with club_id:', club.id);
          }
        }
      } catch (e) {
        console.log('[getUserClubId] Error updating admin_data in AsyncStorage:', e);
      }
      
      return club.id;
    }

    // If not an admin, check if user is a coach
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('club_id')
      .eq('user_id', user.id)
      .single();
    
    if (coachError) {
      console.log('[getUserClubId] Error or no result when checking if user is coach:', coachError.message);
    }

    if (coach) {
      console.log('[getUserClubId] Found club via coach:', coach.club_id);
      return coach.club_id;
    }

    console.log('[getUserClubId] No club association found for user');
    return null;
  } catch (error) {
    console.error('[getUserClubId] Error getting user club ID:', error);
    return null;
  }
};

export type ActivityType = 'training' | 'game' | 'tournament' | 'other';

export interface Activity {
  id: string;
  title: string;
  location: string;
  start_time: string; // ISO date string
  end_time?: string; // ISO date string
  duration: string;
  type: ActivityType;
  created_by: string;
  team_id?: string;
  team_name?: string;
  teams?: { name: string } | null;
  is_public: boolean;
  additional_info?: string;
  private_notes?: string;
  invitation_setting?: string;
  rsvp_by?: string;
  slots?: number;
  created_at?: string;
  // Repeat schedule fields
  is_repeating?: boolean;
  repeat_type?: 'daily' | 'weekly' | 'monthly';
  repeat_days?: number[]; // 0 = Sunday, 1 = Monday, etc.
  repeat_until?: string; // ISO date string
  // For recurring instances
  parent_activity_id?: string;
  is_recurring_instance?: boolean;
  // Game specific fields
  home_away?: 'home' | 'away';
  lineup_players?: string[]; // Array of player IDs
  home_score?: number;
  away_score?: number;
}

interface ActivityResponse {
  data: Activity | null;
  error: Error | null;
}

interface ActivitiesResponse {
  data: Activity[] | null;
  error: Error | null;
}

/**
 * Create a new activity
 */
export const createActivity = async (activityData: Omit<Activity, 'id' | 'created_at'>): Promise<ActivityResponse> => {
  try {
    // Get user's club_id
    const clubId = await getUserClubId();
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    // Add club_id to activity data
    const dataWithClubId = {
      ...activityData,
      club_id: clubId
    };

    const { data, error } = await supabase
      .from('activities')
      .insert(dataWithClubId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error creating activity:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Update an existing activity
 */
export const updateActivity = async (id: string, activityData: Partial<Activity>): Promise<ActivityResponse> => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(activityData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating activity:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Delete an activity and all associated data
 * This ensures complete removal of the activity and all its related records
 */
export const deleteActivity = async (id: string): Promise<{ error: Error | null }> => {
  try {
    console.log(`Deleting activity with ID: ${id}`);
    
    // Handle composite IDs (UUID-date format)
    let baseId = id;
    let isCompositeId = false;
    
    // Check if this is a composite ID (UUID + date suffix)
    if (id.includes('-') && id.length > 36) {
      baseId = id.substring(0, 36);
      isCompositeId = true;
      console.log(`Composite ID detected. Base ID: ${baseId}, Full ID: ${id}`);
    }
    
    // First check if this is a game activity to properly handle game-specific data
    const { data: activityData, error: activityError } = await supabase
      .from('activities')
      .select('type, lineup_players, is_repeating, team_id')
      .eq('id', baseId) // Use baseId for the activities table
      .single();
    
    if (activityError) {
      console.error('Error fetching activity data before deletion:', activityError);
      // Continue with deletion even if we can't fetch the activity data
    }
    
    if (activityData) {
      console.log(`Deleting activity - Type: ${activityData.type}, Team ID: ${activityData.team_id}, Has lineup: ${!!activityData.lineup_players?.length}, Is repeating: ${activityData.is_repeating}`);
    }
    
    // Start deleting all related data
    
    // 1. Delete attendance records - use the full composite ID for attendance
    console.log('Deleting official attendance records (marked by coach)');
    const { error: attendanceError } = await supabase
      .from('activity_attendance')
      .delete()
      .eq('activity_id', id); // Use the full ID here
    
    if (attendanceError) {
      console.error('Error deleting attendance records:', attendanceError);
      // Don't throw, continue with other deletions
    }
    
    // 2. Delete presence responses (RSVP)
    console.log('Deleting presence responses (RSVPs from parents/players)');
    const { error: presenceError } = await supabase
      .from('activity_presence')
      .delete()
      .eq('activity_id', id); // Use the full ID here
    
    if (presenceError) {
      console.error('Error deleting presence records:', presenceError);
      // Continue with deletion even if presence deletion fails
    }
    
    // If this is a composite ID, we're done - we don't delete the base activity
    if (isCompositeId) {
      console.log(`Composite activity instance deleted: ${id}`);
      return { error: null };
    }
    
    // 3. If this is a recurring activity, delete all its instances
    if (activityData?.is_repeating) {
      console.log(`Deleting recurring instances for activity: ${baseId}`);
      
      try {
        // Use a different approach - get all activities and filter on the client side
        const { data: allActivities, error: fetchError } = await supabase
          .from('activities')
          .select('id');
        
        if (fetchError) {
          console.error('Error fetching activities for recurring instance check:', fetchError);
        } else if (allActivities) {
          // Filter instances on the client side by checking if they start with baseId + "-"
          const recurringInstances = allActivities.filter(
            activity => typeof activity.id === 'string' && 
                       activity.id.startsWith(baseId + '-')
          );
          
          console.log(`Found ${recurringInstances.length} recurring instances to delete`);
          
          // Delete each instance individually
          for (const instance of recurringInstances) {
            const { error: deleteError } = await supabase
              .from('activities')
              .delete()
              .eq('id', instance.id);
            
            if (deleteError) {
              console.error(`Error deleting recurring instance ${instance.id}:`, deleteError);
            } else {
              console.log(`Successfully deleted recurring instance: ${instance.id}`);
            }
          }
        }
      } catch (err) {
        console.error('Error processing recurring instances:', err);
      }
    }
    
    // 4. Finally delete the activity itself
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', baseId);
    
    if (error) throw error;
    
    console.log(`Activity and all related data successfully deleted: ${id}`);
    return { error: null };
  } catch (error) {
    console.error('Error in deleteActivity:', error);
    return { error: error as Error };
  }
};

/**
 * Get all activities
 */
export const getActivities = async (): Promise<ActivitiesResponse> => {
  try {
    // Get user's club_id
    const clubId = await getUserClubId();
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('club_id', clubId)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching activities:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get activities for a specific team
 */
export const getTeamActivities = async (teamId: string): Promise<ActivitiesResponse> => {
  try {
    // Get user's club_id
    const clubId = await getUserClubId();
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('team_id', teamId)
      .eq('club_id', clubId)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching team activities:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Generate recurring activity instances based on repeat pattern
 */
const generateRecurringInstances = (activity: Activity, startDate: string, endDate: string): Activity[] => {
  if (!activity.is_repeating || !activity.repeat_type || !activity.repeat_until || !activity.id) {
    return [];
  }

  const instances: Activity[] = [];
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const repeatUntil = parseISO(activity.repeat_until);
  const activityStart = parseISO(activity.start_time);
  
  // Don't process if the original activity is outside our range
  if (isAfter(activityStart, end) || isAfter(start, repeatUntil)) {
    return [];
  }

  let currentDate = activityStart;
  
  while (isBefore(currentDate, repeatUntil) || isSameDay(currentDate, repeatUntil)) {
    // Skip the original instance as it's already in the data
    if (!isSameDay(currentDate, activityStart)) {
      // For weekly recurrence, check if this day of week is included
      if (activity.repeat_type === 'weekly' && activity.repeat_days) {
        const dayOfWeek = getDay(currentDate);
        if (!activity.repeat_days.includes(dayOfWeek)) {
          // Skip this date if it's not in the repeat days
          currentDate = addDays(currentDate, 1);
          continue;
        }
      }
      
      // Only include dates that fall within our query range
      if ((isBefore(currentDate, end) || isSameDay(currentDate, end)) && 
          (isAfter(currentDate, start) || isSameDay(currentDate, start))) {
        
        // Calculate the time difference to maintain same time of day
        const timeDiff = currentDate.getTime() - activityStart.getTime();
        
        // Create a unique, predictable ID for the recurring instance
        const formattedDate = format(currentDate, 'yyyyMMdd');
        const instanceId = `${activity.id}-${formattedDate}`;
        
        const instance: Activity = {
          ...activity,
          id: instanceId,
          start_time: new Date(parseISO(activity.start_time).getTime() + timeDiff).toISOString(),
          parent_activity_id: activity.id,
          is_recurring_instance: true
        };
        
        // If end_time exists, adjust it too
        if (activity.end_time) {
          instance.end_time = new Date(parseISO(activity.end_time).getTime() + timeDiff).toISOString();
        }
        
        instances.push(instance);
      }
    }
    
    // Advance to next occurrence based on repeat type
    switch (activity.repeat_type) {
      case 'daily':
        currentDate = addDays(currentDate, 1);
        break;
      case 'weekly':
        if (activity.repeat_days) {
          currentDate = addDays(currentDate, 1);
        } else {
          currentDate = addWeeks(currentDate, 1);
        }
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
      default:
        currentDate = addDays(currentDate, 1);
    }
  }
  
  return instances;
};

/**
 * Get activities for a specific date range
 */
export const getActivitiesByDateRange = async (startDate: string, endDate: string, teamId?: string): Promise<ActivitiesResponse> => {
  try {
    // Try to get user's club_id as usual
    let clubId = await getUserClubId();
    let isParent = false;
    let teamIds: string[] = [];

    // If no clubId, check if user is a parent
    if (!clubId) {
      // Try to get parent data from AsyncStorage (React Native only)
      let parentId: string | null = null;
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const parentDataStr = await AsyncStorage.getItem('parent_data');
        if (parentDataStr) {
          const parentData = JSON.parse(parentDataStr);
          parentId = parentData.id;
          console.log('[activitiesService] Parent detected, id:', parentId);
        } else {
          console.log('[activitiesService] No parent_data found in AsyncStorage');
        }
      } catch (e) {
        parentId = null;
        console.log('[activitiesService] Error reading parent_data from AsyncStorage:', e);
      }
      if (parentId) {
        isParent = true;
        // Get all children for this parent
        const { data: children, error: childrenError } = await supabase
          .from('parent_children')
          .select('team_id')
          .eq('parent_id', parentId)
          .eq('is_active', true);
        if (!childrenError && children && children.length > 0) {
          teamIds = Array.from(new Set(children.map((c: any) => c.team_id).filter(Boolean)));
          console.log('[activitiesService] Parent teamIds:', teamIds);
        } else {
          console.log('[activitiesService] No teams found for parent:', parentId);
        }
      }
    }

    // If parent and has teamIds, fetch activities for those teams
    if (isParent) {
      if (teamIds.length === 0) {
        console.log('[activitiesService] Parent has no teams, returning empty activities array');
        return { data: [], error: null };
      }
      // Fetch activities for all teams in the date range
      let allActivities: Activity[] = [];
      for (const tId of teamIds) {
        let query = supabase
          .from('activities')
          .select('*, teams(name)')
          .eq('team_id', tId)
          .or(`start_time.gte.${startDate},repeat_until.gte.${startDate}`)
          .order('start_time', { ascending: true });
        const { data, error } = await query;
        if (!error && data) {
          allActivities = [...allActivities, ...data];
        }
      }
      // Process recurring activities
      let expandedActivities: Activity[] = [...allActivities];
      allActivities.forEach(activity => {
        if (activity.is_repeating) {
          const instances = generateRecurringInstances(activity, startDate, endDate);
          expandedActivities = [...expandedActivities, ...instances];
        }
      });
      // Filter to include only activities that fall within the date range
      const filteredActivities = expandedActivities.filter(activity => {
        const activityDate = parseISO(activity.start_time);
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        return (isBefore(activityDate, end) || isSameDay(activityDate, end)) && 
               (isAfter(activityDate, start) || isSameDay(activityDate, start));
      });
      return { data: filteredActivities, error: null };
    }

    // Default: original logic for admin/coach
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    // Get stored activities from the database
    let query = supabase
      .from('activities')
      .select('*, teams(name)')
      .eq('club_id', clubId)
      .or(`start_time.gte.${startDate},repeat_until.gte.${startDate}`)
      .order('start_time', { ascending: true });

    // Add team filter if teamId is provided
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    if (!data) {
      return { data: [], error: null };
    }
    
    // Process recurring activities to include all instances
    let expandedActivities: Activity[] = [...data];
    
    // Generate recurring instances for each repeating activity
    data.forEach(activity => {
      if (activity.is_repeating) {
        const instances = generateRecurringInstances(activity, startDate, endDate);
        expandedActivities = [...expandedActivities, ...instances];
      }
    });
    
    // Filter to include only activities that fall within the date range
    const filteredActivities = expandedActivities.filter(activity => {
      const activityDate = parseISO(activity.start_time);
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      
      return (isBefore(activityDate, end) || isSameDay(activityDate, end)) && 
             (isAfter(activityDate, start) || isSameDay(activityDate, start));
    });
    
    return { data: filteredActivities, error: null };
  } catch (error) {
    console.error('Error fetching activities by date range:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get a single activity by ID
 */
export const getActivityById = async (id: string): Promise<ActivityResponse> => {
  try {
    console.log(`Getting activity by ID: ${id}`);
    
    // Handle composite IDs (UUID-date format)
    let baseId = id;
    
    // Check if this is a composite ID (UUID + date suffix)
    const compositeIdMatch = id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d{8})$/i);
    
    if (compositeIdMatch) {
      baseId = compositeIdMatch[1];
      const datePortion = compositeIdMatch[2];
      console.log(`Composite ID detected. Base ID: ${baseId}, Date portion: ${datePortion}`);
      
      // Fetch the parent activity by base UUID
      const { data: parentActivity, error: parentError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', baseId)
        .maybeSingle();
        
      if (parentError) throw parentError;
      if (!parentActivity) return { data: null, error: new Error('Parent activity not found') };
      
      // Reconstruct the instance details
      const year = parseInt(datePortion.substring(0, 4));
      const month = parseInt(datePortion.substring(4, 6)) - 1;
      const day = parseInt(datePortion.substring(6, 8));
      const instanceDate = new Date(year, month, day);
      const startDate = new Date(parentActivity.start_time);
      
      let activityInstance = { ...parentActivity };
      
      // Adjust the start time for this instance
      const newStartTime = new Date(instanceDate);
      newStartTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
      activityInstance.start_time = newStartTime.toISOString();
      activityInstance.id = id; // Set the composite ID
      activityInstance.parent_activity_id = baseId;
      activityInstance.is_recurring_instance = true;
      
      // Adjust end_time if present
      if (parentActivity.end_time) {
        const origStart = new Date(parentActivity.start_time);
        const origEnd = new Date(parentActivity.end_time);
        const durationMs = origEnd.getTime() - origStart.getTime();
        const newEndTime = new Date(newStartTime.getTime() + durationMs);
        activityInstance.end_time = newEndTime.toISOString();
      }
      
      console.log(`Successfully retrieved composite activity: ${id}`);
      return { data: activityInstance, error: null };
    }

    // Standard activity lookup for non-composite IDs
    let clubId = await getUserClubId();
    if (clubId) {
      // Admin/coach: fetch by club
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', baseId) // Use baseId which is the same as id for non-composite IDs
        .eq('club_id', clubId)
        .single();
        
      if (error) throw error;
      console.log(`Successfully retrieved standard activity: ${id}`);
      return { data, error: null };
    }

    // If not admin/coach, check if user is a parent
    let parentId: string | null = null;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const parentDataStr = await AsyncStorage.getItem('parent_data');
      if (parentDataStr) {
        const parentData = JSON.parse(parentDataStr);
        parentId = parentData.id;
      }
    } catch (e) {
      parentId = null;
    }
    
    if (parentId) {
      // Get all children for this parent
      const { data: children, error: childrenError } = await supabase
        .from('parent_children')
        .select('team_id')
        .eq('parent_id', parentId)
        .eq('is_active', true);
        
      if (!childrenError && children && children.length > 0) {
        const teamIds = Array.from(new Set(children.map((c: any) => c.team_id).filter(Boolean)));
        
        if (teamIds.length > 0) {
          // Fetch the activity if it belongs to one of the parent's children teams
          const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('id', baseId) // Use baseId which is the same as id for non-composite IDs
            .in('team_id', teamIds)
            .maybeSingle();
            
          if (error) throw error;
          if (data) return { data, error: null };
        }
      }
    }

    throw new Error('User not associated with a club or with a team via their children');
  } catch (error) {
    console.error('Error fetching activity:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get players for a specific team
 */
export const getPlayersByTeamId = async (teamId: string): Promise<{ data: any[] | null; error: Error | null }> => {
  try {
    // Get user's club_id
    const clubId = await getUserClubId();
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching players by team:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Update game score for an activity
 */
export const updateGameScore = async (activityId: string, homeScore: number, awayScore: number): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('activities')
      .update({
        home_score: homeScore,
        away_score: awayScore
      })
      .eq('id', activityId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error updating game score:', error);
    return { error: error as Error };
  }
}; 