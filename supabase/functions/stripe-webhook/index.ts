
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase admin client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const encoder = new TextEncoder();

function logStep(step: string, data?: any) {
  console.log(`[STRIPE-WEBHOOK] ${step}`, data ? JSON.stringify(data) : "");
}

// Improved Web Crypto API compatible HMAC verification
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    logStep("Starting signature verification", { 
      signatureLength: signature.length,
      payloadLength: payload.length,
      secretLength: secret.length 
    });

    const elements = signature.split(',');
    let timestamp = '';
    let signatures: string[] = [];
    
    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }
    
    logStep("Parsed signature elements", { timestamp, signatureCount: signatures.length });
    
    if (!timestamp || signatures.length === 0) {
      logStep("Missing timestamp or signatures");
      return false;
    }
    
    // Create the signed payload
    const signedPayload = `${timestamp}.${payload}`;
    logStep("Created signed payload", { length: signedPayload.length });
    
    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the payload
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    logStep("Generated expected signature", { 
      expectedLength: expectedSignature.length,
      receivedSignatures: signatures 
    });
    
    // Compare signatures
    const isValid = signatures.some(sig => {
      const match = sig === expectedSignature;
      logStep("Signature comparison", { received: sig, expected: expectedSignature, match });
      return match;
    });
    
    logStep("Signature verification result", { isValid });
    return isValid;
    
  } catch (error) {
    logStep("Signature verification error", { error: error.message });
    return false;
  }
}

