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
  
  // If this is a payment status change event, update refresh timestamps
  // ALWAYS UPDATE TIMESTAMPS EVEN IF NO LISTENERS
  if (event === 'payment_status_changed') {
    console.log('[Events] Payment status changed - forcing refresh for players and payments');
    forceRefresh('players');
    forceRefresh('payments');
  }

  // Handle payment collection events
  if (event === 'payment_collection_added') {
    console.log('[Events] Payment collection added - forcing refresh for payments');
    forceRefresh('payments');
  }

  if (event === 'payment_collection_processed') {
    console.log('[Events] Payment collection processed - forcing refresh for players and payments');
    forceRefresh('players');
    forceRefresh('payments');
  }
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