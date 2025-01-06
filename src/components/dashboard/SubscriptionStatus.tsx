import { useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const useSubscriptionStatus = (setShowTrialExpired: (show: boolean) => void) => {
  const { user } = useAuth();

  const checkSubscriptionStatus = async () => {
    if (user) {
      try {
        console.log('Checking subscription status for user:', user.id);
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('status, current_period_end, trial_end_date, plan_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('Error checking subscription:', error);
          return;
        }

        console.log('Fetched subscription:', subscription);

        const isExpired = !subscription || 
          subscription.status === 'expired' || 
          (subscription.current_period_end && new Date(subscription.current_period_end) < new Date());

        console.log('Subscription expired?', isExpired);
        setShowTrialExpired(isExpired);
      } catch (error) {
        console.error('Subscription check error:', error);
      }
    }
  };

  useEffect(() => {
    checkSubscriptionStatus();
    
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
          checkSubscriptionStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setShowTrialExpired]);

  return { checkSubscriptionStatus };
};