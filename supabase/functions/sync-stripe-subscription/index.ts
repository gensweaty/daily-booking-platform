import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Enhanced timestamp conversion with better debugging
function safeTimestamp(timestamp: number | null | undefined, source: string = "unknown"): string | null {
  logStep(`Processing timestamp from ${source}`, { timestamp, type: typeof timestamp });
  
  if (timestamp == null) {
    logStep(`Timestamp is null/undefined from ${source}`);
    return null;
  }
  
  if (typeof timestamp !== 'number') {
    logStep(`Timestamp is not a number from ${source}`, { timestamp, type: typeof timestamp });
    return null;
  }
  
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logStep(`Invalid timestamp value from ${source}`, { timestamp });
    return null;
  }
  
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      logStep(`Date creation failed from ${source}`, { timestamp, date });
      return null;
    }
    const isoString = date.toISOString();
    logStep(`Successfully converted timestamp from ${source}`, { timestamp, isoString });
    return isoString;
  } catch (error) {
    logStep(`Error converting timestamp from ${source}`, { timestamp, error: error.message });
    return null;
  }
}

// Function to calculate subscription end date from start date and plan type
function calculateSubscriptionEndDate(startDate: string, planType: string): string {
  const start = new Date(startDate);
  let endDate = new Date(start);
  
  if (planType === 'monthly') {
    endDate.setDate(start.getDate() + 30);
  } else if (planType === 'yearly') {
    endDate.setDate(start.getDate() + 365);
  } else {
    // Default to 30 days
    endDate.setDate(start.getDate() + 30);
  }
  
  return endDate.toISOString();
}

