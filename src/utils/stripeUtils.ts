
import { supabase } from "@/lib/supabase";

export const verifyStripeSubscription = async (sessionId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      body: { sessionId },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error verifying Stripe subscription:', error);
    throw error;
  }
};

export const openStripeCustomerPortal = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
      body: {},
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      window.location.href = data.url;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error opening Stripe customer portal:', error);
    return false;
  }
};
