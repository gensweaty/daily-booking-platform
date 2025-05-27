
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's email to find Stripe customer
    const { data: stripeCustomers, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', user.email)
      .limit(1);

    if (customerError) {
      logStep("Error fetching Stripe customers", customerError);
      throw new Error(`Database error: ${customerError.message}`);
    }

    if (!stripeCustomers || stripeCustomers.length === 0) {
      logStep("No Stripe customer found");
      
      // Create or update subscriptions with trial_expired status
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          status: 'trial_expired',
          plan_type: 'monthly',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) {
        logStep("Error upserting user subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'No Stripe customer found'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripeCustomer = stripeCustomers[0];
    logStep("Found Stripe customer", { customerId: stripeCustomer.id });

    // Check for active subscriptions using Stripe Wrapper
    const currentTime = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
    const { data: activeSubscriptions, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_customer_id', stripeCustomer.id)
      .eq('status', 'active')
      .gt('current_period_end', currentTime)
      .order('current_period_end', { ascending: false })
      .limit(1);

    if (subscriptionError) {
      logStep("Error fetching Stripe subscriptions", subscriptionError);
      throw new Error(`Database error: ${subscriptionError.message}`);
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      const subscription = activeSubscriptions[0];
      logStep("Found active subscription", { subscriptionId: subscription.id });

      // Determine plan type based on subscription data
      let planType = 'monthly';
      if (subscription.attrs && subscription.attrs.items && subscription.attrs.items.data) {
        const items = subscription.attrs.items.data;
        if (items.length > 0 && items[0].price && items[0].price.recurring) {
          planType = items[0].price.recurring.interval === 'year' ? 'yearly' : 'monthly';
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'active',
        planType: planType,
        stripe_subscription_id: subscription.stripe_subscription_id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No active subscription found");
      
      // Update subscriptions with expired status
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomer.id,
          status: 'trial_expired',
          plan_type: 'monthly',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) {
        logStep("Error upserting expired subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'Customer found but no active subscription'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-stripe-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
