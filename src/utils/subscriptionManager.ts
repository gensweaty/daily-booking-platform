import { supabase } from '@/integrations/supabase/client';

interface SubscriptionInfo {
  channel: any;
  status: string;
  unsubscribeCallback?: () => void;
}

class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions = new Map<string, SubscriptionInfo>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  constructor() {
    this.startCleanupMonitoring();
  }

  // Create a unique subscription with automatic cleanup
  createOptimizedSubscription(
    subscriptionKey: string,
    table: string,
    filter?: string,
    callback?: (payload: any) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Clean up existing subscription with same key
        this.unsubscribe(subscriptionKey);

        const channel = supabase.channel(subscriptionKey);
        
        // Add table listener
        let channelWithListener = channel.on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table,
            filter: filter || undefined
          },
          (payload) => {
            if (callback) {
              // Debounce callback to prevent rapid fire
              this.debounceCallback(subscriptionKey, callback, payload);
            }
          }
        );

        const subscribePromise = channelWithListener.subscribe((status) => {
          console.log(`[SUBSCRIPTION_MANAGER] ${subscriptionKey} status:`, status);
          
          if (status === 'SUBSCRIBED') {
            this.subscriptions.set(subscriptionKey, {
              channel: channelWithListener,
              status: 'active'
            });
            resolve(channelWithListener);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[SUBSCRIPTION_MANAGER] ${subscriptionKey} failed:`, status);
            reject(new Error(`Subscription failed: ${status}`));
          }
        });

        // Set timeout for subscription attempt
        setTimeout(() => {
          if (!this.subscriptions.has(subscriptionKey)) {
            reject(new Error('Subscription timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error(`[SUBSCRIPTION_MANAGER] Error creating subscription ${subscriptionKey}:`, error);
        reject(error);
      }
    });
  }

  // Debounce mechanism to prevent rapid callbacks
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  
  private debounceCallback(key: string, callback: Function, payload: any) {
    const debounceKey = `${key}_debounce`;
    
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }
    
    const timer = setTimeout(() => {
      callback(payload);
      this.debounceTimers.delete(debounceKey);
    }, 300); // 300ms debounce
    
    this.debounceTimers.set(debounceKey, timer);
  }

  // Unsubscribe from a specific subscription
  unsubscribe(subscriptionKey: string): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      try {
        subscription.channel.unsubscribe();
        this.subscriptions.delete(subscriptionKey);
        console.log(`[SUBSCRIPTION_MANAGER] Unsubscribed from ${subscriptionKey}`);
      } catch (error) {
        console.warn(`[SUBSCRIPTION_MANAGER] Error unsubscribing from ${subscriptionKey}:`, error);
        // Force remove from map even if unsubscribe failed
        this.subscriptions.delete(subscriptionKey);
      }
    }
  }

  // Clean up all subscriptions
  unsubscribeAll(): void {
    console.log(`[SUBSCRIPTION_MANAGER] Cleaning up ${this.subscriptions.size} subscriptions`);
    
    for (const [key, subscription] of this.subscriptions) {
      try {
        subscription.channel.unsubscribe();
      } catch (error) {
        console.warn(`[SUBSCRIPTION_MANAGER] Error unsubscribing from ${key}:`, error);
      }
    }
    
    this.subscriptions.clear();
    
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  // Get active subscription count
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Check if subscription exists
  hasSubscription(subscriptionKey: string): boolean {
    return this.subscriptions.has(subscriptionKey);
  }

  // Start monitoring for cleanup
  private startCleanupMonitoring(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const count = this.getActiveSubscriptionCount();
      if (count > 50) { // If too many subscriptions, log warning
        console.warn(`[SUBSCRIPTION_MANAGER] High subscription count: ${count}`);
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop cleanup monitoring
  stopCleanupMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Cleanup when app is closing
  destroy(): void {
    this.stopCleanupMonitoring();
    this.unsubscribeAll();
  }
}

export const subscriptionManager = SubscriptionManager.getInstance();

// React hook for managing subscriptions
export const useOptimizedSubscription = () => {
  return {
    createSubscription: subscriptionManager.createOptimizedSubscription.bind(subscriptionManager),
    unsubscribe: subscriptionManager.unsubscribe.bind(subscriptionManager),
    hasSubscription: subscriptionManager.hasSubscription.bind(subscriptionManager),
    getActiveCount: subscriptionManager.getActiveSubscriptionCount.bind(subscriptionManager)
  };
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    subscriptionManager.destroy();
  });
}