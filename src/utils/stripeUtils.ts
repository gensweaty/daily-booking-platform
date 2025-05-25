
import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";

// Update the Stripe price IDs to match your actual Stripe account
const STRIPE_PRICES = {
  monthly: 'price_1RRIfK2MNASmq1vOrdsjIrYn',
  yearly: 'price_1RRIfL2MNASmq1vOvYvHHZzD',
};

// Stripe product IDs
const STRIPE_PRODUCTS = {
  monthly: 'prod_SM0gHgA0G0cQN3',
  yearly: 'prod_SM0gLwKne0dVuy',
};

interface StripeCheckoutResponse {
  data?: {
    url?: string;
    [key: string]: any;
  };
  error?: {
    message?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface StripeVerifyResponse {
  data?: {
    success?: boolean;
    status?: string;
    currentPeriodEnd?: string;
    planType?: string;
    error?: string;
    [key: string]: any;
  };
  error?: {
    message?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export const createCheckoutSession = async (planType: 'monthly' | 'yearly') => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Authentication error:', userError);
      throw new Error("User not authenticated");
    }
    
    const priceId = STRIPE_PRICES[planType];
    const productId = STRIPE_PRODUCTS[planType];
    
    console.log(`Creating checkout session for ${planType} plan:`, { priceId, productId });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000);
    });
    
    const functionPromise = supabase.functions.invoke('create-stripe-checkout', {
      body: { 
        user_id: userData.user.id,
        price_id: priceId,
        product_id: productId,
        plan_type: planType,
        return_url: window.location.origin + window.location.pathname
      }
    });
    
    const response = await Promise.race([
      functionPromise,
      timeoutPromise.catch(err => { throw err; })
    ]) as StripeCheckoutResponse;
    
    const data = response?.data;
    const error = response?.error;
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw new Error(error.message || 'Failed to create checkout session');
    }
    
    if (!data || !data.url) {
      console.error('No URL returned from checkout session creation');
      throw new Error('Failed to create checkout session - no URL returned');
    }
    
    console.log('Checkout session created:', data);
    return data;
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    throw error;
  }
};

export const checkSubscriptionStatus = async () => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.log('User not authenticated');
      return { success: false, status: 'not_authenticated' };
    }
    
    console.log('Checking subscription status for user:', userData.user.email);
    
    // Check if user has a subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();
      
    if (subError) {
      console.error('Error fetching subscription:', subError);
    }

    // If no subscription exists, create a trial subscription
    if (!existingSubscription) {
      console.log('No subscription found, creating trial subscription');
      await createTrialSubscription(userData.user.id);
      
      return {
        success: true,
        status: 'trial',
        trialEnd: addDays(new Date(), 14).toISOString(),
        isTrialExpired: false
      };
    }
    
    // Check if this subscription should be verified with Stripe
    if (existingSubscription.stripe_subscription_id) {
      console.log('Subscription has Stripe ID, verifying with Stripe');
      
      try {
        const response = await supabase.functions.invoke('verify-stripe-subscription', {
          body: { 
            user_id: userData.user.id,
            subscription_id: existingSubscription.stripe_subscription_id 
          }
        }) as StripeVerifyResponse;
        
        const data = response?.data;
        const error = response?.error;
        
        if (error) {
          console.error('Error verifying subscription with Stripe:', error);
        } else {
          console.log('Stripe verification result:', data);
          if (data && data.status === 'active') {
            if (existingSubscription.status !== 'active') {
              console.log('Updating subscription in database to active status');
              await supabase
                .from('subscriptions')
                .update({ 
                  status: 'active',
                  current_period_end: data.currentPeriodEnd || existingSubscription.current_period_end,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id);
            }
            return data;
          }
        }
      } catch (verifyError) {
        console.error('Exception verifying with Stripe:', verifyError);
      }
    }
    
    console.log('Using database subscription status:', existingSubscription.status);
    
    // Check if trial has expired
    const now = new Date();
    const isTrialExpired = existingSubscription.status === 'trial' && 
      existingSubscription.trial_end_date && 
      new Date(existingSubscription.trial_end_date) < now;
      
    // Check if subscription has expired
    const isSubscriptionExpired = existingSubscription.status === 'active' && 
      existingSubscription.current_period_end && 
      new Date(existingSubscription.current_period_end) < now;
      
    let effectiveStatus = existingSubscription.status;
    if (isTrialExpired) {
      effectiveStatus = 'trial_expired';
      
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'trial_expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);
    } else if (isSubscriptionExpired) {
      effectiveStatus = 'expired';
      
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);
    }
    
    return {
      success: true,
      status: effectiveStatus,
      currentPeriodEnd: existingSubscription.current_period_end,
      planType: existingSubscription.plan_type,
      isTrialExpired: isTrialExpired,
      isSubscriptionExpired: isSubscriptionExpired,
      stripe_customer_id: existingSubscription.stripe_customer_id,
      stripe_subscription_id: existingSubscription.stripe_subscription_id
    };
  } catch (error) {
    console.error('Error in checkSubscriptionStatus:', error);
    throw error;
  }
};

