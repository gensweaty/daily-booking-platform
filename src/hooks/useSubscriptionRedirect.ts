
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export const useSubscriptionRedirect = () => {
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const { user } = useAuth();

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setShowTrialExpired(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('Checking subscription status for user:', user.id);

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
        console.log('No subscription found, showing trial expired dialog');
        setShowTrialExpired(true);
      } else if (subscription.status === 'trial') {
        // Check if trial has expired
        const trialEndDate = new Date(subscription.trial_end_date);
        const now = new Date();
        
        const hasExpired = now > trialEndDate;
        console.log(`Trial status: ${hasExpired ? 'expired' : 'active'}, end date: ${trialEndDate}`);
        setShowTrialExpired(hasExpired);
      } else if (subscription.status === 'active') {
        // User has an active subscription
        console.log('User has active subscription');
        setShowTrialExpired(false);
      } else {
        // Subscription has expired
        console.log('Subscription expired or inactive');
        setShowTrialExpired(true);
      }
    } catch (error) {
      console.error('Subscription check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscriptionStatus();
    
    // Set up polling to check subscription status periodically
    const intervalId = setInterval(checkSubscriptionStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [user, forceRefresh, checkSubscriptionStatus]);

  return {
    showTrialExpired,
    isLoading,
    setForceRefresh,
    checkSubscriptionStatus
  };
};
