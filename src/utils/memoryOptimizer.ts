
import { useState, useEffect } from 'react';

// Memory optimization utilities
class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private memoryThreshold = 50 * 1024 * 1024; // 50MB threshold
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  startMemoryMonitoring(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  stopMemoryMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private performCleanup(): void {
    try {
      // Clear old localStorage entries
      this.cleanupLocalStorage();
      
      // Clear old sessionStorage entries
      this.cleanupSessionStorage();
      
      // Trigger garbage collection if available
      if ('gc' in window && typeof window.gc === 'function') {
        window.gc();
      }
      
      console.log('[MEMORY_OPTIMIZER] Cleanup performed');
    } catch (error) {
      console.warn('[MEMORY_OPTIMIZER] Cleanup failed:', error);
    }
  }

  private cleanupLocalStorage(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    keys.forEach(key => {
      try {
        if (key.includes('cache') || key.includes('throttle')) {
          const item = localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && now - data.timestamp > maxAge) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    });
  }

  private cleanupSessionStorage(): void {
    const keys = Object.keys(sessionStorage);
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    keys.forEach(key => {
      try {
        if (key.includes('query') || key.includes('cache')) {
          const item = sessionStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && now - data.timestamp > maxAge) {
              sessionStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        sessionStorage.removeItem(key);
      }
    });
  }

  // Optimize large objects by removing unnecessary properties
  optimizeDataStructure<T extends Record<string, any>>(data: T, keepFields: string[]): Partial<T> {
    const optimized: Partial<T> = {};
    
    keepFields.forEach(field => {
      if (field in data) {
        (optimized as any)[field] = data[field];
      }
    });
    
    return optimized;
  }

  // Implement pagination for large datasets
  paginateData<T>(data: T[], page: number = 1, pageSize: number = 50): { items: T[], totalPages: number, currentPage: number } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = data.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.length / pageSize);

    return {
      items,
      totalPages,
      currentPage: page
    };
  }
}

export const memoryOptimizer = MemoryOptimizer.getInstance();

// React hook for memory optimization
export const useMemoryOptimization = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    memoryOptimizer.startMemoryMonitoring();
    setIsMonitoring(true);

    return () => {
      memoryOptimizer.stopMemoryMonitoring();
      setIsMonitoring(false);
    };
  }, []);

  return {
    isMonitoring,
    optimizeData: memoryOptimizer.optimizeDataStructure.bind(memoryOptimizer),
    paginateData: memoryOptimizer.paginateData.bind(memoryOptimizer)
  };
};
