import { useEffect, useState, useRef } from 'react';
import { refreshTimestamps } from './events';

/**
 * Hook that triggers a refresh function when timestamps change
 * Includes debouncing to prevent too frequent refreshes
 * 
 * @param dataType The type of data to watch ('players', 'payments', etc.)
 * @param refreshFunction The function to call when data needs refreshing
 */
export const useDataRefresh = (dataType: string, refreshFunction: () => void) => {
  // Store the last refresh time to compare against
  const [lastRefreshTime, setLastRefreshTime] = useState(refreshTimestamps[dataType] || 0);
  const isInitialMount = useRef(true);
  
  // Store the refresh function in a ref to avoid dependency changes
  const refreshFunctionRef = useRef(refreshFunction);
  
  // Track if a refresh is in progress
  const isRefreshing = useRef(false);
  
  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimum time between refreshes (in ms)
  const MIN_REFRESH_INTERVAL = 1000;
  
  // Update the ref when refreshFunction changes
  useEffect(() => {
    refreshFunctionRef.current = refreshFunction;
  }, [refreshFunction]);
  
  // Function to perform the actual refresh with safety checks
  const performRefresh = () => {
    // Skip if already refreshing
    if (isRefreshing.current) {
      console.log(`[useDataRefresh] Skipping refresh for ${dataType} - refresh already in progress`);
      return;
    }
    
    // Set refreshing flag
    isRefreshing.current = true;
    
    try {
      // Get current timestamp before refresh
      const currentTimestamp = refreshTimestamps[dataType];
      console.log(`[useDataRefresh] Performing refresh for ${dataType}`);
      
      // Call the refresh function
      refreshFunctionRef.current();
      
      // Update last refresh time
      setLastRefreshTime(currentTimestamp);
    } catch (error) {
      console.error(`[useDataRefresh] Error refreshing ${dataType}:`, error);
    } finally {
      // Clear refreshing flag after a short delay to prevent immediate re-triggers
      setTimeout(() => {
        isRefreshing.current = false;
      }, 300);
    }
  };
  
  // Debounced refresh function
  const debouncedRefresh = () => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performRefresh();
    }, 300); // 300ms debounce
  };
  
  useEffect(() => {
    // Skip the first render, since we already load data on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      console.log(`[useDataRefresh] Initialized for ${dataType}, current timestamp: ${refreshTimestamps[dataType]}`);
      return;
    }
    
    // Check if the timestamp has changed and enough time has passed since last refresh
    const currentTimestamp = refreshTimestamps[dataType];
    const timeSinceLastRefresh = Date.now() - lastRefreshTime;
    
    if (currentTimestamp > lastRefreshTime && timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
      console.log(`[useDataRefresh] Data refresh triggered for ${dataType}. Last: ${lastRefreshTime}, Current: ${currentTimestamp}`);
      debouncedRefresh();
    }
    
    // Set up a check with reduced frequency (1 second intervals instead of 500ms)
    const intervalId = setInterval(() => {
      const latestTimestamp = refreshTimestamps[dataType];
      const timeSinceLastRefresh = Date.now() - lastRefreshTime;
      
      if (latestTimestamp > lastRefreshTime && timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
        console.log(`[useDataRefresh] Periodic refresh triggered for ${dataType}. Last: ${lastRefreshTime}, Current: ${latestTimestamp}`);
        debouncedRefresh();
      }
    }, 1000); // Check every 1000ms for better performance
    
    return () => {
      // Clear interval and any pending debounce timer
      clearInterval(intervalId);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [dataType, lastRefreshTime]);
  
  return null;
}; 