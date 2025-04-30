
import { QueryClient } from '@tanstack/react-query';

// Function to safely invalidate and refetch queries by key pattern
export const invalidateAndRefetch = async (
  queryClient: QueryClient, 
  queryKeys: string[], 
  options = { 
    exact: false, 
    refetchType: 'active' as 'active' | 'all' | 'inactive', 
    delay: 0 
  }
) => {
  try {
    // First invalidate all matching queries
    const invalidatePromises = queryKeys.map(key => 
      queryClient.invalidateQueries({
        queryKey: [key],
        exact: options.exact,
        refetchType: options.refetchType
      })
    );
    
    await Promise.all(invalidatePromises);
    
    // Then optionally apply a delay
    if (options.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    
    // Finally explicitly refetch the queries
    const refetchPromises = queryKeys.map(key => 
      queryClient.refetchQueries({
        queryKey: [key],
        exact: options.exact,
        type: options.refetchType
      })
    );
    
    await Promise.all(refetchPromises);
    
    return true;
  } catch (error) {
    console.error('Error invalidating and refetching queries:', error);
    return false;
  }
};

// Function to clear the local storage cache for a specific key
export const clearLocalStorageCache = (key: string) => {
  try {
    // Look for any keys that start with the provided key
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(key)) {
        keysToRemove.push(storageKey);
      }
    }
    
    // Remove all matching keys
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    return keysToRemove.length;
  } catch (error) {
    console.error('Error clearing localStorage cache:', error);
    return 0;
  }
};

// Function to forcibly refresh the calendar data
export const forceCalendarRefresh = async (queryClient: QueryClient) => {
  try {
    // Force a hard refresh of all calendar-related data
    const keys = [
      'events', 
      'business-events', 
      'approved-bookings', 
      'eventFiles',
      'customerFiles'
    ];
    
    // First clear any local storage cache that might be causing issues
    keys.forEach(key => clearLocalStorageCache(key));
    
    // Then invalidate all queries
    await invalidateAndRefetch(queryClient, keys, {
      refetchType: 'all',
      delay: 100
    });
    
    return true;
  } catch (error) {
    console.error('Error forcing calendar refresh:', error);
    return false;
  }
};
