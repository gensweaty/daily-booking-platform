import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface SubscriptionStatus {
  isActive: boolean;
  planType: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
}

export const useSubscriptionStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    planType: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (error) throw error;

        const isActive = subscription?.status === 'active' && 
          subscription?.current_period_end && 
          new Date(subscription.current_period_end) > new Date();

        setStatus({
          isActive,
          planType: subscription?.plan_type || null,
          expiresAt: subscription?.current_period_end || null,
        });
      } catch (error) {
        console.error('Error checking subscription:', error);
        toast({
          title: "Error",
          description: "Failed to check subscription status",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();

    // Set up real-time subscription updates
    const channel = supabase
      .channel('subscription-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('Subscription updated:', payload);
          checkSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return { status, loading };
};