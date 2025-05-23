import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.2.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize Stripe with correct configuration for Deno
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2024-11-20", // Updated to supported version
  httpClient: Stripe.createFetchHttpClient(),
});

// CRITICAL: Create crypto provider for async webhook verification
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step: string, data?: any) {
  console.log(`[VERIFY-STRIPE] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    logStep("Request received", { url: req.url, method: req.method });
    
    // Handle Stripe webhook events
    if (req.url.includes('webhook') || req.headers.get('stripe-signature')) {
      logStep("Processing webhook from Stripe");
      
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        logStep("No stripe signature found");
        return new Response(JSON.stringify({ error: "No stripe signature found" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
      
      // Get raw body - CRITICAL: Must use .text() for Stripe verification
      const body = await req.text();
      logStep("Webhook body received", { bodyLength: body.length });
      
      const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (!webhookSecret) {
        logStep("Webhook secret not configured");
        return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500 
        });
      }
      
      try {
        // CRITICAL FIX: Use constructEventAsync with cryptoProvider
        const event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
          undefined,
          cryptoProvider // Essential for Supabase Edge Runtime
        );
        
        logStep(`Webhook verified successfully: ${event.type}`, { id: event.id });
        
        // Process events
        switch (event.type) {
          case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object);
            break;
          case 'customer.subscription.updated':
          case 'customer.subscription.created':
            await handleSubscriptionUpdated(event.data.object);
            break;
          default:
            logStep(`Unhandled event type: ${event.type}`);
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          received: true, 
          type: event.type 
        }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        });
        
      } catch (err) {
        logStep("Webhook verification failed", { 
          error: err instanceof Error ? err.message : String(err) 
        });
        return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
    }
    
    // Handle POST requests for session verification or subscription checks
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        logStep("Failed to parse POST request body");
        return new Response(
          JSON.stringify({ success: false, error: "Invalid JSON body" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      if (body.session_id) {
        return await handleSessionVerification(body);
      }
      
      if (body.user_id) {
        return await handleSubscriptionCheck(body);
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: corsHeaders, status: 405 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Global error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Handle checkout session completion
async function handleCheckoutSessionCompleted(session: any) {
  logStep("Processing checkout session completed", { sessionId: session.id });

  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  let userId = session.metadata?.user_id;
  
  // Find user by email if not in metadata
  if (!userId && customerEmail) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const matchingUser = users.users.find(u => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", { userId, email: customerEmail });
    }
  }
  
  if (!userId) {
    logStep("No user ID found for checkout session");
    return;
  }
  
  if (!subscriptionId) {
    logStep("No subscription in session");
    return;
  }
  
  try {
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planType = subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'yearly';
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    
    // Update subscription in database
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email: customerEmail,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_type: planType,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      logStep("Database update error", { error });
      throw error;
    }
    
    logStep("Successfully activated subscription", { 
      userId, 
      subscriptionId, 
      planType 
    });
  } catch (error) {
    logStep("Error processing checkout session", { 
      error: error instanceof Error ? error.message : String(error),
      sessionId: session.id
    });
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: any) {
  logStep("Processing subscription update", { 
    subscriptionId: subscription.id,
    status: subscription.status 
  });
  
  try {
    // Find user by customer ID
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id, email')
      .eq('stripe_customer_id', subscription.customer)
      .single();
      
    if (error || !data) {
      logStep("No user found with customer ID", { customerId: subscription.customer });
      return;
    }
    
    const planType = subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'yearly';
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    
    // Update subscription status
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status === 'active' ? 'active' : 'inactive',
        plan_type: planType,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', data.user_id);
    
    if (updateError) {
      logStep("Error updating subscription", { updateError });
      throw updateError;
    }
    
    logStep("Successfully updated subscription", { 
      userId: data.user_id,
      status: subscription.status 
    });
  } catch (error) {
    logStep("Error processing subscription update", { 
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: subscription.id
    });
    throw error;
  }
}

// Handle session verification from client
async function handleSessionVerification(body: any) {
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
    logStep("Session retrieved", { sessionId: session_id, status: session.status });
    
    if (!session || session.status !== "complete") {
      logStep("Session not complete", { sessionId: session_id, status: session.status });
      return new Response(
        JSON.stringify({ success: false, error: "Payment not complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      logStep("No subscription in session", { sessionId: session_id });
      return new Response(
        JSON.stringify({ success: false, error: "No subscription found in session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    logStep("Session verification successful");
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

// Handle subscription status check
async function handleSubscriptionCheck(body: any) {
  const { user_id } = body;
  
  if (!user_id) {
    return new Response(
      JSON.stringify({ success: false, error: "User ID is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  logStep("Checking subscription for user", { userId: user_id });
  
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, plan_type, current_period_end, trial_end_date')
      .eq('user_id', user_id)
      .single();
    
    if (error) {
      // Create trial subscription if none exists
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);
      if (userData.user) {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: user_id,
            email: userData.user.email,
            status: 'trialing',
            trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'trialing',
            isTrialExpired: false
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    const now = new Date();
    const trialEnd = data?.trial_end_date ? new Date(data.trial_end_date) : null;
    const isTrialExpired = trialEnd && now > trialEnd && data.status === 'trialing';

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: isTrialExpired ? 'trial_expired' : data.status,
        planType: data.plan_type,
        currentPeriodEnd: data.current_period_end,
        isTrialExpired
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Database error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}
