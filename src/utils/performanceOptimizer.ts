// Performance monitoring and optimization utilities
class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Debounce function calls to reduce excessive API requests
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Throttle function calls to limit execution frequency
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Optimize large lists with virtual scrolling check
  shouldUseVirtualScrolling(itemCount: number): boolean {
    return itemCount > 100;
  }

  // Check if device has limited resources
  isLowEndDevice(): boolean {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    
    return (
      hardwareConcurrency <= 2 ||
      (connection && connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType))
    );
  }

  // Reduce query frequency for low-end devices
  getOptimalRefetchInterval(): number {
    return this.isLowEndDevice() ? 60000 : 30000; // 60s vs 30s
  }

  // Clean up old cached data
  cleanupBrowserCache(): void {
    try {
      // Clear old localStorage entries older than 24 hours
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      
      Object.keys(localStorage).forEach(key => {
        try {
          if (key.includes('cache') || key.includes('query')) {
            const item = localStorage.getItem(key);
            if (item) {
              const data = JSON.parse(item);
              if (data.timestamp && (now - data.timestamp) > dayInMs) {
                localStorage.removeItem(key);
              }
            }
          }
        } catch (error) {
          // Remove corrupted items
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance();

// Auto-cleanup on app start
performanceOptimizer.cleanupBrowserCache();