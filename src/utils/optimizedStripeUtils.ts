
import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";
import { edgeFunctionThrottler } from "./edgeFunctionThrottler";
import { subscriptionCache } from "./subscriptionCache";

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

export const checkSubscriptionStatus = async (reason: string = 'manual_check', forceRefresh: boolean = false) => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.log('[SUBSCRIPTION_CHECK] User not authenticated');
      return { success: false, status: 'not_authenticated' };
    }

    // CRITICAL FIX: Clear cache to force fresh check after edge function fix
    if (reason === 'post_fix_refresh' || subscriptionCache.shouldForceRefresh()) {
      console.log('[SUBSCRIPTION_CHECK] Clearing cache for post-fix refresh');
      subscriptionCache.clearCache();
      forceRefresh = true;
    }

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = subscriptionCache.getCachedStatus();
      if (cached) {
        console.log(`[SUBSCRIPTION_CHECK] Using cached status for reason: ${reason}`);
        return {
          success: true,
          status: cached.status,
          planType: cached.planType,
          currentPeriodEnd: cached.currentPeriodEnd,
          trialEnd: cached.trialEnd,
          subscription_start_date: cached.subscription_start_date,
          subscription_end_date: cached.subscription_end_date
        };
      }
    }

    // For critical check on page load, clear cache to ensure fresh data
    if (reason === 'component_mount' || reason === 'page_load') {
      console.log(`[SUBSCRIPTION_CHECK] Clearing cache for fresh check on ${reason}`);
      subscriptionCache.clearCache();
    }

    // Check throttling
    if (!forceRefresh && !edgeFunctionThrottler.canCall('sync-stripe-subscription', reason)) {
      const cached = subscriptionCache.getCachedStatus();
      if (cached) {
        console.log('[SUBSCRIPTION_CHECK] Returning cached data due to throttling');
        return {
          success: true,
          status: cached.status,
          planType: cached.planType,
          currentPeriodEnd: cached.currentPeriodEnd,
          trialEnd: cached.trialEnd,
          subscription_start_date: cached.subscription_start_date,
          subscription_end_date: cached.subscription_end_date
        };
      }
      return { success: false, status: 'throttled', message: 'Too many requests, please wait' };
    }

    if (forceRefresh) {
      edgeFunctionThrottler.forceAllow('sync-stripe-subscription', reason);
    }

    console.log(`[SUBSCRIPTION_CHECK] Checking subscription status for user: ${userData.user.email}, reason: ${reason}`);
    
    // First check for ultimate subscription in the database
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    
    if (subError) {
      console.error('Error checking subscription:', subError);
      // Don't return trial_expired on database errors, let it continue to try Stripe sync
    }
    
    // If user has ultimate plan, return that immediately - NO FURTHER PROCESSING
    if (subscription && subscription.plan_type === 'ultimate') {
      console.log('[SUBSCRIPTION_CHECK] ✅ User has ULTIMATE subscription - unlimited access!');
      const result = {
        success: true,
        status: 'active', // Always active for ultimate
        planType: 'ultimate',
        subscription_start_date: subscription.subscription_start_date,
        subscription_end_date: null // Ultimate has no end date
      };
      
      subscriptionCache.setCachedStatus(result, reason);
      return result; // CRITICAL: Return immediately, don't continue to expiry checks below
    }

    // If user has any OTHER existing subscription (yearly, monthly), trust DB status
    if (subscription) {
      console.log('[SUBSCRIPTION_CHECK] User has existing non-ultimate subscription:', subscription);
      const now = new Date();
      let status = subscription.status;
      
      // CRITICAL FIX: For monthly/yearly plans, trust the DB status from Stripe webhooks
      // Don't do local expiry checks as they may be stale - DB is source of truth
      // Only check trial expiry for trial status
      if (status === 'trial' && subscription.trial_end_date) {
        const trialEnd = new Date(subscription.trial_end_date);
        if (now > trialEnd) {
          status = 'trial_expired';
          console.log('[SUBSCRIPTION_CHECK] Trial has expired');
        }
      }
      
      // For 'active' status, trust it - it's managed by Stripe webhooks
      // Don't mark as expired based on local period_end checks
      
      const result = {
        success: true,
        status: status,
        planType: subscription.plan_type,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end_date,
        subscription_start_date: subscription.subscription_start_date,
        subscription_end_date: subscription.subscription_end_date
      };
      
      subscriptionCache.setCachedStatus(result, reason);
      return result;
    }
    
    // For users without any subscription, use the sync function to check Stripe
    // Get current session to ensure we have valid auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('No valid session found for sync call');
      return { success: false, status: 'not_authenticated' };
    }
    
    const response = await supabase.functions.invoke('sync-stripe-subscription', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: { 
        user_id: userData.user.id
      }
    }) as StripeSyncResponse;
    
    const data = response?.data;
    const error = response?.error;
    
    if (error) {
      console.error('Error checking subscription status:', error);
      
      // If auth error (session expired), return not_authenticated
      if (error.message?.includes('Authentication error') || 
          error.message?.includes('Auth session missing') ||
          error.message?.includes('invalid claim')) {
        return { success: false, status: 'not_authenticated' };
      }
      
      // For other errors, return trial_expired
      return { success: false, status: 'trial_expired' };
    }
    
    console.log('Subscription status result:', data);
    
    const result = {
      success: data?.success || true,
      status: data?.status || 'trial_expired',
      currentPeriodEnd: data?.currentPeriodEnd,
      trialEnd: data?.trialEnd,
      planType: data?.planType,
      stripe_subscription_id: data?.stripe_subscription_id,
      subscription_start_date: data?.subscription_start_date,
      subscription_end_date: data?.subscription_end_date
    };

    // Cache the result
    subscriptionCache.setCachedStatus(result, reason);
    
    return result;
  } catch (error) {
    console.error('Error in checkSubscriptionStatus:', error);
    // On error, don't default to trial_expired immediately - try to get cached status first
    const cached = subscriptionCache.getCachedStatus();
    if (cached) {
      console.log('Returning cached status due to error');
      return {
        success: true,
        status: cached.status,
        planType: cached.planType,
        currentPeriodEnd: cached.currentPeriodEnd,
        trialEnd: cached.trialEnd,
        subscription_start_date: cached.subscription_start_date,
        subscription_end_date: cached.subscription_end_date
      };
    }
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
    
    // Force allow this call since it's manual
    edgeFunctionThrottler.forceAllow('sync-stripe-subscription', 'manual_sync_button');
    
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
      
      // Handle auth errors specifically
      if (error.message?.includes('Authentication error') || 
          error.message?.includes('Auth session missing') ||
          error.message?.includes('invalid claim')) {
        throw new Error('Your session has expired. Please log in again.');
      }
      
      throw new Error(error.message || 'Manual sync failed');
    }
    
    if (!data) {
      throw new Error('No data returned from sync operation');
    }
    
    // Cache the result
    subscriptionCache.setCachedStatus({
      status: data.status || 'trial_expired',
      planType: data.planType,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEnd: data.trialEnd,
      subscription_start_date: data.subscription_start_date,
      subscription_end_date: data.subscription_end_date
    }, 'manual_sync_button');
    
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
    
    // Force allow this call since it's post-payment verification
    edgeFunctionThrottler.forceAllow('sync-stripe-subscription', 'post_payment_verification');
    
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
      
      // Handle auth errors specifically
      if (error.message?.includes('Authentication error') || 
          error.message?.includes('Auth session missing') ||
          error.message?.includes('invalid claim')) {
        return { success: false, error: 'Your session has expired. Please log in again.' };
      }
      
      return { success: false, error: error.message || 'Verification failed' };
    }
    
    if (data && (data.success || data.status === 'active')) {
      console.log('Session verified successfully');
      
      // Cache the result
      subscriptionCache.setCachedStatus({
        status: data.status || 'active',
        planType: data.planType,
        currentPeriodEnd: data.currentPeriodEnd,
        subscription_start_date: data.subscription_start_date,
        subscription_end_date: data.subscription_end_date
      }, 'post_payment_verification');
      
      return { 
        success: true,
        status: data.status || 'active',
        currentPeriodEnd: data.subscription_end_date || null,
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

// Function to force refresh subscription status after fix
export const forceRefreshSubscriptionStatus = async () => {
  try {
    console.log('🔄 Force refreshing subscription status after edge function fix');
    subscriptionCache.clearCache();
    return await checkSubscriptionStatus('post_fix_refresh', true);
  } catch (error) {
    console.error('Error in forceRefreshSubscriptionStatus:', error);
    throw error;
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
