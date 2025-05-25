
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use Web Crypto API instead of Node.js crypto
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function logStep(step: string, data?: any) {
  console.log(`[STRIPE-WEBHOOK] ${step}`, data ? JSON.stringify(data, null, 2) : "");
}

// Web Crypto API compatible HMAC verification
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
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
    
    if (!timestamp || signatures.length === 0) {
      return false;
    }
    
    // Create the signed payload
    const signedPayload = `${timestamp}.${payload}`;
    
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
    
    // Compare signatures
    return signatures.some(sig => sig === expectedSignature);
    
  } catch (error) {
    logStep("Signature verification error", { error: error.message });
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("Missing Stripe signature");
      return new Response("Missing stripe-signature header", { status: 400, headers: corsHeaders });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("Missing webhook secret");
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }

    const body = await req.text();
    
    // Verify signature using Web Crypto API
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      logStep("Invalid signature");
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    const event = JSON.parse(body);
    logStep("Webhook verified", { type: event.type, id: event.id });

    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await handleSubscriptionEvent(event.data.object);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(
      JSON.stringify({ received: true, processed: event.type, timestamp: new Date().toISOString() }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook processing error", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ error: "Webhook processing failed", details: errorMessage, timestamp: new Date().toISOString() }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleSubscriptionEvent(subscription: any) {
  logStep("Processing subscription event", {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status
  });

  try {
    // Use Stripe API to get customer information
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    if (!stripeApiKey) {
      throw new Error("Stripe API key not configured");
    }

    // Fetch customer data using fetch API instead of Stripe SDK
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
    logStep("Customer fetched", { email: customer.email, id: customer.id });

    // Enhanced user identification
    let userId = await findUserByCustomerId(subscription.customer);
    
    if (!userId && customer.email) {
      userId = await findUserByEmail(customer.email);
      
      if (userId) {
        // Update subscription record with customer ID
        await updateSubscriptionCustomerId(userId, subscription.customer);
      }
    }

    if (!userId) {
      logStep("CRITICAL: No user found for subscription", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        email: customer.email
      });
      return;
    }

    // Calculate subscription details
    const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);

    // Update subscription with enhanced data
    const updateData = {
      user_id: userId,
      email: customer.email,
      status: subscription.status === "active" ? "active" : subscription.status,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      plan_type: planType,
      current_period_end: currentPeriodEnd.toISOString(),
      current_period_start: currentPeriodStart.toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("subscriptions")
      .upsert(updateData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (error) {
      logStep("Database update failed", { error, userId, updateData });
      throw error;
    }

    logStep("Subscription updated successfully", { 
      userId, 
      status: subscription.status, 
      planType,
      email: customer.email
    });

  } catch (error) {
    logStep("Error processing subscription event", { 
      error: error.message, 
      subscriptionId: subscription.id 
    });
    throw error;
  }
}

async function findUserByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
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

async function handleCheckoutCompleted(session: any) {
  logStep("Processing checkout completion", { sessionId: session.id });
  
  if (!session.subscription) {
    logStep("No subscription in checkout session");
    return;
  }

  // Fetch subscription data using Stripe API
  const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
  const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
    headers: {
      'Authorization': `Bearer ${stripeApiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (subscriptionResponse.ok) {
    const subscription = await subscriptionResponse.json();
    await handleSubscriptionEvent(subscription);
  } else {
    logStep("Failed to fetch subscription", { 
      status: subscriptionResponse.status,
      subscriptionId: session.subscription
    });
  }
}

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
    logStep("Error processing cancellation", { error });
    throw error;
  }
}
