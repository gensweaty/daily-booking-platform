
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[TEST-PAYMENT-SIMULATION] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Test payment simulation started");

    // Test data from the screenshot
    const testEmail = "ycd88235@jioso.com";
    const paymentTimestamp = "Wed, 28 May 2025 21:21:04 GMT"; // From date header
    const timestampMs = 1748467264354; // From timestamp field (converted from microseconds)
    
    // Convert the GMT timestamp to ISO string for database storage
    const paymentDate = new Date(paymentTimestamp);
    const paymentDateISO = paymentDate.toISOString();
    
    logStep("Using test payment data", {
      email: testEmail,
      paymentTimestamp,
      timestampMs,
      paymentDateISO,
      paymentDateUTC: paymentDate.toUTCString()
    });

    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    
    const user = users.users.find(u => u.email === testEmail);
    if (!user) {
      throw new Error(`User not found: ${testEmail}`);
    }

    logStep("Found user", { userId: user.id, email: user.email });

    // Calculate subscription dates based on payment timestamp
    const subscriptionStartDate = paymentDateISO;
    const subscriptionEndDate = new Date(paymentDate);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // Monthly plan
    const subscriptionEndDateISO = subscriptionEndDate.toISOString();

    logStep("Calculated subscription dates", {
      startDate: subscriptionStartDate,
      endDate: subscriptionEndDateISO,
      planType: "monthly"
    });

    // Simulate Stripe customer and subscription data
    const mockStripeCustomerId = "cus_test_" + user.id.substring(0, 8);
    const mockStripeSubscriptionId = "sub_test_" + Date.now();

    // Update subscription in database
    const subscriptionData = {
      user_id: user.id,
      email: testEmail,
      status: 'active',
      stripe_customer_id: mockStripeCustomerId,
      stripe_subscription_id: mockStripeSubscriptionId,
      plan_type: 'monthly',
      current_period_start: subscriptionStartDate,
      current_period_end: subscriptionEndDateISO,
      subscription_end_date: subscriptionEndDateISO,
      trial_end_date: null, // Clear trial since this is a paid subscription
      attrs: {
        test_payment: true,
        original_timestamp: timestampMs,
        payment_date_gmt: paymentTimestamp,
        simulated: true
      },
      currency: 'usd',
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionData, { onConflict: "email" });

    if (updateError) {
      logStep("Error updating subscription", { error: updateError });
      throw updateError;
    }

    logStep("Successfully simulated payment and updated subscription", {
      userId: user.id,
      email: testEmail,
      status: 'active',
      planType: 'monthly',
      paymentDate: subscriptionStartDate,
      endDate: subscriptionEndDateISO,
      mockCustomerId: mockStripeCustomerId,
      mockSubscriptionId: mockStripeSubscriptionId
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Payment simulation completed successfully",
      data: {
        userId: user.id,
        email: testEmail,
        status: 'active',
        planType: 'monthly',
        paymentDate: subscriptionStartDate,
        endDate: subscriptionEndDateISO,
        stripeCustomerId: mockStripeCustomerId,
        stripeSubscriptionId: mockStripeSubscriptionId
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in test payment simulation", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
