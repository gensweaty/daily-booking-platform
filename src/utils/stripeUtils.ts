import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";

// Update the Stripe price IDs to match your actual Stripe account
const STRIPE_PRICES = {
  monthly: 'price_1RRISL2MNASmq1vOfx6ncBtl',
  yearly: 'price_1RRIZ52MNASmq1vOm0iaPvzH',
};

interface StripeCheckoutResponse {
  data?: {
    url?: string;
    [key: string]: any;
  };
  error?: {
    message?: string;
    details?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

interface StripeSyncResponse {
  data?: {
    success?: boolean;
    status?: string;
    currentPeriodEnd?: string;
    planType?: string;
    stripe_subscription_id?: string;
    subscription_start_date?: string;
    subscription_end_date?: string;
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
    console.log(`🔥 YEARLY DEBUG: Starting checkout session creation for ${planType} plan`);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('❌ YEARLY DEBUG: Authentication error:', userError);
      throw new Error("User not authenticated");
    }
    
    // Get session for authorization header
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      console.error('❌ YEARLY DEBUG: No access token found');
      throw new Error("No access token available");
    }
    
    const priceId = STRIPE_PRICES[planType];
    console.log(`🔥 YEARLY DEBUG: Using price ID for ${planType}:`, priceId);
    
    const requestPayload = { 
      user_id: userData.user.id,
      price_id: priceId,
      plan_type: planType,
      return_url: window.location.origin + window.location.pathname
    };
    
    console.log(`🔥 YEARLY DEBUG: Sending request payload:`, requestPayload);
    console.log(`🔥 YEARLY DEBUG: Using access token:`, accessToken ? 'Present' : 'Missing');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000);
    });
    
    const functionPromise = supabase.functions.invoke('create-stripe-checkout', {
      body: requestPayload,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    console.log(`🔥 YEARLY DEBUG: Invoking create-stripe-checkout function with auth header...`);
    
    const response = await Promise.race([
      functionPromise,
      timeoutPromise.catch(err => { throw err; })
    ]) as StripeCheckoutResponse;
    
    console.log(`🔥 YEARLY DEBUG: Raw response from create-stripe-checkout:`, response);
    
    const data = response?.data;
    const error = response?.error;
    
    if (error) {
      console.error('❌ YEARLY DEBUG: Error from edge function:', error);
      
      // Handle specific error types with user-friendly messages
      if (error.message?.includes('not a recurring price')) {
        throw new Error(`The ${planType} plan is not properly configured as a subscription. Please contact support to fix this issue.`);
      } else if (error.message?.includes('not active')) {
        throw new Error(`The ${planType} plan is currently unavailable. Please try again later or contact support.`);
      } else if (error.message?.includes('Invalid price ID')) {
        throw new Error(`The ${planType} plan configuration is invalid. Please contact support.`);
      }
      
      throw new Error(error.message || 'Failed to create checkout session');
    }
    
    if (!data || !data.url) {
      console.error('❌ YEARLY DEBUG: No URL returned. Response data:', data);
      throw new Error('Failed to create checkout session - no URL returned');
    }
    
    console.log(`✅ YEARLY DEBUG: Checkout session created successfully:`, data);
    return data;
  } catch (error) {
    console.error('❌ YEARLY DEBUG: Error in createCheckoutSession:', error);
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
    
    // Use the updated sync function to check status
    const response = await supabase.functions.invoke('sync-stripe-subscription', {
      body: { 
        user_id: userData.user.id
      }
    }) as StripeSyncResponse;
    
    const data = response?.data;
    const error = response?.error;
    
    if (error) {
      console.error('Error checking subscription status:', error);
      return { success: false, status: 'trial_expired' };
    }
    
    console.log('Subscription status result:', data);
    
    return {
      success: data?.success || true,
      status: data?.status || 'trial_expired',
      currentPeriodEnd: data?.currentPeriodEnd,
      trialEnd: data?.trialEnd,
      planType: data?.planType,
      stripe_subscription_id: data?.stripe_subscription_id,
      subscription_start_date: data?.subscription_start_date,
      subscription_end_date: data?.subscription_end_date
    };
  } catch (error) {
    console.error('Error in checkSubscriptionStatus:', error);
    return { success: false, status: 'trial_expired' };
  }
};

// Enhanced manual sync function
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
    
    const syncPromise = supabase.functions.invoke('sync-stripe-subscription', {
      body: { 
        user_id: userData.user.id
      }
    });
    
    const response = await Promise.race([syncPromise, timeoutPromise]) as StripeSyncResponse;
    
    console.log('Raw response from sync-stripe-subscription:', response);
    
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
    
    // After payment, sync the subscription status
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Session verification timed out after 30 seconds")), 30000);
    });
    
    const syncPromise = supabase.functions.invoke('sync-stripe-subscription', {
      body: { 
        user_id: userData.user.id
      }
    });
    
    const response = await Promise.race([syncPromise, timeoutPromise]) as StripeSyncResponse;
    
    const data = response?.data || {};
    const error = response?.error;
    
    console.log('Session verification response:', { data, error });
    
    if (error) {
      console.error('Error verifying session:', error);
      return { success: false, error: error.message || 'Verification failed' };
    }
    
    if (data && (data.success || data.status === 'active')) {
      console.log('Session verified successfully');
      return { 
        success: true,
        status: data.status || 'active',
        currentPeriodEnd: data.currentPeriodEnd || null,
        subscription_start_date: data.subscription_start_date,
        subscription_end_date: data.subscription_end_date
      };
    }
    
    return { success: false, message: 'Session verification failed' };
  } catch (error) {
    console.error('Error in verifySession:', error);
    return { success: false, error: 'Verification process failed' };
  }
};

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
    
    console.log('Found plan:', plans);
    
    // Calculate dates
    const trialEnd = addDays(new Date(), 14); // 14-day trial
    
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
