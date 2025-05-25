
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function logStep(step, data) {
  console.log(`[VERIFY-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  logStep("Request received", { method: req.method });
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
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
    
    if (!session || session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Process the successful session
    if (session.subscription) {
      await processSuccessfulPayment(session);
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
        const customers = await stripe.customers.list({
          email: userData.user.email,
          limit: 1
        });
        
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
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
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
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 5
      });
      
      const paidSessions = sessions.data.filter(s => s.payment_status === "paid" && s.subscription);
      
      if (paidSessions.length > 0) {
        // Process the most recent paid session
        await processSuccessfulPayment(paidSessions[0]);
        
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

async function processSuccessfulPayment(session) {
  logStep("Processing successful payment", { sessionId: session.id });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;

  if (!subscriptionId) {
    logStep("No subscription in session");
    return;
  }

  // Enhanced user identification with multiple fallback methods
  let userId = session.metadata?.user_id;
  
  // Fallback 1: Find by email in auth.users
  if (!userId && customerEmail) {
    logStep("Finding user by email", { email: customerEmail });
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
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Update database with comprehensive data
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
