
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[REPAIR-SUBSCRIPTIONS] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Repair function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get Stripe API key
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    if (!stripeApiKey) throw new Error("Stripe API key not configured");

    // First, get all customers from Stripe to find this user
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
      throw new Error(`Failed to fetch customers: ${customersResponse.status}`);
    }

    const customers = await customersResponse.json();
    
    if (!customers.data || customers.data.length === 0) {
      logStep("No Stripe customer found for user");
      return new Response(JSON.stringify({
        success: false,
        message: "No Stripe customer found for this user"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const stripeCustomer = customers.data[0];
    const customerId = stripeCustomer.id;
    logStep("Found Stripe customer", { customerId, email: user.email });

    // Get all subscriptions for this customer (active and inactive)
    const subscriptionsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&limit=10`,
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
    logStep("Retrieved subscriptions from Stripe", { 
      count: subscriptions.data.length,
      subscriptions: subscriptions.data.map(s => ({
        id: s.id,
        status: s.status,
        created: s.created,
        current_period_start: s.current_period_start,
        current_period_end: s.current_period_end
      }))
    });

    if (subscriptions.data.length === 0) {
      logStep("No subscriptions found for customer");
      return new Response(JSON.stringify({
        success: false,
        message: "No subscriptions found for this customer"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Find the most recent active subscription or the latest one if none are active
    let targetSubscription = subscriptions.data.find(s => s.status === 'active');
    if (!targetSubscription) {
      // If no active subscription, get the most recent one
      targetSubscription = subscriptions.data.sort((a, b) => b.created - a.created)[0];
    }

    logStep("Target subscription identified", {
      subscriptionId: targetSubscription.id,
      status: targetSubscription.status,
      created: new Date(targetSubscription.created * 1000).toISOString(),
      current_period_start: new Date(targetSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(targetSubscription.current_period_end * 1000).toISOString()
    });

    // Extract subscription details
    const planType = targetSubscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
    
    // Use the subscription creation time as the true start date
    const subscriptionCreatedDate = new Date(targetSubscription.created * 1000).toISOString();
    const currentPeriodStart = new Date(targetSubscription.current_period_start * 1000).toISOString();
    const currentPeriodEnd = new Date(targetSubscription.current_period_end * 1000).toISOString();
    
    // Calculate manual end date based on creation date and plan type
    const createdDate = new Date(targetSubscription.created * 1000);
    const manualEndDate = new Date(createdDate);
    if (planType === "monthly") {
      manualEndDate.setMonth(manualEndDate.getMonth() + 1);
    } else {
      manualEndDate.setFullYear(manualEndDate.getFullYear() + 1);
    }
    const manualEndDateISO = manualEndDate.toISOString();

    logStep("Calculated subscription dates", {
      subscriptionCreatedDate,
      currentPeriodStart,
      currentPeriodEnd,
      manualEndDate: manualEndDateISO,
      planType
    });

    // Update the subscription in our database with the correct information
    const subscriptionData = {
      user_id: user.id,
      email: user.email,
      status: targetSubscription.status === 'active' ? 'active' : 'expired',
      stripe_customer_id: customerId,
      stripe_subscription_id: targetSubscription.id,
      plan_type: planType,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      subscription_end_date: currentPeriodEnd,
      trial_end_date: null, // Clear trial since this is a paid subscription
      attrs: targetSubscription,
      currency: targetSubscription.currency || 'usd',
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionData, { onConflict: "email" });

    if (updateError) {
      logStep("Error updating subscription", { error: updateError });
      throw updateError;
    }

    logStep("Successfully repaired subscription", {
      userId: user.id,
      email: user.email,
      subscriptionId: targetSubscription.id,
      status: subscriptionData.status,
      planType: planType,
      actualPaymentDate: subscriptionCreatedDate
    });

    // Trigger frontend refresh
    const refreshData = {
      success: true,
      status: subscriptionData.status,
      planType: planType,
      stripe_subscription_id: targetSubscription.id,
      currentPeriodEnd: currentPeriodEnd,
      actualPaymentDate: subscriptionCreatedDate
    };

    return new Response(JSON.stringify(refreshData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in repair-subscriptions", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
