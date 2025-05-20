/**
 * Simple event system for cross-component communication
 * Used for notifying components about data changes like payment status updates
 */

type EventCallback = (...args: any[]) => void;

// Store for event listeners
const listeners: Record<string, EventCallback[]> = {};

// Track refresh timestamps per data type
export const refreshTimestamps: Record<string, number> = {
  players: Date.now(),
  payments: Date.now(),
  teams: Date.now(),
};

/**
 * Add an event listener
 * @param event The event name to listen for
 * @param callback Function to call when the event is triggered
 */
export const addListener = (event: string, callback: EventCallback): void => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
};

/**
 * Remove an event listener
 * @param event The event name
 * @param callback The callback function to remove
 */
export const removeListener = (event: string, callback: EventCallback): void => {
  if (!listeners[event]) return;
  
  const index = listeners[event].indexOf(callback);
  if (index !== -1) {
    listeners[event].splice(index, 1);
  }
  
  // Clean up empty event arrays
  if (listeners[event].length === 0) {
    delete listeners[event];
  }
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
};

/**
 * Force data refresh by updating the refresh timestamp
 * Components should check this timestamp to know when to refresh their data
 * @param dataType The type of data to refresh ('players', 'payments', etc.)
 */
export const forceRefresh = (dataType: string): void => {
  // Use Date.now() + a small random number to ensure it's always different
  // This helps prevent issues where multiple calls in the same millisecond might not trigger an update
  const timestamp = Date.now() + Math.floor(Math.random() * 1000);
  
  // Log before setting the timestamp
  console.log(`[Events] Force refresh for ${dataType}: Old:${refreshTimestamps[dataType]}, New:${timestamp}`);
  
  // Set the timestamp
  refreshTimestamps[dataType] = timestamp;
  
  // Log all timestamps for debugging
  console.log(`[Events] Current timestamps: players=${refreshTimestamps.players}, payments=${refreshTimestamps.payments}`);
}; 