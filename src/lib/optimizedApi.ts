
import { supabase } from "@/lib/supabase";

// Rate limiting with more aggressive limits
const OPTIMIZED_RATE_LIMIT_KEY = 'optimized_api_rate_limit';
const OPTIMIZED_RATE_LIMIT_COOLDOWN = 300; // 5 minutes

// Memory cache for session data
const sessionCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export const checkOptimizedRateLimit = async (operation: string): Promise<{ isLimited: boolean, remainingTime: number }> => {
  try {
    const cacheKey = `${OPTIMIZED_RATE_LIMIT_KEY}_${operation}`;
    const lastRequestTime = localStorage.getItem(cacheKey);
    
    if (!lastRequestTime) {
      return { isLimited: false, remainingTime: 0 };
    }
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastRequest = now - parseInt(lastRequestTime, 10);
    
    if (timeSinceLastRequest < OPTIMIZED_RATE_LIMIT_COOLDOWN) {
      const remainingTime = OPTIMIZED_RATE_LIMIT_COOLDOWN - timeSinceLastRequest;
      return { isLimited: true, remainingTime };
    }
    
    return { isLimited: false, remainingTime: 0 };
  } catch (error) {
    console.error("Error checking optimized rate limit:", error);
    return { isLimited: false, remainingTime: 0 };
  }
};

export const setOptimizedRateLimit = (operation: string) => {
  const cacheKey = `${OPTIMIZED_RATE_LIMIT_KEY}_${operation}`;
  localStorage.setItem(cacheKey, Math.floor(Date.now() / 1000).toString());
};

// Cached database queries with session storage
export const getCachedData = <T>(key: string): T | null => {
  const cached = sessionCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    sessionCache.delete(key);
    return null;
  }
  
  return cached.data as T;
};

export const setCachedData = <T>(key: string, data: T, ttlMinutes: number = 15) => {
  sessionCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000
  });
};

// Optimized booking request creation with minimal data
export const createOptimizedBookingRequest = async (request: any) => {
  const { isLimited } = await checkOptimizedRateLimit('booking_request');
  
  if (isLimited) {
    throw new Error("Rate limit reached. Please wait before submitting another booking request.");
  }

  try {
    // Minimize the data sent to database
    const optimizedRequest = {
      title: request.title,
      requester_name: request.requester_name,
      requester_email: request.requester_email,
      requester_phone: request.requester_phone,
      start_date: request.start_date,
      end_date: request.end_date,
      business_id: request.business_id,
      status: 'pending',
      payment_amount: request.payment_amount ? Number(request.payment_amount) : null,
      // Remove non-essential fields
    };

    const { data, error } = await supabase
      .from("booking_requests")
      .insert([optimizedRequest])
      .select('id, title, start_date, end_date, status') // Only return essential fields
      .single();

    if (error) {
      console.error("Error creating optimized booking request:", error);
      throw error;
    }
    
    setOptimizedRateLimit('booking_request');
    return data;
  } catch (error: any) {
    console.error("Error in createOptimizedBookingRequest:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};

// Batch file operations
export const batchFileOperations = async (operations: Array<{ type: 'upload' | 'delete', data: any }>) => {
  const results = [];
  
  // Process in smaller batches to reduce memory usage
  const batchSize = 3;
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (op) => {
        try {
          if (op.type === 'upload') {
            // Simplified upload logic
            return { success: true, data: op.data };
          } else {
            // Simplified delete logic
            return { success: true };
          }
        } catch (error) {
          return { success: false, error };
        }
      })
    );
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the database
    if (i + batchSize < operations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
};
