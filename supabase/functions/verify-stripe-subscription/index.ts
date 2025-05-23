import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.2.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2024-11-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step: string, data?: any) {
  console.log(`[VERIFY-STRIPE] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    logStep("Request received", { url: req.url, method: req.method });
    
    // Handle Stripe webhook
    if (req.headers.get('stripe-signature')) {
      logStep("Processing webhook from Stripe");
      
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        logStep("No stripe signature found");
        return new Response(JSON.stringify({ error: "No stripe signature found" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
      
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
        const event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
          undefined,
          cryptoProvider
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
    
    // Handle POST requests
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

// CRITICAL FIX: Handle checkout session completion
async function handleCheckoutSessionCompleted(session: any) {
  logStep("Processing checkout session completed", { sessionId: session.id });

  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  let userId = session.metadata?.user_id;
  
  // FIXED: Find user by email with proper error handling
  if (!userId && customerEmail) {
    try {
      // Use auth.admin.listUsers() with pagination to avoid the 184 rows issue
      const { data: users, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Adjust as needed
      });
      
      if (error) {
        logStep("Error fetching users", { error });
      } else {
        const matchingUser = users.users.find(u => u.email === customerEmail);
        if (matchingUser) {
          userId = matchingUser.id;
          logStep("Found user by email", { userId, email: customerEmail });
        }
      }
    } catch (error) {
      logStep("Error in user lookup", { error });
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
    
    // CRITICAL FIX: Use upsert with proper conflict resolution
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
      }, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });
    
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

// CRITICAL FIX: Handle subscription updates with proper query
async function handleSubscriptionUpdated(subscription: any) {
  logStep("Processing subscription update", { 
    subscriptionId: subscription.id,
    status: subscription.status 
  });
  
  try {
    // FIXED: Use limit(1) instead of single() to avoid "multiple rows" error
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id, email')
      .eq('stripe_customer_id', subscription.customer)
      .limit(1);
      
    if (error) {
      logStep("Error fetching subscription", { error });
      return;
    }
    
    if (!data || data.length === 0) {
      logStep("No user found with customer ID", { customerId: subscription.customer });
      return;
    }
    
    // Use the first result
    const subscriptionData = data[0];
    
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
      .eq('user_id', subscriptionData.user_id);
    
    if (updateError) {
      logStep("Error updating subscription", { updateError });
      throw updateError;
    }
    
    logStep("Successfully updated subscription", { 
      userId: subscriptionData.user_id,
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

// CRITICAL FIX: Handle subscription status check with proper query
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
    // FIXED: Use limit(1) instead of single() to avoid multiple rows error
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, plan_type, current_period_end, trial_end_date')
      .eq('user_id', user_id)
      .limit(1);
    
    if (error) {
      logStep("Error fetching subscription", { error });
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

    if (!data || data.length === 0) {
      // No subscription found, create trial
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

    // Use first result
    const subscriptionData = data[0];
    const now = new Date();
    const trialEnd = subscriptionData?.trial_end_date ? new Date(subscriptionData.trial_end_date) : null;
    const isTrialExpired = trialEnd && now > trialEnd && subscriptionData.status === 'trialing';

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: isTrialExpired ? 'trial_expired' : subscriptionData.status,
        planType: subscriptionData.plan_type,
        currentPeriodEnd: subscriptionData.current_period_end,
        isTrialExpired
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    logStep("Database error in subscription check", { error });
    return new Response(
      JSON.stringify({ success: false, error: "Database error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}
