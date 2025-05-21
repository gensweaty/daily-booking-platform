import { supabase } from "@/lib/supabase";

export const verifyStripeSubscription = async (sessionId: string) => {
  try {
    console.log(`stripeUtils: Verifying session ID ${sessionId}`);
    
    // Ensure we have proper authentication
    const { data: authData } = await supabase.auth.getSession();
    const token = authData?.session?.access_token;
    
    if (!token) {
      console.warn('stripeUtils: No auth token available. This might cause issues if JWT verification is required.');
    }
    
    // Add retry logic with backoff
    const maxRetries = 5;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        // Call verify-stripe-subscription edge function with proper auth header
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-stripe-subscription`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({ sessionId }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error: ${response.status}, ${errorText}`);
        }

        const data = await response.json();
        console.log('stripeUtils: Verification result:', data);
        
        // The edge function now handles all DB operations
        // Just return the result to the caller
        
        // If successful, force refresh auth session
        if (data?.success) {
          // Force refresh auth session to ensure user gets latest claims
          await supabase.auth.refreshSession();
          console.log('stripeUtils: Auth session refreshed after successful verification');
        }

        return data;
      } catch (retryError) {
        console.error(`stripeUtils: Error in attempt ${retryCount + 1}:`, retryError);
        lastError = retryError;
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Exponential backoff
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`stripeUtils: Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // If we got here, all retries failed
    throw lastError || new Error('All verification attempts failed');
  } catch (error) {
    console.error('Error verifying Stripe subscription:', error);
    throw error;
  }
};

export const openStripeCustomerPortal = async () => {
  try {
    console.log('stripeUtils: Opening Stripe customer portal');
    
    const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
      body: {},
    });

    if (error) {
      console.error('stripeUtils: Error invoking stripe-customer-portal:', error);
      throw error;
    }

    console.log('stripeUtils: Customer portal result:', data);
    
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

// Improved function to check subscription status directly
export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('stripeUtils: Checking subscription status');
    
    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error('stripeUtils: Error getting current user:', userError);
      return false;
    }
    
    // Look for active subscription with multiple checks
    const userId = userData.user.id;
    const email = userData.user.email;
    
    console.log(`stripeUtils: Checking subscription for user ${userId} (${email})`);
    
    // First try by user_id
    const { data: subscriptionByUserId, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
      
    if (subError) {
      console.error('stripeUtils: Error checking subscription by user_id:', subError);
    } else if (subscriptionByUserId) {
      console.log('stripeUtils: Found active subscription by user_id:', subscriptionByUserId);
      return true;
    }
    
    // If no match by user_id and we have an email, try by email
    if (email && !subscriptionByUserId) {
      const { data: subscriptionByEmail, error: emailSubError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle();
        
      if (emailSubError) {
        console.error('stripeUtils: Error checking subscription by email:', emailSubError);
      } else if (subscriptionByEmail) {
        console.log('stripeUtils: Found active subscription by email:', subscriptionByEmail);
        
        // If found by email but user_id doesn't match, update the record
        if (subscriptionByEmail.user_id !== userId) {
          console.log('stripeUtils: Updating subscription user_id to match current user');
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ user_id: userId })
            .eq('id', subscriptionByEmail.id);
            
          if (updateError) {
            console.error('stripeUtils: Error updating subscription user_id:', updateError);
          }
        }
        
        return true;
      }
    }
    
    console.log('stripeUtils: No active subscription found for user');
    return false;
  } catch (error) {
    console.error('stripeUtils: Error checking subscription status:', error);
    return false;
  }
};

// Enhanced helper function to refresh subscription status
export const refreshSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('stripeUtils: Refreshing subscription status');
    
    // Force refresh auth session
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error('stripeUtils: Error refreshing auth session:', refreshError);
    }
    
    // Check subscription status with multiple attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      const isActive = await checkSubscriptionStatus();
      if (isActive) {
        console.log(`stripeUtils: Active subscription found on attempt ${attempt + 1}`);
        return true;
      }
      
      if (attempt < 2) {
        console.log(`stripeUtils: No active subscription found on attempt ${attempt + 1}, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('stripeUtils: No active subscription found after multiple attempts');
    return false;
  } catch (error) {
    console.error('stripeUtils: Error refreshing subscription status:', error);
    return false;
  }
};
