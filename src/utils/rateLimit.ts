// Simple in-memory rate limiter for booking requests
// This will be cleared when the server restarts, but works for our purposes

// Store IP addresses and their last request timestamps
type RateLimitStore = {
  [ip: string]: {
    lastRequestTime: number;
    count: number;
  };
};

// In-memory store
const ipRequestStore: RateLimitStore = {};

// Time window in milliseconds (2 minutes)
const RATE_LIMIT_WINDOW = 2 * 60 * 1000;

/**
 * Checks if an IP address is allowed to make a booking request
 * @param ip The IP address to check
 * @returns Object with isAllowed and timeRemaining (in seconds)
 */
export const canMakeBookingRequest = (ip: string): { 
  isAllowed: boolean; 
  timeRemaining: number;
} => {
  const now = Date.now();
  const ipData = ipRequestStore[ip];
  
  // If no previous requests from this IP, allow it
  if (!ipData) {
    ipRequestStore[ip] = {
      lastRequestTime: now,
      count: 1
    };
    return { isAllowed: true, timeRemaining: 0 };
  }
  
  // Calculate time since last request
  const timeSinceLastRequest = now - ipData.lastRequestTime;
  
  // If enough time has passed, allow the request
  if (timeSinceLastRequest >= RATE_LIMIT_WINDOW) {
    ipRequestStore[ip] = {
      lastRequestTime: now,
      count: 1
    };
    return { isAllowed: true, timeRemaining: 0 };
  }
  
  // Otherwise, deny the request and calculate remaining time
  const timeRemaining = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastRequest) / 1000);
  return { 
    isAllowed: false,
    timeRemaining
  };
};

// Clean up old entries periodically to prevent memory leaks
// Run this cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  const cutoffTime = now - RATE_LIMIT_WINDOW;
  
  Object.keys(ipRequestStore).forEach(ip => {
    if (ipRequestStore[ip].lastRequestTime < cutoffTime) {
      delete ipRequestStore[ip];
    }
  });
}, 10 * 60 * 1000);
