import { supabase } from '../lib/supabase';
import { addDays, addWeeks, addMonths, format, parseISO, isBefore, isAfter, isSameDay, getDay } from 'date-fns';

// Add helper function to get user's club_id
export const getUserClubId = async (): Promise<string | null> => {
  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // First try to get club_id if user is an admin
    let { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .single();

    if (club) return club.id;

    // If not an admin, check if user is a coach
    const { data: coach } = await supabase
      .from('coaches')
      .select('club_id')
      .eq('id', user.id)
      .single();

    if (coach) return coach.club_id;

    return null;
  } catch (error) {
    console.error('Error getting user club ID:', error);
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
 * Delete an activity
 */
export const deleteActivity = async (id: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting activity:', error);
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
    // Get user's club_id
    const clubId = await getUserClubId();
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
    // Get user's club_id
    const clubId = await getUserClubId();
    if (!clubId) {
      throw new Error('User not associated with a club');
    }

    // Handle virtual recurring instances
    if (id.includes('-')) {
      // Check if this is a standard UUID
      const isStandardUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isStandardUuid) {
        // Regular activity lookup
        const { data, error } = await supabase
          .from('activities')
          .select('*')
          .eq('id', id)
          .eq('club_id', clubId)
          .single();

        if (error) throw error;
        return { data, error: null };
      }
      
      // This is a composite ID for a recurring instance
      // Format should be: {parentUUID}-{yyyyMMdd}
      // Extract the parent UUID portion
      const parentIdMatch = id.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      
      if (!parentIdMatch || !parentIdMatch[1]) {
        throw new Error(`Could not extract valid parent UUID from ID: ${id}`);
      }
      
      const parentId = parentIdMatch[1];
      
      // Get the parent activity
      const { data: parentActivity, error: parentError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', parentId)
        .eq('club_id', clubId)
        .single();
        
      if (parentError) throw parentError;
      if (!parentActivity) throw new Error('Parent activity not found');
      
      // Extract the date portion (should be after the UUID)
      const datePortion = id.substring(parentId.length + 1);
      
      // Convert the date portion to a Date
      const year = parseInt(datePortion.substring(0, 4));
      const month = parseInt(datePortion.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(datePortion.substring(6, 8));
      
      const instanceDate = new Date(year, month, day);
      
      // Calculate how many recurrences from the start date
      const startDate = new Date(parentActivity.start_time);
      
      // Create a specific instance for this date
      let activityInstance = { ...parentActivity };
      
      // Adjust the start time for this instance
      const newStartTime = new Date(instanceDate);
      newStartTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
      
      activityInstance.start_time = newStartTime.toISOString();
      activityInstance.id = id; // Set the composite ID
      
      return { data: activityInstance, error: null };
    } else {
      // Standard activity lookup
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .eq('club_id', clubId)
        .single();

      if (error) throw error;
      return { data, error: null };
    }
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