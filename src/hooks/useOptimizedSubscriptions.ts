// Optimized subscription management to reduce memory usage
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { advancedPerformanceOptimizer } from '@/utils/advancedPerformanceOptimizer';

interface SubscriptionConfig {
  table: string;
  filter?: string;
  userId?: string;
  onUpdate?: (payload: any) => void;
  priority?: 'high' | 'medium' | 'low';
}

export const useOptimizedSubscriptions = (configs: SubscriptionConfig[]) => {
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isActiveRef = useRef(true);

  const createOptimizedSubscription = useCallback((config: SubscriptionConfig) => {
    const key = `${config.table}_${config.userId}_${config.filter || 'all'}`;
    
    // Check if subscription already exists
    if (subscriptionsRef.current.has(key)) {
      return subscriptionsRef.current.get(key);
    }

    const channel = supabase.channel(`optimized_${key}_${Date.now()}`);
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: config.table,
          filter: config.filter
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          // Debounce updates based on priority
          const debounceTime = config.priority === 'high' ? 100 : 
                              config.priority === 'medium' ? 300 : 500;
          
          const debounceKey = `${key}_update`;
          if (debounceTimersRef.current.has(debounceKey)) {
            clearTimeout(debounceTimersRef.current.get(debounceKey)!);
          }
          
          const timer = setTimeout(() => {
            if (config.onUpdate && isActiveRef.current) {
              config.onUpdate(payload);
            }
            debounceTimersRef.current.delete(debounceKey);
          }, debounceTime);
          
          debounceTimersRef.current.set(debounceKey, timer);
        }
      )
      .subscribe();

    subscriptionsRef.current.set(key, subscription);
    return subscription;
  }, []);

  // Setup subscriptions
  useEffect(() => {
    configs.forEach(config => {
      if (config.userId) {
        createOptimizedSubscription(config);
      }
    });

    // Visibility change optimization
    const handleVisibilityChange = () => {
      isActiveRef.current = !document.hidden;
      
      if (document.hidden) {
        // Pause all subscriptions when tab is hidden
        console.log('[SUBSCRIPTIONS] Pausing due to tab hidden');
      } else {
        console.log('[SUBSCRIPTIONS] Resuming due to tab visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [configs, createOptimizedSubscription]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Clear all debounce timers
      debounceTimersRef.current.forEach(timer => clearTimeout(timer));
      debounceTimersRef.current.clear();
      
      // Unsubscribe from all channels
      subscriptionsRef.current.forEach(subscription => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.warn('Subscription cleanup error:', error);
        }
      });
      subscriptionsRef.current.clear();
      
      isActiveRef.current = false;
    };
  }, []);

  return {
    subscriptionCount: subscriptionsRef.current.size,
    isActive: isActiveRef.current
  };
};

// Consolidated subscription for calendar events
export const useConsolidatedCalendarSubscription = (
  userId: string | undefined,
  onUpdate: (payload: any) => void
) => {
  return useOptimizedSubscriptions([
    {
      table: 'events',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      userId,
      onUpdate,
      priority: 'high'
    },
    {
      table: 'booking_requests',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      userId,
      onUpdate,
      priority: 'medium'
    }
  ]);
};

// Consolidated subscription for CRM
export const useConsolidatedCRMSubscription = (
  userId: string | undefined,
  onUpdate: (payload: any) => void
) => {
  return useOptimizedSubscriptions([
    {
      table: 'customers',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      userId,
      onUpdate,
      priority: 'medium'
    },
    {
      table: 'events',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      userId,
      onUpdate,
      priority: 'low'
    }
  ]);
};