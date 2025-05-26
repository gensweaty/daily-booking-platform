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

function logStep(step: string, data?: any) {
  console.log(`[VERIFY-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Helper function to safely convert Stripe timestamps
function safeTimestamp(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) {
    return null;
  }
  
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (error) {
    logStep("Error converting timestamp", { timestamp, error: error.message });
    return null;
  }
}

serve(async (req) => {
  logStep("Request received", { method: req.method });
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    if (req.method === "POST") {
      const body = await req.json();
      
      // Check if this is a webhook event (has 'type' and 'data' properties)
      if (body.type && body.data) {
        return await handleWebhookEvent(body);
      }
      
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

// Handle webhook events from Stripe
async function handleWebhookEvent(event: any) {
  logStep("Processing webhook event", { type: event.type, id: event.id });
  
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    } else if (event.type === 'customer.subscription.updated') {
      await handleCustomerSubscriptionUpdated(event.data.object);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      });
    } else if (event.type === 'customer.subscription.created') {
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
    logStep("Error processing webhook", { error: errorMessage, eventType: event.type });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// Handle customer subscription updated webhook
async function handleCustomerSubscriptionUpdated(subscription: any) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  
  logStep("Processing subscription update", { 
    customerId, 
    subscriptionId, 
    status: subscription.status,
    current_period_end: subscription.current_period_end,
    current_period_start: subscription.current_period_start
  });

  try {
    // Get the associated user from Supabase
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('user_id, email')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (!subsData || !subsData.user_id) {
      logStep("User not found for customer, trying email lookup", { customerId });
      
      // Try to find by email from Stripe customer using REST API
      try {
        const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
        const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
          headers: {
            'Authorization': `Bearer ${stripeApiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (customerResponse.ok) {
          const customer = await customerResponse.json();
          if (customer.email) {
            const { data: users } = await supabase.auth.admin.listUsers({
              page: 1,
              perPage: 1000
            });
            const matchingUser = users.users.find(u => u.email === customer.email);
            if (matchingUser) {
              logStep("Found user by email", { userId: matchingUser.id, email: customer.email });
              
              // Create or update subscription record with proper timestamps
              const planType = subscription.items?.data?.[0]?.price?.recurring?.interval === 'month' ? 'monthly' : 'yearly';
              const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
              const currentPeriodStart = safeTimestamp(subscription.current_period_start);
              
              logStep("Creating subscription with timestamps", {
                planType,
                currentPeriodEnd,
                currentPeriodStart,
                rawEndTimestamp: subscription.current_period_end,
                rawStartTimestamp: subscription.current_period_start
              });
              
              await supabase
                .from('subscriptions')
                .upsert({
                  user_id: matchingUser.id,
                  email: customer.email,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  status: subscription.status === 'active' ? 'active' : 'inactive',
                  plan_type: planType,
                  current_period_end: currentPeriodEnd,
                  current_period_start: currentPeriodStart,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

              logStep("Successfully created subscription for user", { userId: matchingUser.id });
            }
          }
        }
      } catch (error) {
        logStep("Error looking up customer", { error: error.message, customerId });
      }
      
      return;
    }

    const planType = subscription.items?.data?.[0]?.price?.recurring?.interval === 'month' ? 'monthly' : 'yearly';
    const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
    const currentPeriodStart = safeTimestamp(subscription.current_period_start);

    logStep("Updating existing subscription with timestamps", {
      userId: subsData.user_id,
      planType,
      currentPeriodEnd,
      currentPeriodStart,
      rawEndTimestamp: subscription.current_period_end,
      rawStartTimestamp: subscription.current_period_start
    });

    // Update Supabase
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status === 'active' ? 'active' : 'inactive',
        stripe_subscription_id: subscriptionId,
        plan_type: planType,
        current_period_end: currentPeriodEnd,
        current_period_start: currentPeriodStart,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in handleCustomerSubscriptionUpdated", { error: errorMessage, subscriptionId });
    throw error;
  }
}

// Handle checkout session completed webhook
async function handleCheckoutSessionCompleted(session: any) {
  logStep("Processing checkout completion", { sessionId: session.id });
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;

  if (!subscriptionId) {
    logStep("No subscription in session");
    return;
  }

  try {
    // Enhanced user identification
    let userId = session.metadata?.user_id || session.metadata?.supabase_user_id;
    
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
        .maybeSingle();
      
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
    const planType = subscription.items?.data?.[0]?.price?.recurring?.interval === "month" ? "monthly" : "yearly";
    
    // Use safe timestamp conversion
    const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
    const currentPeriodStart = safeTimestamp(subscription.current_period_start);

    logStep("Processing checkout with subscription details", {
      planType,
      currentPeriodEnd,
      currentPeriodStart,
      rawEndTimestamp: subscription.current_period_end,
      rawStartTimestamp: subscription.current_period_start
    });

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
        current_period_end: currentPeriodEnd,
        current_period_start: currentPeriodStart,
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
      sessionId: session.id
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
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!sessionResponse.ok) {
      throw new Error(`Failed to fetch session: ${sessionResponse.status}`);
    }

    const session = await sessionResponse.json();
    
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

async function handleManualSync(body: any) {
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
      .maybeSingle();
    
    if (!subData?.stripe_customer_id) {
      // Try to find user by email and create customer record
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);
      if (userData?.user?.email) {
        const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
        const customersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(userData.user.email)}&limit=1`, {
          headers: {
            'Authorization': `Bearer ${stripeApiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (customersResponse.ok) {
          const customers = await customersResponse.json();
          
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

async function syncCustomerSubscriptions(user_id: string, customerId: string) {
  try {
    // Get active subscriptions from Stripe using REST API
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const subscriptionsResponse = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`, {
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!subscriptionsResponse.ok) {
      throw new Error(`Failed to fetch subscriptions: ${subscriptionsResponse.status}`);
    }

    const subscriptions = await subscriptionsResponse.json();
    
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const planType = subscription.items?.data?.[0]?.price?.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
      const currentPeriodStart = safeTimestamp(subscription.current_period_start);
      
      logStep("Syncing active subscription", {
        userId: user_id,
        planType,
        currentPeriodEnd,
        currentPeriodStart
      });
      
      // Update database
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          stripe_subscription_id: subscription.id,
          plan_type: planType,
          current_period_end: currentPeriodEnd,
          current_period_start: currentPeriodStart,
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
          currentPeriodEnd: currentPeriodEnd
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Check for any recent checkout sessions that might not have been processed
      const sessionsResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions?customer=${customerId}&limit=5`, {
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (sessionsResponse.ok) {
        const sessions = await sessionsResponse.json();
        const paidSessions = sessions.data.filter((s: any) => s.payment_status === "paid" && s.subscription);
        
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
