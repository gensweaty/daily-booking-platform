
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Safe timestamp conversion function
function safeTimestamp(timestamp: number | null | undefined): string | null {
  if (timestamp == null || typeof timestamp !== 'number') {
    logStep("Timestamp is null or undefined", { timestamp });
    return null;
  }
  
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logStep("Invalid timestamp value", { timestamp });
    return null;
  }
  
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      logStep("Date creation failed", { timestamp, date });
      return null;
    }
    return date.toISOString();
  } catch (error) {
    logStep("Error converting timestamp", { timestamp, error: error.message });
    return null;
  }
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

    // Check for existing subscription record first
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSubscription?.stripe_customer_id) {
      logStep("Found existing subscription with customer ID", { 
        customerId: existingSubscription.stripe_customer_id 
      });

      // Check subscription status using REST API
      const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
      const subscriptionsResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${existingSubscription.stripe_customer_id}&status=active&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${stripeApiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (subscriptionsResponse.ok) {
        const subscriptions = await subscriptionsResponse.json();
        
        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
          const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
          
          logStep("Found active subscription", { 
            subscriptionId: subscription.id,
            planType,
            currentPeriodEnd 
          });

          // Update subscription record using email for conflict resolution
          const { error: updateError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: user.id,
              email: user.email,
              status: 'active',
              plan_type: planType,
              current_period_end: currentPeriodEnd,
              subscription_end_date: currentPeriodEnd,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: existingSubscription.stripe_customer_id,
              attrs: subscription,
              currency: subscription.currency || 'usd',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'email'
            });

          if (updateError) {
            logStep("Error updating subscription", updateError);
            throw updateError;
          }

          return new Response(JSON.stringify({
            success: true,
            status: 'active',
            planType: planType,
            stripe_subscription_id: subscription.id,
            currentPeriodEnd: currentPeriodEnd
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Try to find Stripe customer by email using REST API
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const customersResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!customersResponse.ok) {
      logStep("Error fetching customers from Stripe", { status: customersResponse.status });
      throw new Error(`Failed to fetch customers: ${customersResponse.status}`);
    }

    const customers = await customersResponse.json();
    
    if (!customers.data || customers.data.length === 0) {
      logStep("No Stripe customer found");
      
      // Create or update subscriptions with trial_expired status using email conflict resolution
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          status: 'trial_expired',
          plan_type: 'monthly',
          currency: 'usd',
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

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

    const stripeCustomer = customers.data[0];
    logStep("Found Stripe customer", { customerId: stripeCustomer.id });

    // Check for active subscriptions
    const subscriptionsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${stripeCustomer.id}&status=active&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!subscriptionsResponse.ok) {
      throw new Error(`Failed to fetch subscriptions: ${subscriptionsResponse.status}`);
    }

    const subscriptions = await subscriptionsResponse.json();

    if (subscriptions.data && subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      logStep("Found active subscription", { subscriptionId: subscription.id });

      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
      const currentPeriodStart = safeTimestamp(subscription.current_period_start);

      // Update subscription record using email for conflict resolution
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomer.id,
          stripe_subscription_id: subscription.id,
          status: 'active',
          plan_type: planType,
          current_period_end: currentPeriodEnd,
          current_period_start: currentPeriodStart,
          subscription_end_date: currentPeriodEnd,
          attrs: subscription,
          currency: subscription.currency || 'usd',
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

      if (upsertError) {
        logStep("Error upserting subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'active',
        planType: planType,
        stripe_subscription_id: subscription.id,
        currentPeriodEnd: currentPeriodEnd
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No active subscription found");
      
      // Update subscriptions with expired status using email conflict resolution
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomer.id,
          status: 'trial_expired',
          plan_type: 'monthly',
          currency: 'usd',
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

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