serve(async (req) => {
  logStep("Webhook request received");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }
  
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
  logStep("Body received", { length: body.length });
  
  // Verify signature using Web Crypto API
  const isValid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!isValid) {
    logStep("Webhook verification failed");
    return new Response("Webhook verification failed", {
      status: 400
    });
  }
  
  let event;
  try {
    event = JSON.parse(body);
    logStep("Webhook verified successfully", {
      type: event.type,
      id: event.id
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("JSON parsing failed", { error: errorMessage });
    return new Response(`JSON parsing failed: ${errorMessage}`, {
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
        await handleSubscriptionEvent(event.data.object, event.data.previous_attributes);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }
    
    logStep("Event processed successfully");
    return new Response(JSON.stringify({
      received: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error processing event", { error: errorMessage });
    return new Response(`Error processing event: ${errorMessage}`, {
      status: 500
    });
  }
});

// Handle checkout session completion
async function handleCheckoutCompleted(session: any) {
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
      .maybeSingle();
    
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
    // Get subscription details using REST API
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!subscriptionResponse.ok) {
      throw new Error(`Failed to fetch subscription: ${subscriptionResponse.status}`);
    }

    const subscription = await subscriptionResponse.json();
    await processSubscriptionActivation(subscription, userId, customerEmail, customerId);
    
    logStep("Checkout session processed successfully", {
      userId,
      subscriptionId
    });
  } catch (error) {
    logStep("Error processing checkout", {
      error: error.message
    });
    throw error;
  }
}

// Handle subscription events with trial-to-paid detection
async function handleSubscriptionEvent(subscription: any, previousAttributes?: any) {
  logStep("Processing subscription event", {
    subscriptionId: subscription.id,
    status: subscription.status,
    previousStatus: previousAttributes?.status
  });
  
  try {
    // Get customer information using REST API
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${subscription.customer}`, {
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!customerResponse.ok) {
      throw new Error(`Failed to fetch customer: ${customerResponse.status}`);
    }

    const customer = await customerResponse.json();
    
    // Enhanced user identification
    let userId = await findUserByCustomerId(subscription.customer);
    
    if (!userId && customer.email) {
      userId = await findUserByEmail(customer.email);
      
      if (userId) {
        // Update subscription record with customer ID
        await updateSubscriptionCustomerId(userId, subscription.customer);
      }
    }

    // If user doesn't exist but we have email, create subscription record
    if (!userId && customer.email) {
      const { data: users } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      const matchingUser = users.users.find((u) => u.email === customer.email);
      if (matchingUser) {
        userId = matchingUser.id;
        logStep("Found user by email in auth", { userId, email: customer.email });
      }
    }
    
    if (!userId) {
      logStep("CRITICAL ERROR: No user found for subscription", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        email: customer.email
      });
      return;
    }
    
    // Check if this is a trial-to-paid transition
    const isTrialToPaidTransition = subscription.status === 'active' && 
      (previousAttributes?.status === 'trialing' || 
       (!previousAttributes?.status && await isFirstTimeActivation(userId)));
    
    logStep("Transition detection", {
      newStatus: subscription.status,
      previousStatus: previousAttributes?.status,
      isTrialToPaidTransition
    });
    
    await processSubscriptionActivation(subscription, userId, customer.email, subscription.customer, isTrialToPaidTransition);
    
    logStep("Subscription updated successfully", {
      userId,
      status: subscription.status,
      email: customer.email,
      isTrialToPaidTransition
    });
  } catch (error) {
    logStep("Error processing subscription event", {
      error: error.message
    });
    throw error;
  }
}

// Process subscription activation with proper date handling
async function processSubscriptionActivation(subscription: any, userId: string, email: string, customerId: string, isTrialToPaidTransition = false) {
  const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
  
  // Get existing subscription to check if we should set start/end dates
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("subscription_start_date, subscription_end_date, status")
    .eq("user_id", userId)
    .maybeSingle();
  
  // Determine if this is first-time activation
  const isFirstTimeActivation = isTrialToPaidTransition || 
    !existingSub || 
    !existingSub.subscription_start_date ||
    (existingSub.status !== 'active' && subscription.status === 'active');
  
  logStep("Activation analysis", {
    isFirstTimeActivation,
    existingStartDate: existingSub?.subscription_start_date,
    existingStatus: existingSub?.status,
    newStatus: subscription.status
  });
  
  // Prepare update data
  const updateData: any = {
    user_id: userId,
    email: email,
    status: subscription.status === "active" ? "active" : "inactive",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_type: planType,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };

  // Set subscription start and end dates only for first-time activation
  if (isFirstTimeActivation && subscription.status === 'active') {
    const startTimestamp = subscription.current_period_start;
    const startDate = new Date(startTimestamp * 1000);
    
    // Calculate end date based on plan type
    const endDate = new Date(startTimestamp * 1000);
    if (planType === 'monthly') {
      endDate.setDate(startDate.getDate() + 30);
    } else if (planType === 'yearly') {
      endDate.setDate(startDate.getDate() + 365);
    }
    
    updateData.subscription_start_date = startDate.toISOString();
    updateData.subscription_end_date = endDate.toISOString();
    
    logStep("Setting subscription dates for first-time activation", {
      startDate: updateData.subscription_start_date,
      endDate: updateData.subscription_end_date,
      planType,
      stripeStartTimestamp: startTimestamp
    });
  }

  // Update database using email conflict resolution
  const { error } = await supabase
    .from("subscriptions")
    .upsert(updateData, {
      onConflict: "email"
    });
  
  if (error) {
    logStep("Database update failed", { error });
    throw error;
  }
  
  logStep("Subscription activation processed", {
    userId,
    isFirstTimeActivation,
    startDate: updateData.subscription_start_date,
    endDate: updateData.subscription_end_date
  });
}

// Check if this is the first time activation for a user
async function isFirstTimeActivation(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("subscription_start_date, status")
    .eq("user_id", userId)
    .maybeSingle();
  
  return !data || !data.subscription_start_date || data.status !== 'active';
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(subscription: any) {
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
    logStep("Error processing cancellation", {
      error: error.message
    });
    throw error;
  }
}

async function findUserByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  
  return data?.user_id || null;
}

async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    const matchingUser = users.users.find(u => u.email === email);
    return matchingUser?.id || null;
  } catch (error) {
    logStep("Error finding user by email", { error: error.message, email });
    return null;
  }
}

async function updateSubscriptionCustomerId(userId: string, customerId: string) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ 
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
    
  if (error) {
    logStep("Error updating customer ID", { error, userId, customerId });
  }
}