// Enhanced function to fix active subscriptions with missing dates
async function fixActiveSubscriptionDates(supabase: any, userId: string, planType: string, stripeSubscription?: any) {
  logStep("FIXING MISSING SUBSCRIPTION DATES", { userId, planType, hasStripeData: !!stripeSubscription });
  
  let subscription_start_date: string;
  let subscription_end_date: string;
  
  // If we have Stripe subscription data, try to use it first
  if (stripeSubscription) {
    logStep("Attempting to use Stripe subscription data for dates", {
      id: stripeSubscription.id,
      created: stripeSubscription.created,
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
      start_date: stripeSubscription.start_date
    });
    
    // Try different Stripe timestamp fields in order of preference
    let stripeStartTimestamp = null;
    
    // 1. Try current_period_start (most recent billing period)
    if (stripeSubscription.current_period_start) {
      stripeStartTimestamp = stripeSubscription.current_period_start;
      logStep("Using current_period_start from Stripe", { timestamp: stripeStartTimestamp });
    }
    // 2. Try start_date (original subscription start)
    else if (stripeSubscription.start_date) {
      stripeStartTimestamp = stripeSubscription.start_date;
      logStep("Using start_date from Stripe", { timestamp: stripeStartTimestamp });
    }
    // 3. Try created (subscription creation time)
    else if (stripeSubscription.created) {
      stripeStartTimestamp = stripeSubscription.created;
      logStep("Using created from Stripe", { timestamp: stripeStartTimestamp });
    }
    
    if (stripeStartTimestamp) {
      const stripeStartDate = safeTimestamp(stripeStartTimestamp, "stripe_subscription");
      if (stripeStartDate) {
        subscription_start_date = stripeStartDate;
        subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
        
        logStep("Successfully calculated dates from Stripe data", {
          subscription_start_date,
          subscription_end_date,
          planType,
          source: "stripe_subscription_data"
        });
        
        // Update the subscription with Stripe-based dates
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            subscription_start_date,
            subscription_end_date,
            current_period_start: subscription_start_date,
            current_period_end: subscription_end_date,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (updateError) {
          logStep("Error updating subscription with Stripe dates", updateError);
        } else {
          logStep("Successfully updated subscription with Stripe dates");
        }
        
        return { subscription_start_date, subscription_end_date };
      }
    }
  }
  
  // Fallback: Use current time as start date (user just paid)
  logStep("FALLBACK: Using current time as subscription start (recent payment)", {
    reason: "No valid Stripe timestamps found",
    userId,
    planType
  });
  
  const now = new Date();
  subscription_start_date = now.toISOString();
  subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
  
  logStep("FALLBACK: Calculated subscription dates from current time", {
    subscription_start_date,
    subscription_end_date,
    planType,
    warning: "Using current time as fallback - this should give user fresh period"
  });
  
  // Update the subscription with the calculated dates
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      subscription_start_date,
      subscription_end_date,
      current_period_start: subscription_start_date,
      current_period_end: subscription_end_date,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
  
  if (updateError) {
    logStep("Error updating subscription with fallback dates", updateError);
  } else {
    logStep("Successfully updated subscription with fallback dates (CURRENT TIME)");
  }
  
  return { subscription_start_date, subscription_end_date };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check for existing subscription record first
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // If user has existing trial or active subscription, check if it's still valid
    if (existingSubscription) {
      logStep("Found existing subscription", { 
        status: existingSubscription.status,
        planType: existingSubscription.plan_type,
        currentPeriodEnd: existingSubscription.current_period_end,
        trialEndDate: existingSubscription.trial_end_date,
        subscriptionStartDate: existingSubscription.subscription_start_date,
        subscriptionEndDate: existingSubscription.subscription_end_date
      });

      // CRITICAL FIX: Check for active subscriptions with missing dates
      if (existingSubscription.status === 'active' && 
          (!existingSubscription.subscription_start_date || !existingSubscription.subscription_end_date)) {
        
        logStep("FOUND ACTIVE SUBSCRIPTION WITH MISSING DATES - FIXING NOW", {
          userId: user.id,
          email: user.email,
          status: existingSubscription.status,
          planType: existingSubscription.plan_type
        });
        
        const fixedDates = await fixActiveSubscriptionDates(
          supabase, 
          user.id, 
          existingSubscription.plan_type || 'monthly'
        );
        
        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          planType: existingSubscription.plan_type,
          currentPeriodEnd: fixedDates.subscription_end_date,
          subscription_start_date: fixedDates.subscription_start_date,
          subscription_end_date: fixedDates.subscription_end_date,
          message: 'Fixed missing subscription dates'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // For trial subscriptions, check if trial is still valid
      if (existingSubscription.status === 'trial' && existingSubscription.trial_end_date) {
        const trialEnd = new Date(existingSubscription.trial_end_date);
        const now = new Date();
        
        if (trialEnd > now) {
          // Trial is still valid
          return new Response(JSON.stringify({
            success: true,
            status: 'trial',
            planType: existingSubscription.plan_type,
            trialEnd: existingSubscription.trial_end_date,
            currentPeriodEnd: existingSubscription.current_period_end,
            subscription_end_date: existingSubscription.subscription_end_date
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          // Trial has expired, update status
          await supabase
            .from('subscriptions')
            .update({
              status: 'trial_expired',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

          return new Response(JSON.stringify({
            success: true,
            status: 'trial_expired',
            message: 'Trial period has expired',
            subscription_end_date: existingSubscription.subscription_end_date
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // Check Stripe if user has a customer ID
      if (existingSubscription.stripe_customer_id) {
        const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
        const subscriptionsResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions?customer=${existingSubscription.stripe_customer_id}&status=active&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${stripeApiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        if (subscriptionsResponse.ok) {
          const subscriptions = await subscriptionsResponse.json();
          
          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
            
            logStep("Found active Stripe subscription - detailed data", {
              subscriptionId: subscription.id,
              planType,
              created: subscription.created,
              current_period_start: subscription.current_period_start,
              current_period_end: subscription.current_period_end,
              start_date: subscription.start_date,
              status: subscription.status
            });
            
            // FIXED: Use Stripe's data to determine proper start date for PAID subscriptions
            const currentPeriodEnd = safeTimestamp(subscription.current_period_end, "current_period_end");
            const currentPeriodStart = safeTimestamp(subscription.current_period_start, "current_period_start");

            // Check if this is a first-time activation (missing start/end dates)
            const isFirstTimeActivation = !existingSubscription.subscription_start_date || !existingSubscription.subscription_end_date;
            
            let subscription_start_date = existingSubscription.subscription_start_date;
            let subscription_end_date = existingSubscription.subscription_end_date;
            
            // CRITICAL FIX: For paid subscriptions, use the most recent period or fix missing dates
            if (isFirstTimeActivation || !subscription_start_date) {
              logStep("Need to fix subscription dates for paid plan", {
                isFirstTimeActivation,
                hasStartDate: !!subscription_start_date,
                stripeCurrentPeriodStart: currentPeriodStart
              });
              
              // Use the enhanced fixing function that tries Stripe data first
              const fixedDates = await fixActiveSubscriptionDates(
                supabase, 
                user.id, 
                planType,
                subscription  // Pass the full Stripe subscription object
              );
              
              subscription_start_date = fixedDates.subscription_start_date;
              subscription_end_date = fixedDates.subscription_end_date;
            }

            return new Response(JSON.stringify({
              success: true,
              status: 'active',
              planType: planType,
              stripe_subscription_id: subscription.id,
              currentPeriodEnd: currentPeriodEnd || subscription_end_date,
              subscription_start_date: subscription_start_date,
              subscription_end_date: subscription_end_date
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
      }
    }

    // Try to find Stripe customer by email
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY");
    const customersResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!customersResponse.ok) {
      logStep("Error fetching customers from Stripe", { status: customersResponse.status });
      throw new Error(`Failed to fetch customers: ${customersResponse.status}`);
    }

    const customers = await customersResponse.json();
    
    if (!customers.data || customers.data.length === 0) {
      logStep("No Stripe customer found");
      
      // If user doesn't have a trial subscription, create one
      if (!existingSubscription) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const { error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            email: user.email,
            status: 'trial',
            plan_type: 'monthly',
            trial_end_date: trialEndDate.toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString(),
            currency: 'usd',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (createError) {
          logStep("Error creating trial subscription", createError);
        } else {
          logStep("Trial subscription created", { trialEndDate: trialEndDate.toISOString() });
          return new Response(JSON.stringify({
            success: true,
            status: 'trial',
            planType: 'monthly',
            trialEnd: trialEndDate.toISOString(),
            currentPeriodEnd: trialEndDate.toISOString(),
            subscription_end_date: null
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // Update existing subscription to trial_expired if no Stripe customer
      if (existingSubscription && existingSubscription.status !== 'trial_expired') {
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .update({
            status: 'trial_expired',
            updated_at: new Date().toISOString()
          })
          .eq('email', user.email);

        if (upsertError) {
          logStep("Error updating subscription to expired", upsertError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'No Stripe customer found',
        subscription_end_date: existingSubscription?.subscription_end_date
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripeCustomer = customers.data[0];
    logStep("Found Stripe customer", { customerId: stripeCustomer.id });

    // Check for active subscriptions
    const subscriptionsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${stripeCustomer.id}&status=active&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!subscriptionsResponse.ok) {
      throw new Error(`Failed to fetch subscriptions: ${subscriptionsResponse.status}`);
    }

    const subscriptions = await subscriptionsResponse.json();

    if (subscriptions.data && subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      logStep("Found active subscription for new customer", { subscriptionId: subscription.id });

      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      
      logStep("New customer active subscription - detailed data", {
        subscriptionId: subscription.id,
        planType,
        created: subscription.created,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        start_date: subscription.start_date,
        status: subscription.status
      });

      // For new customers, always use the enhanced fixing function
      const fixedDates = await fixActiveSubscriptionDates(
        supabase, 
        user.id, 
        planType,
        subscription  // Pass the full Stripe subscription object
      );

      // Prepare update data
      const upsertData: any = {
        user_id: user.id,
        email: user.email,
        stripe_customer_id: stripeCustomer.id,
        stripe_subscription_id: subscription.id,
        status: 'active',
        plan_type: planType,
        current_period_end: fixedDates.subscription_end_date,
        current_period_start: fixedDates.subscription_start_date,
        trial_end_date: null,
        attrs: subscription,
        currency: subscription.currency || 'usd',
        subscription_start_date: fixedDates.subscription_start_date,
        subscription_end_date: fixedDates.subscription_end_date,
        updated_at: new Date().toISOString()
      };

      // Update subscription record using email for conflict resolution
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert(upsertData, { onConflict: 'email' });

      if (upsertError) {
        logStep("Error upserting subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'active',
        planType: planType,
        stripe_subscription_id: subscription.id,
        currentPeriodEnd: fixedDates.subscription_end_date,
        subscription_start_date: fixedDates.subscription_start_date,
        subscription_end_date: fixedDates.subscription_end_date
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No active subscription found");
      
      // Update subscriptions with expired status using email conflict resolution
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomer.id,
          status: 'trial_expired',
          plan_type: 'monthly',
          currency: 'usd',
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

      if (upsertError) {
        logStep("Error upserting expired subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'Customer found but no active subscription',
        subscription_end_date: existingSubscription?.subscription_end_date
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-stripe-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
