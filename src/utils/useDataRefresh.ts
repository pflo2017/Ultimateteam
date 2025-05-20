import { useEffect, useState, useRef } from 'react';
import { refreshTimestamps } from './events';

/**
 * Hook that triggers a refresh function when timestamps change
 * @param dataType The type of data to watch ('players', 'payments', etc.)
 * @param refreshFunction The function to call when data needs refreshing
 */
export const useDataRefresh = (dataType: string, refreshFunction: () => void) => {
  // Store the last refresh time to compare against
  const [lastRefreshTime, setLastRefreshTime] = useState(refreshTimestamps[dataType] || 0);
  const isInitialMount = useRef(true);
  // Store the refresh function in a ref to avoid dependency changes
  const refreshFunctionRef = useRef(refreshFunction);
  
  // Update the ref when refreshFunction changes
  useEffect(() => {
    refreshFunctionRef.current = refreshFunction;
  }, [refreshFunction]);
  
  useEffect(() => {
    // Skip the first render, since we already load data on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      console.log(`[useDataRefresh] Initialized for ${dataType}, current timestamp: ${refreshTimestamps[dataType]}`);
      return;
    }
    
    // Check if the timestamp has changed
    const currentTimestamp = refreshTimestamps[dataType];
    if (currentTimestamp > lastRefreshTime) {
      console.log(`[useDataRefresh] Data refresh triggered for ${dataType}. Last: ${lastRefreshTime}, Current: ${currentTimestamp}`);
      refreshFunctionRef.current();
      setLastRefreshTime(currentTimestamp);
    }
    
    // Set up a periodic check for timestamp changes
    const intervalId = setInterval(() => {
      const latestTimestamp = refreshTimestamps[dataType];
      if (latestTimestamp > lastRefreshTime) {
        console.log(`[useDataRefresh] Periodic refresh triggered for ${dataType}. Last: ${lastRefreshTime}, Current: ${latestTimestamp}`);
        refreshFunctionRef.current();
        setLastRefreshTime(latestTimestamp);
      }
    }, 500); // Check every 500ms for quicker responses
    
    return () => {
      clearInterval(intervalId);
    };
  }, [dataType, lastRefreshTime]);
  
  return null;
}; 