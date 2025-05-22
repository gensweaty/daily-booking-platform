
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
          await handleCheckoutSessionCompleted(event.data.object);
          return new Response(JSON.stringify({ success: true }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
          });
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
    
    // For GET requests (client-side verification with session_id)
    if (req.method === "GET") {
      let body;
      try {
        body = await req.json();
        logStep("GET Request body", body);
      } catch (e) {
        // If it's not JSON, try to parse URL parameters
        const url = new URL(req.url);
        const sessionId = url.searchParams.get('session_id');
        if (sessionId) {
          body = { session_id: sessionId };
          logStep("Extracted session_id from URL", { session_id: sessionId });
        } else {
          logStep("Failed to parse request body or parameters");
          return new Response(
            JSON.stringify({ success: false, error: "Invalid request format" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }
      }
      
      // Get session_id from request body or URL parameters
      const sessionId = body.session_id;
      
      if (!sessionId) {
        logStep("No session ID provided");
        return new Response(
          JSON.stringify({ success: false, error: "Session ID is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      logStep("Session retrieved", { sessionId, status: session.status });
      
      if (!session || session.status !== "complete") {
        logStep("Session incomplete", { sessionId });
        return new Response(
          JSON.stringify({ success: false, error: "Payment incomplete" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Process the completed session
      await handleCheckoutSessionCompleted(session);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // For POST requests (checking subscription status)
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
      
      const { user_id } = body;
      
      if (!user_id) {
        return new Response(
          JSON.stringify({ success: false, error: "User ID is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Special case for test user
      const testEmail = "pmb60533@toaik.com";
      
      // Get user email for potential test user check
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
      
      if (userError) {
        logStep("Error fetching user", { error: userError });
        return new Response(
          JSON.stringify({ success: false, error: "User not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Check subscription status
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end_date, current_period_end, plan_type')
        .eq('user_id', user_id)
        .single();
      
      if (error) {
        logStep("Error fetching subscription", { error });
        return new Response(
          JSON.stringify({ success: false, error: "Subscription not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      const now = new Date();
      const trialEnd = data.trial_end_date ? new Date(data.trial_end_date) : null;
      const currentPeriodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
      
      // Check if trial has expired
      const isTrialExpired = trialEnd && now > trialEnd;
      
      // Check if subscription has expired
      const isSubscriptionExpired = currentPeriodEnd && now > currentPeriodEnd && data.status !== 'trial';
      
      // Update status if needed
      let status = data.status;
      
      if (isTrialExpired && status === 'trial') {
        await supabase
          .from('subscriptions')
          .update({ status: 'trial_expired' })
          .eq('user_id', user_id);
        
        status = 'trial_expired';
        logStep("Trial expired", { userId: user_id });
      }
      
      if (isSubscriptionExpired && status === 'active') {
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', user_id);
        
        status = 'expired';
        logStep("Subscription expired", { userId: user_id });
      }
      
      // If subscription is active but not expired yet, check when it ends
      let daysRemaining = 0;
      if (status === 'trial' && trialEnd) {
        daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      } else if (status === 'active' && currentPeriodEnd) {
        daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
      
      logStep("Subscription status checked", { 
        userId: user_id, 
        status, 
        daysRemaining,
        trialEnd: data.trial_end_date,
        currentPeriodEnd: data.current_period_end,
        planType: data.plan_type
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status,
          daysRemaining,
          trialEnd: data.trial_end_date,
          currentPeriodEnd: data.current_period_end,
          planType: data.plan_type,
          isTrialExpired,
          isSubscriptionExpired
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
  
  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planType = stripeSubscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  
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
    logStep("Error updating subscription", { error });
  } else {
    logStep("Successfully updated subscription", { userId, status: 'active' });
  }
}
