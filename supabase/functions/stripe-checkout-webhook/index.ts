
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[STRIPE-CHECKOUT-WEBHOOK] ${step}`, data ? JSON.stringify(data) : "");
}

const encoder = new TextEncoder();

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
    
    const signedPayload = `${timestamp}.${payload}`;
    logStep("Created signed payload", { length: signedPayload.length });
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    logStep("Generated expected signature", { 
      expectedLength: expectedSignature.length,
      receivedSignatures: signatures 
    });
    
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
  logStep("Checkout webhook request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("No signature header found");
    return new Response("Missing stripe-signature header", { status: 400 });
  }
  
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "whsec_aiFAzqABwU8OyJMpyVxTncZyLkghduNX";
  const body = await req.text();
  logStep("Body received", { length: body.length });
  
  const isValid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!isValid) {
    logStep("Webhook verification failed");
    return new Response("Webhook verification failed", { status: 400 });
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
    return new Response(`JSON parsing failed: ${errorMessage}`, { status: 400 });
  }
  
  try {
    switch(event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, supabase);
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
    return new Response(`Error processing event: ${errorMessage}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(session: any, supabase: any) {
  logStep("Processing checkout completion", { sessionId: session.id });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  // Store checkout session data in "Stripe checkouts" table
  const { error: checkoutError } = await supabase
    .from("Stripe checkouts")
    .upsert({
      id: session.id,
      customer: customerId,
      payment_intent: session.payment_intent,
      subscription: subscriptionId,
      attrs: session,
      currency: session.currency,
      amount_total: session.amount_total,
      payment_status: session.payment_status,
      status: session.status,
      created_at: new Date().toISOString()
    });

  if (checkoutError) {
    logStep("Error storing checkout session", { error: checkoutError });
    throw checkoutError;
  }

  logStep("Checkout session stored successfully", { sessionId: session.id });

  if (!subscriptionId) {
    logStep("No subscription in checkout session");
    return;
  }

  // Find user by email from metadata or customer details
  let userId = session.metadata?.user_id || session.metadata?.supabase_user_id;
  
  if (!userId && customerEmail) {
    const { data: users } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    const matchingUser = users.users.find((u: any) => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", { userId, email: customerEmail });
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
  const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
  
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  
  logStep("Subscription details fetched", {
    planType,
    currentPeriodEnd,
    currentPeriodStart
  });
  
  // Update subscriptions table using email for conflict resolution
  const { error } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      email: customerEmail,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_type: planType,
      current_period_end: currentPeriodEnd,
      current_period_start: currentPeriodStart,
      subscription_end_date: currentPeriodEnd,
      last_payment_id: session.payment_intent,
      currency: session.currency,
      attrs: subscription,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "email"
    });
  
  if (error) {
    logStep("Database update failed", { error });
    throw error;
  }
  
  logStep("Subscription activated successfully", {
    userId,
    subscriptionId,
    planType
  });
}
