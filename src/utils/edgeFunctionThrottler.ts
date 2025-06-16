
interface CallLog {
  timestamp: number;
  count: number;
}

interface ThrottleCache {
  [functionName: string]: CallLog;
}

class EdgeFunctionThrottler {
  private static instance: EdgeFunctionThrottler;
  private cache: ThrottleCache = {};
  private readonly MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_KEY = 'edge_function_throttle_cache';

  constructor() {
    this.loadCache();
  }

  static getInstance(): EdgeFunctionThrottler {
    if (!EdgeFunctionThrottler.instance) {
      EdgeFunctionThrottler.instance = new EdgeFunctionThrottler();
    }
    return EdgeFunctionThrottler.instance;
  }

  private loadCache(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load throttle cache:', error);
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save throttle cache:', error);
    }
  }

  canCall(functionName: string, reason?: string): boolean {
    const now = Date.now();
    const lastCall = this.cache[functionName];

    // Track call attempts
    console.count(`[THROTTLER] ${functionName} call attempt`);
    
    if (reason) {
      console.log(`[THROTTLER] ${functionName} called for: ${reason}`);
    }

    if (!lastCall) {
      this.cache[functionName] = { timestamp: now, count: 1 };
      this.saveCache();
      console.log(`[THROTTLER] First call allowed for ${functionName}`);
      return true;
    }

    const timeSinceLastCall = now - lastCall.timestamp;
    
    if (timeSinceLastCall < this.MIN_INTERVAL) {
      const remainingTime = Math.ceil((this.MIN_INTERVAL - timeSinceLastCall) / 1000);
      console.log(`[THROTTLER] ${functionName} throttled. Wait ${remainingTime}s more`);
      return false;
    }

    this.cache[functionName] = { 
      timestamp: now, 
      count: (lastCall.count || 0) + 1 
    };
    this.saveCache();
    console.log(`[THROTTLER] Call allowed for ${functionName} (total calls: ${this.cache[functionName].count})`);
    return true;
  }

  forceAllow(functionName: string, reason: string): void {
    const now = Date.now();
    console.log(`[THROTTLER] Force allowing ${functionName} for: ${reason}`);
    this.cache[functionName] = { 
      timestamp: now, 
      count: (this.cache[functionName]?.count || 0) + 1 
    };
    this.saveCache();
  }

  getStats(): ThrottleCache {
    return { ...this.cache };
  }

  reset(): void {
    this.cache = {};
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[THROTTLER] Cache reset');
  }
}

export const edgeFunctionThrottler = EdgeFunctionThrottler.getInstance();
