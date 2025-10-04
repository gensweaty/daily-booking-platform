// Advanced Performance Optimization System
// Targets: Memory reduction, DB connection optimization, subscription cleanup

class AdvancedPerformanceOptimizer {
  private static instance: AdvancedPerformanceOptimizer;
  private subscriptionPool = new Map<string, any>();
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private connectionPool = new Set<string>();
  private memoryCleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): AdvancedPerformanceOptimizer {
    if (!AdvancedPerformanceOptimizer.instance) {
      AdvancedPerformanceOptimizer.instance = new AdvancedPerformanceOptimizer();
    }
    return AdvancedPerformanceOptimizer.instance;
  }

  constructor() {
    this.startMemoryOptimization();
    this.setupVisibilityListener();
  }

  // Aggressive query result consolidation
  consolidateQueryResults<T>(queries: Array<{ key: string; data: T[] }>): T[] {
    const seen = new Set();
    const consolidated: T[] = [];
    
    queries.forEach(query => {
      query.data.forEach(item => {
        const id = (item as any)?.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          consolidated.push(item);
        }
      });
    });
    
    return consolidated;
  }

  // Smart pagination for large datasets
  implementVirtualPagination<T>(data: T[], page: number = 1, pageSize: number = 50): {
    items: T[];
    hasMore: boolean;
    totalPages: number;
  } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = data.slice(startIndex, endIndex);
    
    return {
      items,
      hasMore: endIndex < data.length,
      totalPages: Math.ceil(data.length / pageSize)
    };
  }

  // Subscription pooling to reduce real-time connections
  createPooledSubscription(key: string, createFn: () => any): any {
    if (this.subscriptionPool.has(key)) {
      return this.subscriptionPool.get(key);
    }
    
    const subscription = createFn();
    this.subscriptionPool.set(key, subscription);
    
    // Auto cleanup after 10 minutes of inactivity
    setTimeout(() => {
      if (this.subscriptionPool.has(key)) {
        try {
          subscription.unsubscribe?.();
          this.subscriptionPool.delete(key);
        } catch (error) {
          console.warn('Subscription cleanup error:', error);
        }
      }
    }, 10 * 60 * 1000);
    
    return subscription;
  }

  // Intelligent query caching with memory limits
  getFromSmartCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  setSmartCache<T>(key: string, data: T, ttlMinutes: number = 5): void {
    // Limit cache size to prevent memory bloat
    if (this.queryCache.size > 100) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  // Connection tracking to prevent DB overload
  trackConnection(identifier: string): boolean {
    if (this.connectionPool.size >= 20) {
      console.warn('Connection pool limit reached');
      return false;
    }
    
    this.connectionPool.add(identifier);
    
    // Auto-remove after 5 minutes
    setTimeout(() => {
      this.connectionPool.delete(identifier);
    }, 5 * 60 * 1000);
    
    return true;
  }

  // Memory optimization for different data types
  optimizeDataStructure<T extends Record<string, any>>(
    data: T[],
    essentialFields: string[]
  ): Partial<T>[] {
    return data.map(item => {
      const optimized: any = {};
      essentialFields.forEach(field => {
        if (item[field] !== undefined) {
          optimized[field] = item[field];
        }
      });
      return optimized as Partial<T>;
    });
  }

  // Aggressive memory cleanup
  private startMemoryOptimization(): void {
    this.memoryCleanupInterval = setInterval(() => {
      // Clear expired cache entries
      const now = Date.now();
      for (const [key, cached] of this.queryCache.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.queryCache.delete(key);
        }
      }
      
      // Clean localStorage/sessionStorage of old entries
      this.cleanupStorages();
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  private cleanupStorages(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Cleanup localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('cache') || key.includes('optimized')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && (now - data.timestamp) > oneHour) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
    
    // Cleanup sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('calendar') || key.includes('query')) {
        try {
          const item = sessionStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && (now - data.timestamp) > oneHour) {
              sessionStorage.removeItem(key);
            }
          }
        } catch {
          sessionStorage.removeItem(key);
        }
      }
    });
  }

  // Background/foreground optimization
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Pause expensive operations when tab is hidden
          this.pauseExpensiveOperations();
        } else {
          // Resume when tab becomes visible
          this.resumeOperations();
        }
      });
    }
  }

  private pauseExpensiveOperations(): void {
    // Reduce polling intervals
    window.dispatchEvent(new CustomEvent('performance-mode-background'));
  }

  private resumeOperations(): void {
    // Resume normal intervals
    window.dispatchEvent(new CustomEvent('performance-mode-foreground'));
  }

  // Resource monitoring
  getResourceUsage(): {
    cacheSize: number;
    subscriptionCount: number;
    connectionCount: number;
  } {
    return {
      cacheSize: this.queryCache.size,
      subscriptionCount: this.subscriptionPool.size,
      connectionCount: this.connectionPool.size
    };
  }

  // Cleanup on app close
  destroy(): void {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    
    // Close all pooled subscriptions
    this.subscriptionPool.forEach(subscription => {
      try {
        subscription.unsubscribe?.();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    });
    
    this.subscriptionPool.clear();
    this.queryCache.clear();
    this.connectionPool.clear();
  }
}

export const advancedPerformanceOptimizer = AdvancedPerformanceOptimizer.getInstance();

// React hook for performance monitoring
export const useAdvancedPerformanceOptimizer = () => {
  return {
    optimizeData: advancedPerformanceOptimizer.optimizeDataStructure.bind(advancedPerformanceOptimizer),
    paginate: advancedPerformanceOptimizer.implementVirtualPagination.bind(advancedPerformanceOptimizer),
    consolidate: advancedPerformanceOptimizer.consolidateQueryResults.bind(advancedPerformanceOptimizer),
    getResourceUsage: advancedPerformanceOptimizer.getResourceUsage.bind(advancedPerformanceOptimizer),
    smartCache: {
      get: advancedPerformanceOptimizer.getFromSmartCache.bind(advancedPerformanceOptimizer),
      set: advancedPerformanceOptimizer.setSmartCache.bind(advancedPerformanceOptimizer)
    }
  };
};

// Auto cleanup on app close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    advancedPerformanceOptimizer.destroy();
  });
}