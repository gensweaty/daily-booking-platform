
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Stripe with correct API version
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient()
});

// Supabase admin client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function logStep(step, data) {
  console.log(`[STRIPE-WEBHOOK] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  logStep("Webhook request received");
  
  // Get signature header
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("No signature header found");
    return new Response("Missing stripe-signature header", {
      status: 400
    });
  }
  
  // Get webhook secret
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logStep("No webhook secret configured");
    return new Response("Webhook secret not configured", {
      status: 500
    });
  }
  
  // Get raw body
  const body = await req.text();
  logStep("Body received", {
    length: body.length
  });
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    logStep("Webhook verified successfully", {
      type: event.type,
      id: event.id
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("Webhook verification failed", {
      error: errorMessage
    });
    return new Response(`Webhook verification failed: ${errorMessage}`, {
      status: 400
    });
  }
  
  // Process different event types
  try {
    switch(event.type) {
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
        logStep("Unhandled event type", {
          type: event.type
        });
    }
    
    logStep("Event processed successfully");
    return new Response(JSON.stringify({
      received: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing event", {
      error: errorMessage
    });
    return new Response(`Error processing event: ${errorMessage}`, {
      status: 500
    });
  }
});

// Handle checkout session completion
async function handleCheckoutCompleted(session) {
  logStep("Processing checkout completion", {
    sessionId: session.id
  });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  if (!subscriptionId) {
    logStep("No subscription in checkout session");
    return;
  }
  
  // Enhanced user identification with multiple fallback methods
  let userId = session.metadata?.user_id || session.metadata?.supabase_user_id;
  
  // Fallback 1: Find by email in auth.users
  if (!userId && customerEmail) {
    const { data: users } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    const matchingUser = users.users.find((u) => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", {
        userId,
        email: customerEmail
      });
    }
  }
  
  // Fallback 2: Check existing subscription records
  if (!userId && customerId) {
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .single();
    
    if (existingSub?.user_id) {
      userId = existingSub.user_id;
      logStep("Found user from existing subscription", { userId, customerId });
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
    
    // Update database
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
        current_period_start: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });
    
    if (error) {
      logStep("Database update failed", {
        error
      });
      throw error;
    }
    
    logStep("Subscription activated successfully", {
      userId,
      subscriptionId,
      planType
    });
  } catch (error) {
    logStep("Error processing checkout", {
      error
    });
    throw error;
  }
}

// Handle subscription events
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
      logStep("No user found for customer", {
        customerId: subscription.customer
      });
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
      logStep("Error updating subscription", {
        updateError
      });
      throw updateError;
    }
    
    logStep("Subscription updated successfully", {
      userId: data[0].user_id,
      status: subscription.status
    });
  } catch (error) {
    logStep("Error processing subscription event", {
      error
    });
    throw error;
  }
}

// Handle subscription cancellation
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
      logStep("Error canceling subscription", {
        error
      });
      throw error;
    }
    
    logStep("Subscription canceled successfully");
  } catch (error) {
    logStep("Error processing cancellation", {
      error
    });
    throw error;
  }
}
