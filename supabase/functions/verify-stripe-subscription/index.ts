
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

// Improved timestamp handling with proper validation
function safeTimestamp(timestamp: number | null | undefined): string | null {
  // Check if timestamp is null, undefined, or not a number
  if (timestamp == null || typeof timestamp !== 'number') {
    logStep("Timestamp is null or undefined", { timestamp });
    return null;
  }
  
  // Check if timestamp is a valid positive number
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logStep("Invalid timestamp value", { timestamp });
    return null;
  }
  
  try {
    // Convert Unix timestamp to milliseconds and create date
    const date = new Date(timestamp * 1000);
    
    // Validate the created date
    if (isNaN(date.getTime())) {
      logStep("Date creation failed", { timestamp, date });
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
      .select('user_id, email, status, subscription_start_date')
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
              
              // Check if this is a first-time activation
              const isFirstTimeActivation = true; // Assume first time since we're creating a new record
              
              let subscription_start_date = currentPeriodStart;
              let subscription_end_date = null;
              
              // Calculate subscription end date for first-time activations
              if (subscription_start_date) {
                const startDate = new Date(subscription_start_date);
                if (planType === 'monthly') {
                  // Add 30 days
                  const endDate = new Date(startDate);
                  endDate.setDate(startDate.getDate() + 30);
                  subscription_end_date = endDate.toISOString();
                } else if (planType === 'yearly') {
                  // Add 365 days
                  const endDate = new Date(startDate);
                  endDate.setDate(startDate.getDate() + 365);
                  subscription_end_date = endDate.toISOString();
                }
              }
              
              logStep("Creating subscription with timestamps", {
                planType,
                currentPeriodEnd,
                currentPeriodStart,
                subscription_start_date,
                subscription_end_date,
                rawEndTimestamp: subscription.current_period_end,
                rawStartTimestamp: subscription.current_period_start
              });
              
              // Use upsert with email as conflict resolution instead of user_id
              const { error } = await supabase
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
                  subscription_start_date: subscription_start_date,
                  subscription_end_date: subscription_end_date,
                  updated_at: new Date().toISOString()
                }, { 
                  onConflict: 'email',
                  ignoreDuplicates: false 
                });

              if (error) {
                logStep("Failed to create subscription", { error, userId: matchingUser.id });
                throw error;
              } else {
                logStep("Successfully created subscription for user", { 
                  userId: matchingUser.id,
                  subscription_start_date,
                  subscription_end_date
                });
              }
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

    // Check if this is a first-time activation (status changing from trial/trial_expired to active)
    const isFirstTimeActivation = (subsData.status !== 'active' && 
                                (subsData.status === 'trial' || subsData.status === 'trial_expired')) && 
                                !subsData.subscription_start_date;
    
    // Prepare update data
    const updateData: any = {
      user_id: subsData.user_id,
      email: subsData.email,
      status: subscription.status === 'active' ? 'active' : 'inactive',
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      plan_type: planType,
      current_period_end: currentPeriodEnd,
      current_period_start: currentPeriodStart,
      updated_at: new Date().toISOString()
    };

    // Handle first-time activation
    if (isFirstTimeActivation) {
      logStep("First-time activation detected", { previousStatus: subsData.status });
      updateData.subscription_start_date = currentPeriodStart;
      
      // Calculate subscription end date based on plan type
      if (currentPeriodStart) {
        const startDate = new Date(currentPeriodStart);
        let endDate = new Date(startDate);
        
        if (planType === 'monthly') {
          endDate.setDate(startDate.getDate() + 30);
        } else if (planType === 'yearly') {
          endDate.setDate(startDate.getDate() + 365);
        }
        
        updateData.subscription_end_date = endDate.toISOString();
        
        logStep("Setting subscription dates", {
          start: updateData.subscription_start_date,
          end: updateData.subscription_end_date,
          planType
        });
      }
    }

    logStep("Updating existing subscription with timestamps", {
      userId: subsData.user_id,
      planType,
      currentPeriodEnd,
      currentPeriodStart,
      isFirstTimeActivation,
      rawEndTimestamp: subscription.current_period_end,
      rawStartTimestamp: subscription.current_period_start
    });

    // Update Supabase using email for conflict resolution
    const { error } = await supabase
      .from('subscriptions')
      .upsert(updateData, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      });

    if (error) {
      logStep("Failed to update subscription", { error, userId: subsData.user_id });
      throw error;
    } else {
      logStep("Updated subscription for user", { 
        userId: subsData.user_id, 
        status: subscription.status,
        planType,
        currentPeriodEnd,
        isFirstTimeActivation
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
        .select("user_id, status, subscription_start_date")
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

    // Check if existing subscription to see if this is a first-time activation
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("status, subscription_start_date")
      .eq("user_id", userId)
      .maybeSingle();
    
    // Check if this is first-time activation
    const isFirstTimeActivation = !existingSub || 
                              (existingSub.status !== 'active' && !existingSub.subscription_start_date);
    
    // Prepare update data
    const updateData: any = {
      user_id: userId,
      email: customerEmail,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_type: planType,
      current_period_end: currentPeriodEnd,
      current_period_start: currentPeriodStart,
      updated_at: new Date().toISOString()
    };

    // Handle first time activation
    if (isFirstTimeActivation) {
      updateData.subscription_start_date = currentPeriodStart;
      
      if (currentPeriodStart) {
        const startDate = new Date(currentPeriodStart);
        let endDate = new Date(startDate);
        
        if (planType === 'monthly') {
          endDate.setDate(startDate.getDate() + 30);
        } else if (planType === 'yearly') {
          endDate.setDate(startDate.getDate() + 365);
        }
        
        updateData.subscription_end_date = endDate.toISOString();
      }
      
      logStep("First-time activation via checkout", {
        subscription_start_date: updateData.subscription_start_date,
        subscription_end_date: updateData.subscription_end_date,
        planType
      });
    }

    logStep("Processing checkout with subscription details", {
      planType,
      currentPeriodEnd,
      currentPeriodStart,
      isFirstTimeActivation,
      rawEndTimestamp: subscription.current_period_end,
      rawStartTimestamp: subscription.current_period_start
    });

    // Update database using email for conflict resolution
    const { error } = await supabase
      .from("subscriptions")
      .upsert(updateData, {
        onConflict: "email",
        ignoreDuplicates: false
      });

    if (error) {
      logStep("Database update failed", { error });
      throw error;
    }

    logStep("Payment processed successfully", {
      userId,
      subscriptionId,
      planType,
      email: customerEmail,
      subscription_start_date: updateData.subscription_start_date,
      subscription_end_date: updateData.subscription_end_date
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
      .select("stripe_customer_id, stripe_subscription_id, email, status, subscription_start_date")
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
            
            // Update database with customer ID using upsert with email conflict resolution
            const { error } = await supabase
              .from("subscriptions")
              .upsert({
                user_id: user_id,
                email: userData.user.email,
                stripe_customer_id: customer.id,
                status: "trial_expired",
                updated_at: new Date().toISOString()
              }, { 
                onConflict: "email",
                ignoreDuplicates: false 
              });
            
            if (error) {
              logStep("Failed to update subscription with customer ID", { error, userId: user_id });
              throw error;
            }
            
            // Continue with sync using this customer
            return await syncCustomerSubscriptions(user_id, customer.id, subData);
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "No Stripe customer found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    return await syncCustomerSubscriptions(user_id, subData.stripe_customer_id, subData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error in manual sync: ${errorMessage}`, { userId: user_id, error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}

async function syncCustomerSubscriptions(user_id: string, customerId: string, existingSubscription: any = null) {
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
      
      // Check for first-time activation
      const isFirstTimeActivation = existingSubscription && 
                                existingSubscription.status !== 'active' && 
                                !existingSubscription.subscription_start_date;
      
      // Prepare update data
      const updateData: any = {
        status: 'active',
        plan_type: planType,
        current_period_end: currentPeriodEnd,
        current_period_start: currentPeriodStart,
        stripe_subscription_id: subscription.id
      };
      
      // Handle first-time activation
      if (isFirstTimeActivation) {
        updateData.subscription_start_date = currentPeriodStart;
        
        if (currentPeriodStart) {
          const startDate = new Date(currentPeriodStart);
          let endDate = new Date(startDate);
          
          if (planType === 'monthly') {
            endDate.setDate(startDate.getDate() + 30);
          } else if (planType === 'yearly') {
            endDate.setDate(startDate.getDate() + 365);
          }
          
          updateData.subscription_end_date = endDate.toISOString();
        }
        
        logStep("First-time activation via manual sync", {
          subscription_start_date: updateData.subscription_start_date,
          subscription_end_date: updateData.subscription_end_date,
          planType
        });
      }
      
      logStep("Syncing active subscription", {
        userId: user_id,
        planType,
        currentPeriodEnd,
        currentPeriodStart,
        isFirstTimeActivation,
        subscription_start_date: updateData.subscription_start_date,
        subscription_end_date: updateData.subscription_end_date
      });
      
      // Get user email for upsert
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);
      const userEmail = userData?.user?.email;
      
      if (!userEmail) {
        throw new Error("User email not found");
      }
      
      // Update database using upsert with email conflict resolution
      const { error, data: updatedSub } = await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("user_id", user_id)
        .select("subscription_start_date, subscription_end_date")
        .single();
      
      if (error) {
        logStep("Database update error", { error, userId: user_id });
        throw new Error(`Database update failed: ${error.message}`);
      }
      
      logStep("Manual sync successful", { 
        userId: user_id, 
        status: "active",
        subscription_start_date: updatedSub?.subscription_start_date,
        subscription_end_date: updatedSub?.subscription_end_date
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "active",
          planType: planType,
          currentPeriodEnd: currentPeriodEnd,
          subscription_start_date: updatedSub?.subscription_start_date,
          subscription_end_date: updatedSub?.subscription_end_date
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
          
          // Fetch the updated subscription
          const { data: updatedSub } = await supabase
            .from("subscriptions")
            .select("subscription_start_date, subscription_end_date, status")
            .eq("user_id", user_id)
            .single();
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              status: "active",
              message: "Found and processed recent payment",
              subscription_start_date: updatedSub?.subscription_start_date,
              subscription_end_date: updatedSub?.subscription_end_date
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      
      // No active subscription found, return existing subscription data
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "trial_expired",
          subscription_start_date: existingSubscription?.subscription_start_date,
          subscription_end_date: existingSubscription?.subscription_end_date
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(`Error syncing customer subscriptions: ${errorMessage}`, { userId: user_id, customerId });
    throw error;
  }
}
