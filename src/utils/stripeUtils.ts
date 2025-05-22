
import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";

// Stripe product/price IDs
const STRIPE_PRICES = {
  monthly: 'price_1RRAdo2MNASmq1vOt2R6uX7Z', // Your monthly price ID
  yearly: 'price_1RRAdp2MNASmq1vOu8SlCeH6',  // Your yearly price ID
};

// Stripe product IDs
const STRIPE_PRODUCTS = {
  monthly: 'prod_SM0gHgA0G0cQN3', // Your monthly product ID
  yearly: 'prod_SM0gLwKne0dVuy',  // Your yearly product ID
};

export const createCheckoutSession = async (planType: 'monthly' | 'yearly') => {
  try {
    const user = supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }
    
    const { data: userData } = await user;
    
    if (!userData?.user) {
      throw new Error("User not found");
    }
    
    const priceId = STRIPE_PRICES[planType];
    const productId = STRIPE_PRODUCTS[planType];
    
    console.log(`Creating checkout session for ${planType} plan:`, { priceId, productId });
    
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: { 
        user_id: userData.user.id,
        price_id: priceId,
        product_id: productId,
        plan_type: planType,
        return_url: window.location.origin + window.location.pathname
      }
    });
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw error;
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
    const user = supabase.auth.getUser();
    
    if (!user) {
      return { status: 'not_authenticated' };
    }
    
    const { data: userData } = await user;
    
    if (!userData?.user) {
      return { status: 'not_authenticated' };
    }
    
    // First, check if user has a subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    // If no subscription exists, create a trial subscription
    if (!existingSubscription) {
      console.log('No subscription found, creating trial subscription');
      await createTrialSubscription(userData.user.id);
      
      // Return trial status
      return {
        status: 'trial',
        trialEnd: addDays(new Date(), 14).toISOString(),
        isTrialExpired: false
      };
    }
    
    // If subscription exists, verify its status
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      method: 'POST',
      body: { user_id: userData.user.id }
    });
    
    if (error) {
      console.error('Error checking subscription status:', error);
      throw error;
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
    
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      method: 'GET',
      body: { session_id: sessionId }
    });
    
    if (error) {
      console.error('Error verifying session:', error);
      throw error;
    }
    
    console.log('Session verification result:', data);
    return data;
  } catch (error) {
    console.error('Error in verifySession:', error);
    throw error;
  }
};

export const openStripeCustomerPortal = async () => {
  try {
    const user = supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }
    
    const { data: userData } = await user;
    
    if (!userData?.user) {
      throw new Error("User not found");
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
    window.open(data.url, '_blank');
    return true;
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
    
    // Create a trial subscription
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
    
    return { success: true, trialEndDate };
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    throw error;
  }
};
