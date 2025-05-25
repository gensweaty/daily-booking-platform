
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase admin client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step, data) {
  console.log(`[VERIFY-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Simplified webhook signature verification using Web Crypto API
async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Parse the signature header to get the timestamp and signature
    const elements = signature.split(',');
    let timestamp = '';
    let v1Signature = '';

    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v1') {
        v1Signature = value;
      }
    }

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Create the signed payload
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return expectedHex === v1Signature;
  } catch (error) {
    logStep("Webhook verification error", { error: error.message });
    return false;
  }
}

// Simple Stripe API call without SDK
async function makeStripeApiCall(endpoint: string, method = 'GET') {
  const apiKey = Deno.env.get("STRIPE_API_KEY");
  if (!apiKey) throw new Error("STRIPE_API_KEY not configured");

  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(`Stripe API error: ${response.status}`);
  }

  return await response.json();
}

serve(async (req) => {
  logStep("Request received", { method: req.method });
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    if (req.method === "POST") {
      const body = await req.text();
      
      // Check if this is a webhook event (has stripe-signature header)
      const signature = req.headers.get("stripe-signature");
      if (signature) {
        return await handleWebhookEvent(body, signature);
      }
      
      // Parse JSON for non-webhook requests
      const parsedBody = JSON.parse(body);
      
      if (parsedBody.session_id) {
        return await handleSessionVerification(parsedBody);
      }
      
      if (parsedBody.user_id) {
        return await handleManualSync(parsedBody);
      }
    }
    
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Global error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Handle webhook events from Stripe
async function handleWebhookEvent(body: string, signature: string) {
  logStep("Processing webhook event");
  
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    // Verify the webhook signature
    const isValid = await verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      logStep("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const event = JSON.parse(body);
    logStep("Webhook verified", { type: event.type, id: event.id });

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      await handleCustomerSubscriptionUpdated(event.data.object);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    } else {
      logStep("Unhandled webhook event type", { type: event.type });
      return new Response(JSON.stringify({ success: true, message: "Event type not handled" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing webhook", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// Handle customer subscription updated webhook
async function handleCustomerSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  
  logStep("Processing subscription update", { customerId, subscriptionId, status: subscription.status });

  // Get the associated user from Supabase
  const { data: subsData } = await supabase
    .from('subscriptions')
    .select('user_id, email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!subsData || !subsData.user_id) {
    logStep("User not found for customer, trying email lookup", { customerId });
    
    // Try to find by email from Stripe customer
    try {
      const customer = await makeStripeApiCall(`customers/${customerId}`);
      if (customer.email) {
        const { data: users } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        const matchingUser = users.users.find(u => u.email === customer.email);
        if (matchingUser) {
          logStep("Found user by email", { userId: matchingUser.id, email: customer.email });
          
          // Create or update subscription record
          await supabase
            .from('subscriptions')
            .upsert({
              user_id: matchingUser.id,
              email: customer.email,
              stripe_customer_id: customerId,
              status: subscription.status === 'active' ? 'active' : 'inactive',
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        }
      }
    } catch (error) {
      logStep("Error looking up customer", { error: error.message });
    }
    
    return;
  }

  const planType = subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'yearly';
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Update Supabase
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status === 'active' ? 'active' : 'inactive',
      stripe_subscription_id: subscriptionId,
      plan_type: planType,
      current_period_end: currentPeriodEnd,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', subsData.user_id);

  if (error) {
    logStep("Failed to update subscription", { error, userId: subsData.user_id });
  } else {
    logStep("Updated subscription for user", { 
      userId: subsData.user_id, 
      status: subscription.status,
      planType,
      currentPeriodEnd 
    });
  }
}

// Handle checkout session completed webhook
async function handleCheckoutSessionCompleted(session) {
  logStep("Processing checkout completion", { sessionId: session.id });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;

  if (!subscriptionId) {
    logStep("No subscription in session");
    return;
  }

  // Enhanced user identification
  let userId = session.metadata?.user_id;
  
  // Fallback 1: Find by email in auth.users
  if (!userId && customerEmail) {
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
    logStep("CRITICAL ERROR: No user found for session", {
      sessionId: session.id,
      customerId,
      customerEmail,
      metadata: session.metadata
    });
    return;
  }

  try {
    // Get subscription details using direct API call
    const subscription = await makeStripeApiCall(`subscriptions/${subscriptionId}`);
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
      logStep("Database update failed", { error });
      throw error;
    }

    logStep("Payment processed successfully", {
      userId,
      subscriptionId,
      planType,
      email: customerEmail
    });
  } catch (error) {
    logStep("Error processing payment", { 
      error: error instanceof Error ? error.message : String(error),
      userId,
      sessionId: session.id
    });
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
    const session = await makeStripeApiCall(`checkout/sessions/${session_id}`);
    
    if (!session || session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Process the successful session
    if (session.subscription) {
      await handleCheckoutSessionCompleted(session);
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
      // Try to find user by email and create customer record
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);
      if (userData?.user?.email) {
        const customers = await makeStripeApiCall(`customers?email=${encodeURIComponent(userData.user.email)}&limit=1`);
        
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          
          // Update database with customer ID
          await supabase
            .from("subscriptions")
            .upsert({
              user_id: user_id,
              email: userData.user.email,
              stripe_customer_id: customer.id,
              status: "trial_expired",
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
          
          // Continue with sync using this customer
          return await syncCustomerSubscriptions(user_id, customer.id);
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "No Stripe customer found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    return await syncCustomerSubscriptions(user_id, subData.stripe_customer_id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error in manual sync: ${errorMessage}`, { userId: user_id, error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}

async function syncCustomerSubscriptions(user_id, customerId) {
  try {
    // Get active subscriptions from Stripe
    const subscriptions = await makeStripeApiCall(`subscriptions?customer=${customerId}&status=active&limit=1`);
    
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      // Update database
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          stripe_subscription_id: subscription.id,
          plan_type: planType,
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user_id);
      
      if (error) {
        logStep("Database update error", { error, userId: user_id });
        throw new Error(`Database update failed: ${error.message}`);
      }
      
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
      // Check for any recent checkout sessions that might not have been processed
      const sessions = await makeStripeApiCall(`checkout/sessions?customer=${customerId}&limit=5`);
      
      const paidSessions = sessions.data.filter(s => s.payment_status === "paid" && s.subscription);
      
      if (paidSessions.length > 0) {
        // Process the most recent paid session
        await handleCheckoutSessionCompleted(paidSessions[0]);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "active",
            message: "Found and processed recent payment"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, status: "trial_expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error syncing customer subscriptions: ${errorMessage}`, { userId: user_id, customerId });
    throw error;
  }
}
