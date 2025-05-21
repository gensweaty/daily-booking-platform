
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
        .eq('status', 'active')  // Only look for active subscriptions
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription status:', error);
        return;
      }

      console.log('Subscription check result:', subscription);

      if (subscription && subscription.status === 'active') {
        // User has an active subscription
        console.log('User has active subscription, hiding dialog');
        setShowTrialExpired(false);
      } else {
        // Check if there's a trial subscription
        const { data: trialSub, error: trialError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'trial')
          .order('created_at', { ascending: false })
          .maybeSingle();
          
        if (trialError) {
          console.error('Error fetching trial subscription:', trialError);
          return;
        }
        
        if (trialSub) {
          // Check if trial has expired
          const trialEndDate = new Date(trialSub.trial_end_date);
          const now = new Date();
          
          const hasExpired = now > trialEndDate;
          console.log(`Trial status: ${hasExpired ? 'expired' : 'active'}, end date: ${trialEndDate}`);
          setShowTrialExpired(hasExpired);
        } else {
          // No subscription at all, consider as trial expired
          console.log('No active subscription found, showing dialog');
          setShowTrialExpired(true);
        }
      }
    } catch (error) {
      console.error('Subscription check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const checkWithDebug = async () => {
      console.log('Running subscription check, user:', user?.id);
      await checkSubscriptionStatus();
      console.log('Completed subscription check, showing dialog:', showTrialExpired);
    };
    
    checkWithDebug();
    
    // Set up polling to check subscription status more frequently
    const intervalId = setInterval(checkWithDebug, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [user, forceRefresh, checkSubscriptionStatus]);

  return {
    showTrialExpired,
    isLoading,
    setForceRefresh,
    checkSubscriptionStatus
  };
};
