
import { supabase } from "@/lib/supabase";

// Stripe product/price IDs
const STRIPE_PRICES = {
  monthly: 'price_1RRAdo2MNASmq1vOt2R6uX7Z', // Replace with your actual monthly price ID
  yearly: 'price_1RRAdp2MNASmq1vOu8SlCeH6',  // Replace with your actual yearly price ID
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
    
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: { 
        user_id: userData.user.id,
        price_id: priceId,
        return_url: window.location.origin + window.location.pathname
      }
    });
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
    
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
    
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      method: 'POST',
      body: { user_id: userData.user.id }
    });
    
    if (error) {
      console.error('Error checking subscription status:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in checkSubscriptionStatus:', error);
    throw error;
  }
};

export const verifySession = async (sessionId: string) => {
  try {
    // Fix: Use proper approach to pass session_id to edge function
    // Instead of using 'query' parameter which doesn't exist in FunctionInvokeOptions,
    // append the session_id as a URL parameter using 'headers' property
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      method: 'GET',
      body: { session_id: sessionId } // Pass as part of the body instead of query
    });
    
    if (error) {
      console.error('Error verifying session:', error);
      throw error;
    }
    
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
