
interface SubscriptionStatusCache {
  status: string;
  planType?: string;
  currentPeriodEnd?: string;
  trialEnd?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  timestamp: number;
  lastSyncReason?: string;
}

class SubscriptionCacheManager {
  private static instance: SubscriptionCacheManager;
  private readonly CACHE_KEY = 'subscription_status_cache';
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  static getInstance(): SubscriptionCacheManager {
    if (!SubscriptionCacheManager.instance) {
      SubscriptionCacheManager.instance = new SubscriptionCacheManager();
    }
    return SubscriptionCacheManager.instance;
  }

  getCachedStatus(): SubscriptionStatusCache | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const data: SubscriptionStatusCache = JSON.parse(cached);
      const now = Date.now();
      
      if (now - data.timestamp > this.CACHE_DURATION) {
        console.log('[SUBSCRIPTION_CACHE] Cache expired, removing');
        this.clearCache();
        return null;
      }

      const minutesAgo = Math.floor((now - data.timestamp) / (1000 * 60));
      console.log(`[SUBSCRIPTION_CACHE] Using cached data from ${minutesAgo} minutes ago`);
      return data;
    } catch (error) {
      console.warn('Failed to read subscription cache:', error);
      return null;
    }
  }

  setCachedStatus(data: Omit<SubscriptionStatusCache, 'timestamp'>, reason: string): void {
    try {
      const cacheData: SubscriptionStatusCache = {
        ...data,
        timestamp: Date.now(),
        lastSyncReason: reason
      };
      
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      console.log(`[SUBSCRIPTION_CACHE] Cached subscription status for: ${reason}`);
    } catch (error) {
      console.warn('Failed to cache subscription status:', error);
    }
  }

  clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
    console.log('[SUBSCRIPTION_CACHE] Cache cleared');
  }

  getLastSyncInfo(): { minutesAgo: number; reason?: string } | null {
    const cached = this.getCachedStatus();
    if (!cached) return null;

    const minutesAgo = Math.floor((Date.now() - cached.timestamp) / (1000 * 60));
    return {
      minutesAgo,
      reason: cached.lastSyncReason
    };
  }
}

export const subscriptionCache = SubscriptionCacheManager.getInstance();
