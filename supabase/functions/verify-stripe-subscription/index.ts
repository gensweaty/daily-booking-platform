
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Stripe with minimal configuration
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-11-20",
  httpClient: Stripe.createFetchHttpClient()
});

// Supabase admin client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step, data) {
  console.log(`[STRIPE-WEBHOOK] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  logStep("Webhook request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Handle webhook verification
    if (req.headers.get("stripe-signature")) {
      return await handleWebhook(req);
    }
    
    // Handle manual verification requests
    if (req.method === "POST") {
      const body = await req.json();
      
      if (body.session_id) {
        return await handleSessionVerification(body);
      }
      
      if (body.user_id) {
        return await handleManualSync(body);
      }
    }
    
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: corsHeaders
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Global error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

async function handleWebhook(req) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("No signature header found");
    return new Response("Missing stripe-signature header", {
      status: 400,
      headers: corsHeaders
    });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logStep("No webhook secret configured");
    return new Response("Webhook secret not configured", {
      status: 500,
      headers: corsHeaders
    });
  }

  const body = await req.text();
  logStep("Body received", { length: body.length });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
    logStep("Webhook verified successfully", {
      type: event.type,
      id: event.id
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("Webhook verification failed", { error: errorMessage });
    return new Response(`Webhook verification failed: ${errorMessage}`, {
      status: 400,
      headers: corsHeaders
    });
  }

  // Process different event types
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    logStep("Event processed successfully");
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing event", { error: errorMessage });
    return new Response(`Error processing event: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}

async function handleCheckoutCompleted(session) {
  logStep("Processing checkout completion", { sessionId: session.id });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;

  if (!subscriptionId) {
    logStep("No subscription in checkout session");
    return;
  }

  // PRIORITY 1: Try to get user_id from metadata (CRITICAL FIX)
  let userId = session.metadata?.user_id;
  logStep("User ID from metadata", { userId });
  
  // PRIORITY 2: Find user by email if no metadata
  if (!userId && customerEmail) {
    logStep("Searching for user by email", { email: customerEmail });
    const { data: users } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    const matchingUser = users.users.find(u => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", { userId, email: customerEmail });
    }
  }

  // PRIORITY 3: Try to find user by customer ID in our database
  if (!userId && customerId) {
    logStep("Searching for user by customer ID", { customerId });
    const { data: existingRecord } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .single();
    
    if (existingRecord) {
      userId = existingRecord.user_id;
      logStep("Found user by customer ID", { userId, customerId });
    }
  }

  if (!userId) {
    logStep("CRITICAL ERROR: No user found for checkout session", {
      sessionId: session.id,
      customerId,
      customerEmail,
      metadata: session.metadata
    });
    return;
  }

  try {
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Update database with proper error handling
    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        email: customerEmail,
        status: "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_type: planType,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (error) {
      logStep("Database update failed", { error });
      throw error;
    }

    logStep("Subscription activated successfully", {
      userId,
      subscriptionId,
      planType,
      email: customerEmail
    });
  } catch (error) {
    logStep("Error processing checkout", { 
      error: error instanceof Error ? error.message : String(error),
      userId,
      sessionId: session.id
    });
    throw error;
  }
}

async function handleSubscriptionEvent(subscription) {
  logStep("Processing subscription event", {
    subscriptionId: subscription.id,
    status: subscription.status
  });

  try {
    // Find user by customer ID
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", subscription.customer)
      .limit(1);

    if (error || !data || data.length === 0) {
      logStep("No user found for customer", { customerId: subscription.customer });
      return;
    }

    const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Update subscription
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: subscription.status === "active" ? "active" : "inactive",
        plan_type: planType,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", data[0].user_id);

    if (updateError) {
      logStep("Error updating subscription", { updateError });
      throw updateError;
    }

    logStep("Subscription updated successfully", {
      userId: data[0].user_id,
      status: subscription.status
    });
  } catch (error) {
    logStep("Error processing subscription event", { error });
    throw error;
  }
}

async function handleSubscriptionCanceled(subscription) {
  logStep("Processing subscription cancellation", {
    subscriptionId: subscription.id
  });

  try {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      logStep("Error canceling subscription", { error });
      throw error;
    }

    logStep("Subscription canceled successfully");
  } catch (error) {
    logStep("Error processing cancellation", { error });
    throw error;
  }
}

// Handle session verification from client
async function handleSessionVerification(body) {
  const { session_id, user_id } = body;
  
  if (!session_id) {
    return new Response(
      JSON.stringify({ success: false, error: "Session ID is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  logStep("Verifying session", { sessionId: session_id });
  
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (!session || session.status !== "complete") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // If session is complete, trigger checkout processing manually
    if (session.subscription) {
      await handleCheckoutCompleted(session);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'active'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error verifying session: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
}

// Handle manual sync from client
async function handleManualSync(body) {
  const { user_id } = body;
  
  if (!user_id) {
    return new Response(
      JSON.stringify({ success: false, error: "User ID is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  logStep("Manual sync requested", { userId: user_id });
  
  try {
    // Get user's subscription from database
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user_id)
      .single();
    
    if (!subData?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No Stripe customer found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: subData.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      // Update database
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          stripe_subscription_id: subscription.id,
          plan_type: planType,
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user_id);
      
      logStep("Manual sync successful", { userId: user_id, status: "active" });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "active",
          planType: planType,
          currentPeriodEnd: currentPeriodEnd.toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({ success: true, status: "trial_expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error in manual sync: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}