// Enhanced manual sync function with better error handling
export const manualSyncSubscription = async () => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      throw new Error("User not authenticated");
    }
    
    console.log('Manual sync requested for user:', userData.user.email);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Sync request timed out after 30 seconds")), 30000);
    });
    
    const syncPromise = supabase.functions.invoke('verify-stripe-subscription', {
      body: { 
        user_id: userData.user.id
      }
    });
    
    const response = await Promise.race([syncPromise, timeoutPromise]) as StripeVerifyResponse;
    
    console.log('Raw response from verify-stripe-subscription:', response);
    
    const data = response?.data;
    const error = response?.error;
    
    if (error) {
      console.error('Error in manual sync:', error);
      throw new Error(error.message || 'Manual sync failed');
    }
    
    if (!data) {
      throw new Error('No data returned from sync operation');
    }
    
    console.log('Manual sync result:', data);
    return data;
  } catch (error) {
    console.error('Error in manualSyncSubscription:', error);
    throw error;
  }
};

export const verifySession = async (sessionId: string) => {
  try {
    console.log('Verifying Stripe session:', sessionId);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Authentication error:', userError);
      throw new Error("User not authenticated");
    }
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Session verification timed out after 30 seconds")), 30000);
    });
    
    const verifyPromise = supabase.functions.invoke('verify-stripe-subscription', {
      body: { 
        session_id: sessionId,
        user_id: userData.user.id
      }
    });
    
    const response = await Promise.race([verifyPromise, timeoutPromise]) as StripeVerifyResponse;
    
    const data = response?.data || {};
    const error = response?.error;
    
    console.log('Session verification response:', { data, error });
    
    if (error) {
      console.error('Error verifying session with invoke:', error);
      return { success: false, error: error.message || 'Verification failed' };
    }
    
    if (data && (data.success || data.status === 'active')) {
      console.log('Session verified successfully, refreshing subscription status');
      await refreshSubscriptionStatus(userData.user.id);
      return { 
        success: true,
        status: data.status || 'active',
        currentPeriodEnd: data.currentPeriodEnd || null
      };
    }
    
    return { success: false, message: 'Session verification failed' };
  } catch (error) {
    console.error('Error in verifySession:', error);
    return { success: false, error: 'Verification process failed' };
  }
};

async function refreshSubscriptionStatus(userId: string) {
  try {
    console.log('Manually refreshing subscription status for user:', userId);
    
    const response = await supabase.functions.invoke('verify-stripe-subscription', {
      body: { user_id: userId }
    }) as StripeVerifyResponse;
    
    const data = response?.data;
    console.log('Refresh subscription result:', data);
    
    if (data && data.success) {
      return data;
    }
    
    return { success: false, message: 'Failed to refresh subscription' };
  } catch (error) {
    console.error('Error refreshing subscription status:', error);
    return { success: false, error: 'Refresh failed' };
  }
}

export const openStripeCustomerPortal = async () => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Authentication error:', userError);
      throw new Error("User not authenticated");
    }
    
    const { data, error } = await supabase.functions.invoke('create-customer-portal-session', {
      body: { 
        user_id: userData.user.id,
        return_url: window.location.origin + window.location.pathname
      }
    }) as StripeCheckoutResponse;
    
    if (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
    
    if (data && data.url) {
      window.open(data.url, '_blank');
      return true;
    } else {
      throw new Error('No portal URL returned');
    }
  } catch (error) {
    console.error('Error in openStripeCustomerPortal:', error);
    return false;
  }
};

export const createTrialSubscription = async (userId: string) => {
  try {
    console.log('Creating trial subscription for user:', userId);
    const trialEndDate = addDays(new Date(), 14);
    const currentPeriodStart = new Date();
    
    const { data: plans, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('type', 'monthly')
      .maybeSingle();
    
    if (planError || !plans) {
      console.error('Error fetching subscription plan:', planError);
      throw new Error('Failed to fetch subscription plan');
    }
    
    const { error } = await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: plans.id,
      plan_type: 'monthly',
      status: 'trial',
      trial_end_date: trialEndDate.toISOString(),
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: trialEndDate.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error creating trial subscription:', error);
      throw new Error(`Failed to create trial subscription: ${error.message}`);
    }
    
    return { 
      success: true, 
      trialEndDate: trialEndDate,
      status: 'trial'
    };
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    throw error;
  }
};
