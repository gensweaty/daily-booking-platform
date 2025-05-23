import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2023-10-16", // Updated to match supported Stripe API version
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for browser access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step: string, data?: any) {
  console.log(`[VERIFY-STRIPE] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    logStep("Request received", { url: req.url, method: req.method });
    
    // Handle webhook events directly from Stripe (no auth needed)
    if (req.url.includes('webhook') || req.headers.get('stripe-signature')) {
      logStep("Processing webhook from Stripe");
      const body = await req.text();
      const signature = req.headers.get('stripe-signature');
      
      if (!signature) {
        logStep("No stripe signature found");
        return new Response(JSON.stringify({ error: "No stripe signature found" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
      
      // Try to construct the event from the payload
      try {
        // Verify webhook payload
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        if (!webhookSecret) {
          logStep("Webhook secret not configured");
          return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500 
          });
        }
        
        const event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
          undefined,
          Stripe.createSubtleCryptoProvider()
        );
        
        logStep(`Received webhook event: ${event.type}`, { id: event.id });
        
        // Process the event based on its type
        if (event.type === 'checkout.session.completed') {
          try {
            await handleCheckoutSessionCompleted(event.data.object);
            return new Response(JSON.stringify({ success: true }), { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200 
            });
          } catch (processError) {
            logStep("Error processing checkout session", { 
              error: processError instanceof Error ? processError.message : String(processError),
              sessionId: event.data.object.id
            });
            return new Response(JSON.stringify({ success: false, error: "Error processing checkout session" }), { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500 
            });
          }
        }
        
        // For other event types
        return new Response(JSON.stringify({ received: true, type: event.type }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        });
      } catch (err) {
        logStep("Error constructing webhook event", { error: err instanceof Error ? err.message : String(err) });
        return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
    }
    
    // For POST requests (checking subscription status or verifying sessions)
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
      
      // If session_id is present, verify the Stripe checkout session
      if (body.session_id) {
        return await handleSessionVerification(body, corsHeaders);
      }
      
      // If user_id is present, check subscription status
      if (body.user_id) {
        return await handleSubscriptionCheck(body, corsHeaders);
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
    logStep(`Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

// Handle session verification
async function handleSessionVerification(body: any, corsHeaders: any) {
  const { session_id, user_id } = body;
  
  if (!session_id) {
    return new Response(
      JSON.stringify({ success: false, error: "Session ID is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  logStep("Verifying session", { sessionId: session_id });
  
  try {
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Session retrieved", { sessionId: session_id, status: session.status });
    
    if (!session || session.status !== "complete") {
      logStep("Session not complete", { sessionId: session_id, status: session.status });
      return new Response(
        JSON.stringify({ success: false, error: "Payment not complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Get the subscription ID from the session
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      logStep("No subscription in session", { sessionId: session_id });
      return new Response(
        JSON.stringify({ success: false, error: "No subscription found in session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
    const planType = subscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    
    logStep("Subscription details", { 
      subscriptionId, 
      status: subscription.status,
      planType,
      currentPeriodEnd
    });
    
    // Get user ID either from provided parameter or from session metadata
    let userId = user_id || session.metadata?.user_id;
    
    // If no user ID, try to find by customer email
    if (!userId && session.customer_details?.email) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const matchingUser = users.users.find(u => u.email === session.customer_details?.email);
      if (matchingUser) {
        userId = matchingUser.id;
        logStep("Found user by email", { userId });
      }
    }
    
    if (!userId) {
      logStep("No user ID found");
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Check if this is our test user
    const isTestUser = session.customer_details?.email === 'anania.devsurashvili885@law.tsu.edu.ge';
    const effectiveStatus = isTestUser ? 'trial_expired' : 'active';
    
    if (isTestUser) {
      logStep("Test user detected, keeping trial_expired status");
      
      // Update user's subscription in database - but keep trial_expired status for test user
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          email: session.customer_details?.email,
          status: 'trial_expired',
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscriptionId,
          plan_type: planType,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      if (error) {
        logStep("Error updating subscription for test user", { error });
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update subscription in database" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      logStep("Successfully updated test user subscription to trial_expired");
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'trial_expired',
          planType,
          currentPeriodEnd
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Normal user - update user's subscription in database
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          email: session.customer_details?.email,
          status: 'active',
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscriptionId,
          plan_type: planType,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      if (error) {
        logStep("Error updating subscription", { error });
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update subscription in database" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }
    
    logStep("Successfully updated subscription");
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: effectiveStatus,
        planType,
        currentPeriodEnd
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
async function handleSubscriptionCheck(body: any, corsHeaders: any) {
  const { user_id } = body;
  
  if (!user_id) {
    return new Response(
      JSON.stringify({ success: false, error: "User ID is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  logStep("Checking subscription for user", { userId: user_id });
  
  // Get user info
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
  if (userError) {
    logStep("Error fetching user", { error: userError });
    return new Response(
      JSON.stringify({ success: false, error: "User not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  if (!userData.user) {
    logStep("No user found");
    return new Response(
      JSON.stringify({ success: false, error: "User not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  // Check if this is our test user - special handling for test user
  const isTestUser = userData.user.email === 'anania.devsurashvili885@law.tsu.edu.ge';
  if (isTestUser) {
    logStep("Detected test user, using special handling");
  }
  
  // First, check if user has a subscription in our database
  const { data: subscriptionData, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();
  
  if (subError) {
    logStep("Error fetching subscription", { error: subError });
    // Continue anyway to try Stripe check
  }
  
  // If we have a Stripe subscription ID, verify with Stripe
  if (subscriptionData?.stripe_subscription_id) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripe_subscription_id);
      
      logStep("Retrieved Stripe subscription", { 
        id: stripeSubscription.id,
        status: stripeSubscription.status
      });
      
      if (stripeSubscription.status === 'active') {
        // For test user, we want to ignore actual Stripe status
        if (isTestUser) {
          logStep("Keeping trial_expired status for test user");
          
          // Ensure test user keeps trial_expired status
          await supabase
            .from('subscriptions')
            .update({
              status: 'trial_expired',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id);
            
          return new Response(JSON.stringify({
            success: true,
            status: 'trial_expired',
            planType: subscriptionData.plan_type,
            currentPeriodEnd: null
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }
        
        // Update subscription details in database
        const planType = stripeSubscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
        const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
        
        // Update database
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            plan_type: planType,
            current_period_end: currentPeriodEnd.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id);
          
        logStep("Updated subscription in database to active");
        
        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          planType,
          currentPeriodEnd: currentPeriodEnd.toISOString()
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }
    } catch (error) {
      logStep("Error retrieving Stripe subscription", { 
        error: error instanceof Error ? error.message : String(error),
        subscriptionId: subscriptionData.stripe_subscription_id
      });
      // Don't return here, fall back to checking customer
    }
  }
  
  // If we have a Stripe customer ID, check for active subscriptions
  if (subscriptionData?.stripe_customer_id) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: subscriptionData.stripe_customer_id,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        // For test user, ignore this info and keep trial_expired
        if (isTestUser) {
          logStep("Test user detected, keeping trial_expired status");
          
          // Ensure test user has trial_expired status
          await supabase
            .from('subscriptions')
            .update({
              status: 'trial_expired',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id);
            
          return new Response(JSON.stringify({
            success: true,
            status: 'trial_expired',
            planType: subscriptionData.plan_type,
            currentPeriodEnd: null
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          });
        }
        
        const subscription = subscriptions.data[0];
        const planType = subscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        
        // Update database
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            current_period_end: currentPeriodEnd.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id);
          
        logStep("Found active subscription for customer", { 
          customerId: subscriptionData.stripe_customer_id,
          subscriptionId: subscription.id 
        });
        
        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          planType,
          currentPeriodEnd: currentPeriodEnd.toISOString()
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }
    } catch (error) {
      logStep("Error checking customer subscriptions", { 
        error: error instanceof Error ? error.message : String(error),
        customerId: subscriptionData.stripe_customer_id
      });
    }
  }
  
  // Special handling for test user - always return trial_expired regardless of what's in the database
  if (isTestUser) {
    // Always set and return trial_expired for this user
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user_id,
        email: userData.user.email,
        status: 'trial_expired',
        plan_type: 'monthly',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      
    logStep("Forcing trial_expired status for test user");
    
    return new Response(JSON.stringify({
      success: true,
      status: 'trial_expired',
      planType: 'monthly'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  }
  
  // If no active subscription found in Stripe, return database status
  return new Response(JSON.stringify({
    success: true,
    status: subscriptionData?.status || 'trial',
    planType: subscriptionData?.plan_type,
    currentPeriodEnd: subscriptionData?.current_period_end,
    trialEnd: subscriptionData?.trial_end_date
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200
  });
}

// Helper function to process checkout session completion
async function handleCheckoutSessionCompleted(session: any) {
  logStep("Processing completed checkout session", { sessionId: session.id });

  // Extract customer details
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  // Get user ID from metadata or lookup by email
  let userId = session.metadata?.user_id;
  
  if (!userId && customerEmail) {
    // Find user by email if not in metadata
    const { data: users } = await supabase.auth.admin.listUsers();
    const matchingUser = users.users.find(u => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", { userId });
    }
  }
  
  if (!userId) {
    logStep("No user ID found for checkout session");
    return;
  }
  
  // Check if this is our test user
  const isTestUser = customerEmail === 'anania.devsurashvili885@law.tsu.edu.ge';
  
  if (isTestUser) {
    logStep("Test user detected in webhook, keeping trial_expired status");
    
    try {
      // For test user, keep trial_expired status regardless of payment
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          email: customerEmail,
          status: 'trial_expired',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      logStep("Successfully updated test user subscription to trial_expired");
    } catch (error) {
      logStep("Error updating test user subscription", { error });
      throw error;
    }
    return;
  }
  
  try {
    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planType = stripeSubscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    
    // Get the subscription plan from our database
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('type', planType)
      .maybeSingle();
      
    const planId = plans?.id;
    
    // Update subscription in database
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email: customerEmail,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_type: planType,
        plan_id: planId,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    logStep("Successfully updated subscription", { userId, status: 'active' });
  } catch (error) {
    logStep("Error updating subscription in webhook handler", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}
