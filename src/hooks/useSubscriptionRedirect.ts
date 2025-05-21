
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { verifyStripeSubscription, refreshSubscriptionStatus } from '@/utils/stripeUtils';
import { useSearchParams } from 'react-router-dom';

export const useSubscriptionRedirect = () => {
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Check if we have a Stripe session ID in the URL
  const hasStripeSession = !!searchParams.get('session_id');
  
  const checkSubscriptionWithBackoff = useCallback(async (retries = 5, delay = 1000) => {
    if (!user) {
      return false;
    }
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`Subscription check attempt ${attempt + 1} of ${retries}`);
        
        // Check if user has an active subscription
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching subscription status:', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
          continue;
        }
        
        if (subscription) {
          console.log('Active subscription found', subscription);
          return true;
        }
        
        // No active subscription, check for stripe session in URL
        if (hasStripeSession) {
          console.log('No active subscription, but Stripe session present, will verify directly');
          const sessionId = searchParams.get('session_id');
          if (sessionId) {
            try {
              const result = await verifyStripeSubscription(sessionId);
              if (result?.success) {
                console.log('Session verified successfully through direct check');
                // Force refresh the subscription data
                await refreshSubscriptionStatus();
                return true;
              }
            } catch (verifyError) {
              console.error('Error during direct session verification:', verifyError);
            }
          }
        }
        
        // Check for trial subscription
        const { data: trialSub, error: trialError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'trial')
          .maybeSingle();
          
        if (trialError) {
          console.error('Error fetching trial subscription:', trialError);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
          continue;
        }
        
        if (trialSub) {
          // Check if trial is still valid
          const trialEndDate = new Date(trialSub.trial_end_date);
          const now = new Date();
          const hasExpired = now > trialEndDate;
          
          console.log(`Trial status: ${hasExpired ? 'expired' : 'active'}, end date: ${trialEndDate}`);
          return !hasExpired;
        }
        
        return false; // No subscription found
      } catch (error) {
        console.error('Subscription check error:', error);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
    
    // All retries failed
    console.error('All subscription check attempts failed');
    return false;
  }, [user, hasStripeSession, searchParams]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setShowTrialExpired(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('Checking subscription status for user:', user.id);

      const hasActiveSubscription = await checkSubscriptionWithBackoff();
      
      console.log('Subscription status check result:', hasActiveSubscription);
      setShowTrialExpired(!hasActiveSubscription);
    } catch (error) {
      console.error('Subscription check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, checkSubscriptionWithBackoff]);

  useEffect(() => {
    const checkWithDebug = async () => {
      console.log('Running subscription check, user:', user?.id);
      await checkSubscriptionStatus();
      console.log('Completed subscription check, showing dialog:', showTrialExpired);
    };
    
    checkWithDebug();
    
    // Set up polling to check subscription status with increased frequency when stripe session is present
    const interval = hasStripeSession ? 3000 : 10000; // Check every 3 seconds if session ID present, otherwise every 10 seconds
    const intervalId = setInterval(checkWithDebug, interval);
    
    return () => clearInterval(intervalId);
  }, [user, forceRefresh, checkSubscriptionStatus, hasStripeSession, showTrialExpired]);

  return {
    showTrialExpired,
    isLoading,
    setForceRefresh,
    checkSubscriptionStatus
  };
};
