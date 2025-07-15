import { supabase } from '../lib/supabase';

export type ActivityEventType = 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'man_of_the_match';

export interface ActivityEvent {
  id?: string;
  activity_id: string;
  event_type: ActivityEventType;
  player_id?: string;
  assist_player_id?: string;
  minute?: number;
  half?: 'first' | 'second';
  man_of_the_match_id?: string;
  metadata?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Helper function to migrate old event types to new ones
const migrateEventType = (eventType: string): ActivityEventType => {
  switch (eventType) {
    case 'yellow':
      return 'yellow_card';
    case 'red':
      return 'red_card';
    case 'yellow_card':
    case 'red_card':
    case 'goal':
    case 'assist':
    case 'man_of_the_match':
      return eventType as ActivityEventType;
    default:
      return 'goal'; // fallback
  }
};

// Fetch all events for a given activity
export const getEventsForActivity = async (activityId: string) => {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  
  if (data) {
    // Migrate old event types to new ones
    const migratedData = data.map(event => ({
      ...event,
      event_type: migrateEventType(event.event_type)
    }));
    return { data: migratedData, error };
  }
  
  return { data, error };
};

// Replace all events for an activity (delete old, insert new)
export const addEventsForActivity = async (activityId: string, events: ActivityEvent[]) => {
  // Get current user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    console.error('No authenticated user for created_by');
    return { error: userError || new Error('No authenticated user') };
  }
  const userId = userData.user.id;

  // Delete existing events for this activity
  const { error: deleteError } = await supabase
    .from('activity_events')
    .delete()
    .eq('activity_id', activityId);
  if (deleteError) {
    console.error('Supabase delete error:', deleteError);
    return { error: deleteError };
  }

  if (events.length === 0) return { data: [], error: null };

  // Insert new events, remove id field to let database generate it automatically
  const insertEvents = events.map(e => {
    const { id, ...eventWithoutId } = e; // Remove id field
    return {
      ...eventWithoutId,
      activity_id: activityId,
      created_by: userId,
      event_type: migrateEventType(e.event_type)
    };
  });
  
  const { data, error } = await supabase
    .from('activity_events')
    .insert(insertEvents);
  if (error) {
    console.error('Supabase insert error:', error);
  }
  return { data, error };
};

// Add a single event to an activity (without deleting existing events)
export const addSingleEvent = async (event: ActivityEvent) => {
  // Get current user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    console.error('No authenticated user for created_by');
    return { error: userError || new Error('No authenticated user') };
  }
  const userId = userData.user.id;

  // Remove id field to let database generate it automatically
  const { id, ...eventWithoutId } = event;
  const insertEvent = {
    ...eventWithoutId,
    created_by: userId,
    event_type: migrateEventType(event.event_type)
  };
  
  const { data, error } = await supabase
    .from('activity_events')
    .insert(insertEvent);
  if (error) {
    console.error('Supabase insert error:', error);
  }
  return { data, error };
};

// Delete all events for an activity
export const deleteEventsForActivity = async (activityId: string) => {
  const { error } = await supabase
    .from('activity_events')
    .delete()
    .eq('activity_id', activityId);
  return { error };
}; 