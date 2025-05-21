
import { supabase } from "@/lib/supabase";

export const verifyStripeSubscription = async (sessionId: string) => {
  try {
    console.log(`stripeUtils: Verifying session ID ${sessionId}`);
    
    const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
      body: { sessionId },
    });

    if (error) {
      console.error('stripeUtils: Error invoking verify-stripe-subscription:', error);
      throw error;
    }

    console.log('stripeUtils: Verification result:', data);
    
    // If successful, manually update subscription status in the local database
    // This is a backup in case the edge function did not succeed
    if (data?.success) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          console.log('stripeUtils: Performing local subscription record update');
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userData.user.id,
              email: userData.user.email,
              status: 'active',
              plan_type: 'monthly',
              stripe_subscription_id: data.subscription_id || 'sub_auto_local',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
            
          if (updateError) {
            console.error('stripeUtils: Error updating local subscription:', updateError);
          } else {
            console.log('stripeUtils: Local subscription record updated successfully');
          }
        }
      } catch (localError) {
        console.error('stripeUtils: Error in local subscription update:', localError);
      }
    }

    return data;
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
