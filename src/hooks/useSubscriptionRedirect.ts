
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export const useSubscriptionRedirect = () => {
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Check if user has an active subscription
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .single();

        if (error) {
          console.error('Error fetching subscription status:', error);
          setShowTrialExpired(false);
          return;
        }

        if (!subscription) {
          // No subscription found
          setShowTrialExpired(true);
        } else if (subscription.status === 'trial') {
          // Check if trial has expired
          const trialEndDate = new Date(subscription.trial_end_date);
          const now = new Date();
          
          setShowTrialExpired(now > trialEndDate);
        } else if (subscription.status === 'active') {
          // User has an active subscription
          setShowTrialExpired(false);
        } else {
          // Subscription has expired
          setShowTrialExpired(true);
        }
      } catch (error) {
        console.error('Subscription check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [user]);

  return {
    showTrialExpired,
    isLoading
  };
};
