
import { QueryClient } from '@tanstack/react-query';

// Helper function to get all keys for a query that match a pattern
export const getAllMatchingQueryKeys = (queryClient: QueryClient, pattern: RegExp): string[][] => {
  return queryClient
    .getQueryCache()
    .getAll()
    .map(query => query.queryKey as string[])
    .filter(key => pattern.test(JSON.stringify(key)));
};

// Helper function to invalidate all queries that match a pattern
export const invalidateMatchingQueries = async (
  queryClient: QueryClient, 
  pattern: RegExp, 
  options?: { exact?: boolean; refetchType?: 'active' | 'inactive' | 'all'; delay?: number }
): Promise<void> => {
  const defaultOptions = {
    exact: false, 
    refetchType: 'all' as const,
    delay: 0
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Get all matching query keys
  const allKeys = getAllMatchingQueryKeys(queryClient, pattern);
  
  if (allKeys.length === 0) {
    console.log('No matching queries found for invalidation');
    return;
  }
  
  console.log(`Found ${allKeys.length} matching queries to invalidate`);
  
  // Process with delay if needed
  if (mergedOptions.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, mergedOptions.delay));
  }
  
  // Invalidate all matching queries
  for (const key of allKeys) {
    await queryClient.invalidateQueries({
      queryKey: key,
      refetchType: mergedOptions.refetchType,
      exact: mergedOptions.exact
    });
    console.log(`Invalidated query with key: ${JSON.stringify(key)}`);
  }
};

// Helper function to refetch all queries that match a pattern
export const refetchMatchingQueries = async (
  queryClient: QueryClient, 
  pattern: RegExp, 
  options?: { exact?: boolean; refetchType?: 'active' | 'inactive' | 'all'; delay?: number }
): Promise<void> => {
  const defaultOptions = {
    exact: false,
    refetchType: 'active' as const, 
    delay: 0
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Get all matching query keys
  const allKeys = getAllMatchingQueryKeys(queryClient, pattern);
  
  if (allKeys.length === 0) {
    console.log('No matching queries found for refetch');
    return;
  }
  
  console.log(`Found ${allKeys.length} matching queries to refetch`);
  
  // Process with delay if needed
  if (mergedOptions.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, mergedOptions.delay));
  }
  
  // Refetch all matching queries
  for (const key of allKeys) {
    await queryClient.refetchQueries({
      queryKey: key,
      exact: mergedOptions.exact,
      type: mergedOptions.refetchType
    });
    console.log(`Refetched query with key: ${JSON.stringify(key)}`);
  }
};

// Helper function to prefetch a query based on an existing query's data
export const prefetchRelatedQuery = async (
  queryClient: QueryClient,
  sourceKey: unknown[],
  targetKey: unknown[],
  queryFn: () => Promise<unknown>,
  options?: { 
    staleTime?: number;
    delay?: number;
  }
): Promise<void> => {
  const defaultOptions = {
    staleTime: 1000 * 60 * 5, // 5 minutes by default
    delay: 0
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Process with delay if needed
  if (mergedOptions.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, mergedOptions.delay));
  }
  
  // Prefetch the related query
  await queryClient.prefetchQuery({
    queryKey: targetKey,
    queryFn,
    staleTime: mergedOptions.staleTime
  });
  
  console.log(`Prefetched related query: ${JSON.stringify(targetKey)} from ${JSON.stringify(sourceKey)}`);
};

// Export the forceCalendarRefresh function that was referenced in the EventDialog component
export const forceCalendarRefresh = async (queryClient: QueryClient): Promise<void> => {
  console.log("Forcing calendar data refresh...");
  
  // Invalidate all calendar-related queries
  await queryClient.invalidateQueries({ 
    queryKey: ['events'],
    refetchType: 'all'
  });
  
  await queryClient.invalidateQueries({ 
    queryKey: ['business-events'],
    refetchType: 'all'
  });
  
  await queryClient.invalidateQueries({ 
    queryKey: ['approved-bookings'],
    refetchType: 'all'
  });
  
  // Also invalidate file-related queries
  await queryClient.invalidateQueries({ 
    queryKey: ['eventFiles'],
    refetchType: 'all'
  });
  
  // Force a hard refresh after a short delay
  setTimeout(() => {
    console.log("Executing forced refresh of calendar data");
    queryClient.refetchQueries({ 
      queryKey: ['events'],
      type: 'all',
      exact: false
    });
    
    queryClient.refetchQueries({ 
      queryKey: ['business-events'],
      type: 'all',
      exact: false
    });
    
    queryClient.refetchQueries({ 
      queryKey: ['approved-bookings'],
      type: 'all',
      exact: false
    });
  }, 300);
  
  console.log("Calendar refresh scheduled");
};
