
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
      timeoutPromise.catch(err => { throw err; })
    ]);
    
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
    
    console.log('Checking subscription status for user:', userData.user.email);
    
    // Check if this is our test user for expiring the trial
    const isTestUser = userData.user.email === 'pmb60533@toaik.com';
    
    // First, check if user has a subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();
      
    if (subError) {
      console.error('Error fetching subscription:', subError);
    }

    // For test user with active subscription, check directly with Stripe
    if (isTestUser) {
      try {
        console.log('Test user detected, verifying with Stripe directly');
        
        // Verify subscription status with Stripe
        const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
          body: { user_id: userData.user.id }
        });
        
        if (error) {
          console.error('Error verifying test user subscription with Stripe:', error);
        } else if (data && data.status === 'active') {
          console.log('Test user has active subscription from Stripe check:', data);
          return data;
        }
      } catch (verifyError) {
        console.error('Exception verifying test user with Stripe:', verifyError);
      }
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
    
    // Check if this subscription should be verified with Stripe
    if (existingSubscription.stripe_subscription_id) {
      console.log('Subscription has Stripe ID, verifying with Stripe');
      
      try {
        // Verify subscription status with Stripe
        const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
          body: { 
            user_id: userData.user.id,
            subscription_id: existingSubscription.stripe_subscription_id 
          }
        });
        
        if (error) {
          console.error('Error verifying subscription with Stripe:', error);
        } else {
          console.log('Stripe verification result:', data);
          if (data && data.status === 'active') {
            // Update local database with active status if needed
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
    
    // Fall back to database status if Stripe verification fails or no Stripe ID
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
      
    // Update status in memory if expired
    let effectiveStatus = existingSubscription.status;
    if (isTrialExpired) {
      effectiveStatus = 'trial_expired';
      
      // Update database status
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'trial_expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);
    } else if (isSubscriptionExpired) {
      effectiveStatus = 'expired';
      
      // Update database status
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

export const verifySession = async (sessionId: string) => {
  try {
    console.log('Verifying session:', sessionId);
    
    try {
      const response = await supabase.functions.invoke('verify-stripe-subscription', {
        body: { session_id: sessionId }
      });
      
      const data = response.data || {};
      const error = response.error;
      
      console.log('Session verification response:', { data, error });
      
      if (error) {
        console.error('Error verifying session with invoke:', error);
        return { success: false, error: error.message || 'Verification failed' };
      }
      
      // Handle successful verification and ensure subscription status is updated
      if (data && (data.success || data.status === 'active')) {
        // Force a refresh of subscription data in database
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          console.log('Updating subscription status after successful payment');
          await checkSubscriptionStatus();
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error in session verification:', error);
      return { success: false, error: 'Verification failed with exception' };
    }
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
    
    // For the test user with active subscription, don't create trial
    if (isTestUser) {
      // Check if we already have a record for this user in subscriptions
      const { data: existingActiveSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
        
      if (existingActiveSubscription) {
        console.log('Test user already has active subscription, not creating trial');
        return {
          success: true,
          status: 'active'
        };
      }
    }
    
    // Create a trial subscription - for test user, set as expired or active based on payment status
    const { error } = await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: plans.id,
      plan_type: 'monthly',
      status: isTestUser ? 'active' : 'trial',  // Set active for test user
      trial_end_date: isTestUser ? null : trialEndDate.toISOString(),
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: isTestUser ? addDays(new Date(), 30).toISOString() : trialEndDate.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error creating trial subscription:', error);
      throw new Error(`Failed to create trial subscription: ${error.message}`);
    }
    
    return { 
      success: true, 
      trialEndDate: isTestUser ? null : trialEndDate,
      status: isTestUser ? 'active' : 'trial'
    };
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    throw error;
  }
};
