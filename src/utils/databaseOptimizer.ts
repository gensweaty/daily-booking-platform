// Database Query Optimization for Reduced Memory Usage
import { supabase } from '@/integrations/supabase/client';
import { advancedPerformanceOptimizer } from './advancedPerformanceOptimizer';

export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer;
  private queryQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private connectionCount = 0;
  private readonly maxConnections = 10;

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer();
    }
    return DatabaseOptimizer.instance;
  }

  // Queue queries to prevent DB overload
  async queueQuery<T>(queryFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queryQueue.push(async () => {
        try {
          if (this.connectionCount >= this.maxConnections) {
            throw new Error('Too many active connections');
          }
          
          this.connectionCount++;
          const result = await queryFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.connectionCount--;
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queryQueue.length === 0) return;

    this.isProcessing = true;
    
    while (this.queryQueue.length > 0 && this.connectionCount < this.maxConnections) {
      const queryFn = this.queryQueue.shift();
      if (queryFn) {
        queryFn().catch(console.error);
      }
    }

    this.isProcessing = false;
  }

  // Optimized event fetching with minimal data
  async fetchOptimizedEvents(userId: string, startDate: string, endDate: string) {
    const cacheKey = `events_${userId}_${startDate}_${endDate}`;
    const cached = advancedPerformanceOptimizer.getFromSmartCache(cacheKey);
    
    if (cached) return cached;

    return this.queueQuery(async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, payment_status')
        .eq('user_id', userId)
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .is('deleted_at', null)
        .limit(30) // Reduced limit
        .order('start_date', { ascending: true });

      if (error) throw error;

      const optimized = advancedPerformanceOptimizer.optimizeDataStructure(
        data || [],
        ['id', 'title', 'start_date', 'end_date', 'payment_status']
      );

      advancedPerformanceOptimizer.setSmartCache(cacheKey, optimized, 5);
      return optimized;
    });
  }

  // Optimized task fetching
  async fetchOptimizedTasks(userId: string) {
    const cacheKey = `tasks_${userId}`;
    const cached = advancedPerformanceOptimizer.getFromSmartCache(cacheKey);
    
    if (cached) return cached;

    return this.queueQuery(async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .eq('user_id', userId)
        .eq('archived', false)
        .is('archived_at', null)
        .limit(50)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const optimized = advancedPerformanceOptimizer.optimizeDataStructure(
        data || [],
        ['id', 'title', 'status', 'created_at']
      );

      advancedPerformanceOptimizer.setSmartCache(cacheKey, optimized, 10);
      return optimized;
    });
  }

  // Optimized customer fetching
  async fetchOptimizedCustomers(userId: string) {
    const cacheKey = `customers_${userId}`;
    const cached = advancedPerformanceOptimizer.getFromSmartCache(cacheKey);
    
    if (cached) return cached;

    return this.queueQuery(async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, title, user_surname, user_number, event_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(100)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const optimized = advancedPerformanceOptimizer.optimizeDataStructure(
        data || [],
        ['id', 'title', 'user_surname', 'user_number', 'event_id']
      );

      advancedPerformanceOptimizer.setSmartCache(cacheKey, optimized, 8);
      return optimized;
    });
  }

  // Batch operations for multiple queries
  async batchQueries<T>(queries: Array<() => Promise<T>>): Promise<T[]> {
    const batchSize = 3; // Process in small batches
    const results: T[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(query => this.queueQuery(query))
      );
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return results;
  }

  // Get connection status
  getConnectionStatus() {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      queueLength: this.queryQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

export const databaseOptimizer = DatabaseOptimizer.getInstance();