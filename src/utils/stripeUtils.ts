import { supabase } from "@/lib/supabase";

/**
 * Creates a Stripe checkout session for subscription
 */
export const createStripeCheckout = async (planType: 'monthly' | 'yearly') => {
  try {
    console.log(`Creating ${planType} subscription checkout`);
    
    // Get the current user to include in metadata
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: { 
        planType,
        metadata: { user_id: userData.user.id }
      },
    });

    if (error) {
      console.error('Error creating checkout session:', error);
      throw new Error(error.message || 'Failed to create checkout session');
    }

    if (!data?.url) {
      throw new Error('No checkout URL returned');
    }

    console.log('Checkout session created successfully:', data);
    return data;
  } catch (error: any) {
    console.error('Error in createStripeCheckout:', error);
    throw new Error(error.message || 'Failed to create subscription checkout');
  }
};

/**
 * Verifies a Stripe subscription by checkout session ID
 */
export const verifyStripeSubscription = async (sessionId: string) => {
  try {
    console.log('Verifying subscription for session:', sessionId);
    
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      body: { sessionId }
    });

    if (error) {
      console.error('Error verifying subscription:', error);
      return { success: false, error: error.message };
    }

    console.log('Subscription verification result:', data);
    return data;
  } catch (error: any) {
    console.error('Error in verifyStripeSubscription:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to verify subscription'
    };
  }
};

/**
 * Checks and refreshes the subscription status for the current user
 * Returns true if the user has an active subscription
 */
export const refreshSubscriptionStatus = async (): Promise<boolean> => {
  try {
    console.log('Refreshing subscription status');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user?.id) {
      console.log('No authenticated user found');
      return false;
    }
    
    // Check for an active subscription in the database
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
      
    if (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
    
    // If found by user ID, return true
    if (subscription) {
      console.log('Active subscription found:', subscription);
      return true;
    }
    
    // If not found by user ID, try by email
    if (userData.user.email) {
      const { data: emailSub, error: emailError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('email', userData.user.email)
        .eq('status', 'active')
        .maybeSingle();
        
      if (emailError) {
        console.error('Error checking subscription by email:', emailError);
      } else if (emailSub) {
        console.log('Active subscription found by email:', emailSub);
        
        // If found by email but user_id doesn't match, update it
        if (emailSub.user_id !== userData.user.id) {
          console.log('Updating subscription user ID');
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ user_id: userData.user.id })
            .eq('id', emailSub.id);
            
          if (updateError) {
            console.error('Error updating subscription user ID:', updateError);
          }
        }
        
        return true;
      }
    }
    
    console.log('No active subscription found');
    return false;
  } catch (error: any) {
    console.error('Error in refreshSubscriptionStatus:', error);
    return false;
  }
};

/**
 * Creates a Stripe customer portal session for managing subscriptions
 */
export const createCustomerPortalSession = async () => {
  try {
    console.log('Creating customer portal session');
    
    const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {});

    if (error) {
      console.error('Error creating customer portal session:', error);
      throw new Error(error.message || 'Failed to create customer portal session');
    }

    if (!data?.url) {
      throw new Error('No portal URL returned');
    }

    console.log('Customer portal session created successfully');
    return data;
  } catch (error: any) {
    console.error('Error in createCustomerPortalSession:', error);
    throw new Error(error.message || 'Failed to create customer portal session');
  }
};

/**
 * Opens the Stripe customer portal in a new tab
 * Returns true if the portal was successfully opened
 */
export const openStripeCustomerPortal = async (): Promise<boolean> => {
  try {
    console.log('Opening Stripe customer portal');
    
    const { url } = await createCustomerPortalSession();
    
    if (!url) {
      console.error('No portal URL returned');
      return false;
    }
    
    window.open(url, '_blank');
    return true;
  } catch (error: any) {
    console.error('Error opening customer portal:', error);
    return false;
  }
};
