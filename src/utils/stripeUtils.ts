
import { supabase } from "@/lib/supabase";

export const verifyStripeSubscription = async (sessionId: string) => {
  try {
    console.log(`stripeUtils: Verifying session ID ${sessionId}`);
    
    // Ensure we have proper authentication
    const { data: authData } = await supabase.auth.getSession();
    const token = authData?.session?.access_token;
    
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
        
        // If successful, manually update subscription status in the local database
        if (data?.success) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user?.id) {
              console.log('stripeUtils: Performing local subscription record update');
              
              const subscriptionRecord = {
                user_id: userData.user.id,
                email: userData.user.email,
                status: 'active',
                plan_type: 'monthly',
                stripe_subscription_id: data.subscription_id || 'sub_auto_local',
                updated_at: new Date().toISOString(),
              };
              
              // Try to get any existing subscription first
              const { data: existingSub } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userData.user.id)
                .maybeSingle();
                
              if (existingSub?.id) {
                // If subscription exists, update it
                const { error: updateError } = await supabase
                  .from('subscriptions')
                  .update(subscriptionRecord)
                  .eq('id', existingSub.id);
                  
                if (updateError) {
                  console.error('stripeUtils: Error updating subscription:', updateError);
                } else {
                  console.log('stripeUtils: Subscription record updated successfully');
                }
              } else {
                // If no subscription exists, insert a new one
                const { error: insertError } = await supabase
                  .from('subscriptions')
                  .insert([subscriptionRecord]);
                  
                if (insertError) {
                  console.error('stripeUtils: Error inserting subscription:', insertError);
                } else {
                  console.log('stripeUtils: Subscription record inserted successfully');
                }
              }
              
              // Force refresh auth session to ensure user gets latest claims
              await supabase.auth.refreshSession();
              console.log('stripeUtils: Auth session refreshed');
            }
          } catch (localError) {
            console.error('stripeUtils: Error in local subscription update:', localError);
          }
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

// New function to check subscription status directly
export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('stripeUtils: Checking subscription status');
    
    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error('stripeUtils: Error getting current user:', userError);
      return false;
    }
    
    // Look for active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
      
    if (subError) {
      console.error('stripeUtils: Error checking subscription status:', subError);
      return false;
    }
    
    console.log('stripeUtils: Subscription status check result:', subscription);
    return !!subscription;
  } catch (error) {
    console.error('stripeUtils: Error checking subscription status:', error);
    return false;
  }
};

// New helper function to refresh subscription status
export const refreshSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('stripeUtils: Refreshing subscription status');
    
    // Force refresh auth session
    await supabase.auth.refreshSession();
    
    // Check subscription status
    return await checkSubscriptionStatus();
  } catch (error) {
    console.error('stripeUtils: Error refreshing subscription status:', error);
    return false;
  }
};
