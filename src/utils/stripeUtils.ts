import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";

// Update the Stripe price IDs to match your actual Stripe account
// Using the price ID that was found in your Stripe account from the logs
const STRIPE_PRICES = {
  monthly: 'price_1RRIfK2MNASmq1vOrdsjIrYn', // Updated to correct price ID from logs
  yearly: 'price_1RRIfL2MNASmq1vOvYvHHZzD',  // Updated with assumed yearly price ID
};

// Stripe product IDs
const STRIPE_PRODUCTS = {
  monthly: 'prod_SM0gHgA0G0cQN3', // Your monthly product ID (unchanged)
  yearly: 'prod_SM0gLwKne0dVuy',  // Your yearly product ID (unchanged)
};

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
    
    // Start a timeout to detect function invocation issues
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000);
    });
    
    // Function invocation with the proper parameters
    const functionPromise = supabase.functions.invoke('create-stripe-checkout', {
      body: { 
        user_id: userData.user.id,
        price_id: priceId,
        product_id: productId,
        plan_type: planType,
        return_url: window.location.origin + window.location.pathname
      }
    });
    
    // Race between timeout and function call
    const { data, error } = await Promise.race([
      functionPromise,
      timeoutPromise.then(() => { throw new Error("Request timed out") })
    ]) as any;
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw error;
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
    
    // Check if this is our test user
    if (userData.user.email === 'pmb60533@toaik.com') {
      console.log('Test user detected, checking for forced trial expiration');
    }
    
    // First, check if user has a subscription
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
      
      // Return trial status
      return {
        success: true,
        status: 'trial',
        trialEnd: addDays(new Date(), 14).toISOString(),
        isTrialExpired: false
      };
    }
    
    // If subscription exists and is active, return status without verification
    if (existingSubscription.status === 'active') {
      console.log('Active subscription found, returning status without verification');
      return {
        success: true,
        status: existingSubscription.status,
        currentPeriodEnd: existingSubscription.current_period_end,
        planType: existingSubscription.plan_type,
        isTrialExpired: false,
        isSubscriptionExpired: false
      };
    }
    
    console.log('Existing subscription found, verifying with Stripe');
    
    // If subscription exists but is not active, verify its status
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      method: 'POST',
      body: { user_id: userData.user.id }
    });
    
    if (error) {
      console.error('Error checking subscription status:', error);
      // Fall back to using the database status if verification fails
      return {
        success: true,
        status: existingSubscription.status,
        currentPeriodEnd: existingSubscription.current_period_end,
        planType: existingSubscription.plan_type
      };
    }
    
    console.log('Subscription status checked:', data);
    return data;
  } catch (error) {
    console.error('Error in checkSubscriptionStatus:', error);
    throw error;
  }
};

export const verifySession = async (sessionId: string) => {
  try {
    console.log('Verifying session:', sessionId);
    
    // Fixed: Don't try to construct URL with supabase.functions.url
    // Instead, use the invoke method with appropriate parameters
    try {
      console.log('Verifying session with invoke method');
      
      const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
        method: 'GET',
        body: { session_id: sessionId }
      });
      
      if (error) {
        console.error('Error verifying session with invoke:', error);
        throw error;
      }
      
      console.log('Session verification result:', data);
      return data;
    } catch (error) {
      console.error('Error in session verification:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in verifySession:', error);
    throw error;
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
    });
    
    if (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
    
    // Open Stripe portal in a new tab
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

// Helper function to create a trial subscription for new users
export const createTrialSubscription = async (userId: string) => {
  try {
    console.log('Creating trial subscription for user:', userId);
    const trialEndDate = addDays(new Date(), 14); // 14-day trial
    const currentPeriodStart = new Date();
    
    // Fetch the monthly plan to use as the trial plan
    const { data: plans, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('type', 'monthly')
      .maybeSingle();
    
    if (planError || !plans) {
      console.error('Error fetching subscription plan:', planError);
      throw new Error('Failed to fetch subscription plan');
    }
    
    // Check if this is our test user for expiring the trial
    const { data: userInfo } = await supabase.auth.getUser();
    const isTestUser = userInfo?.user?.email === 'pmb60533@toaik.com';
    
    // Create a trial subscription - for test user, set as expired
    const { error } = await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: plans.id,
      plan_type: 'monthly',
      status: isTestUser ? 'trial_expired' : 'trial',
      trial_end_date: isTestUser ? addDays(new Date(), -1).toISOString() : trialEndDate.toISOString(),
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: isTestUser ? addDays(new Date(), -1).toISOString() : trialEndDate.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error creating trial subscription:', error);
      throw new Error(`Failed to create trial subscription: ${error.message}`);
    }
    
    return { 
      success: true, 
      trialEndDate: isTestUser ? addDays(new Date(), -1) : trialEndDate,
      status: isTestUser ? 'trial_expired' : 'trial'
    };
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    throw error;
  }
};
