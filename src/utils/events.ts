/**
 * Simple event system for cross-component communication
 * Used for notifying components about data changes like payment status updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type EventCallback = (...args: any[]) => void;

// Store for event listeners
const listeners: Record<string, EventCallback[]> = {};

// Track refresh timestamps per data type
export const refreshTimestamps: Record<string, number> = {
  players: Date.now(),
  payments: Date.now(),
  teams: Date.now(),
};

// Debounce timers for refresh operations
const refreshDebounceTimers: Record<string, NodeJS.Timeout | null> = {
  players: null,
  payments: null,
  teams: null,
};

// Tracks if updates are in progress to prevent cascading
const refreshInProgress: Record<string, boolean> = {
  players: false,
  payments: false,
  teams: false,
};

const EVENT_STORE_KEY = '@event_listeners';

// List of available events - must add here to be valid
export type EventType = 
  | 'payments' 
  | 'players' 
  | 'teams' 
  | 'sessions' 
  | 'user_profile' 
  | 'chat_messages'
  | 'payment_status_changed'
  | 'payment_collection_added'
  | 'payment_collection_processed';

interface EventListener {
  id: string;
  eventType: EventType;
  lastTriggered: number;
}

/**
 * Register an event listener
 * @param event The event name to listen for
 * @param callback The callback to execute when the event is triggered
 * @returns A function to unregister the listener
 */
export const registerEventListener = (event: string, callback: EventCallback): () => void => {
  console.log(`[Events] Registering listener for event: ${event}`);
  
  if (!listeners[event]) {
    listeners[event] = [];
  }
  
  listeners[event].push(callback);
  
  return () => {
    console.log(`[Events] Unregistering listener for event: ${event}`);
    if (listeners[event]) {
      const index = listeners[event].indexOf(callback);
      if (index !== -1) {
        listeners[event].splice(index, 1);
      }
    }
  };
};

/**
 * Trigger an event
 * @param event The event name to trigger
 * @param args Arguments to pass to the event listeners
 */
export const triggerEvent = (event: string, ...args: any[]): void => {
  console.log(`[Events] Triggering event: ${event}`, ...args);
  
  if (!listeners[event]) {
    console.log(`[Events] No listeners registered for event: ${event}. Broadcasting anyway.`);
  } else {
    console.log(`[Events] Broadcasting to ${listeners[event].length} listeners`);
    
    listeners[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
  
  // Using debounced refresh to prevent cascading events
  
  // If this is a payment status change event, update refresh timestamps
  if (event === 'payment_status_changed') {
    console.log('[Events] Payment status changed - scheduling refresh for players and payments');
    // Use setTimeout to prevent immediate refresh cascading
    setTimeout(() => {
      debouncedForceRefresh('players');
      
      // Delay the second refresh to avoid simultaneous updates
      setTimeout(() => {
        debouncedForceRefresh('payments');
      }, 500);
    }, 300);
  }

  // Handle payment collection events
  if (event === 'payment_collection_added') {
    console.log('[Events] Payment collection added - scheduling refresh for payments');
    setTimeout(() => {
      debouncedForceRefresh('payments');
    }, 300);
  }

  if (event === 'payment_collection_processed') {
    console.log('[Events] Payment collection processed - scheduling refresh for players and payments');
    setTimeout(() => {
      debouncedForceRefresh('players');
      
      // Delay the second refresh to avoid simultaneous updates
      setTimeout(() => {
        debouncedForceRefresh('payments');
      }, 500);
    }, 300);
  }
};

/**
 * Debounced version of forceRefresh to prevent multiple rapid refreshes
 * @param dataType The type of data to refresh
 */
const debouncedForceRefresh = (dataType: string): void => {
  // Cancel any pending refresh for this data type
  if (refreshDebounceTimers[dataType]) {
    clearTimeout(refreshDebounceTimers[dataType]!);
  }
  
  // If refresh is already in progress, postpone
  if (refreshInProgress[dataType]) {
    console.log(`[Events] Refresh already in progress for ${dataType}, postponing`);
    
    // Schedule another check after 500ms
    refreshDebounceTimers[dataType] = setTimeout(() => {
      debouncedForceRefresh(dataType);
    }, 500);
    return;
  }
  
  // Schedule the refresh with debounce
  refreshDebounceTimers[dataType] = setTimeout(() => {
    // Set in-progress flag
    refreshInProgress[dataType] = true;
    
    // Perform the refresh
    forceRefresh(dataType);
    
    // Clear in-progress flag after a delay
    setTimeout(() => {
      refreshInProgress[dataType] = false;
    }, 1000);
    
    // Clear the timer reference
    refreshDebounceTimers[dataType] = null;
  }, 300);
};

/**
 * Force a refresh for specific data type by updating its timestamp
 * @param dataType The type of data to refresh
 */
export const forceRefresh = (dataType: string): void => {
  if (refreshTimestamps[dataType] !== undefined) {
    const oldTimestamp = refreshTimestamps[dataType];
    const newTimestamp = Date.now() + Math.random(); // Add random to prevent collisions
    refreshTimestamps[dataType] = newTimestamp;
    console.log(`[Events] Forcing refresh for ${dataType} - old timestamp: ${oldTimestamp}, new: ${newTimestamp}`);
  } else {
    console.warn(`[Events] Cannot force refresh for unknown data type: ${dataType}`);
  }
  
  console.log(`[Events] Current timestamps: players=${refreshTimestamps.players}, payments=${refreshTimestamps.payments}`);
}; 