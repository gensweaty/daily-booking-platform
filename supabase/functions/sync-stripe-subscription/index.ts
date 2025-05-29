
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Safe timestamp conversion function with fallback logic
function safeTimestamp(timestamp: number | null | undefined): string | null {
  if (timestamp == null || typeof timestamp !== 'number') {
    logStep("Timestamp is null or undefined", { timestamp });
    return null;
  }
  
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logStep("Invalid timestamp value", { timestamp });
    return null;
  }
  
  try {
    const date = new Date(timestamp * 1000);
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

// Function to fix active subscriptions with missing dates using fallback logic
async function fixActiveSubscriptionDates(supabase: any, userId: string, planType: string) {
  logStep("FIXING MISSING SUBSCRIPTION DATES - FALLBACK MODE", { userId, planType });
  
  // Get the subscription record to see when it was created/updated
  const { data: subRecord, error: subError } = await supabase
    .from('subscriptions')
    .select('created_at, updated_at')
    .eq('user_id', userId)
    .single();
  
  if (subError || !subRecord) {
    logStep("Could not fetch subscription record for date fixing", { error: subError });
    return { subscription_start_date: null, subscription_end_date: null };
  }
  
  // Use the subscription creation date as FALLBACK start date only
  const startDate = new Date(subRecord.created_at);
  const subscription_start_date = startDate.toISOString();
  const subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
  
  logStep("FALLBACK: Calculated subscription dates from creation time", {
    created_at: subRecord.created_at,
    subscription_start_date,
    subscription_end_date,
    planType,
    warning: "Using fallback logic - should use Stripe current_period_start when available"
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
    logStep("Error updating subscription with calculated dates", updateError);
  } else {
    logStep("Successfully updated subscription with calculated dates (FALLBACK)");
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
            
            // FIXED: Use Stripe's current_period_start as the authoritative start date for PAID subscriptions
            const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
            const currentPeriodStart = safeTimestamp(subscription.current_period_start);

            // Check if this is a first-time activation (missing start/end dates)
            const isFirstTimeActivation = !existingSubscription.subscription_start_date || !existingSubscription.subscription_end_date;
            
            let subscription_start_date = existingSubscription.subscription_start_date;
            let subscription_end_date = existingSubscription.subscription_end_date;
            
            // CRITICAL FIX: For paid subscriptions, ALWAYS use Stripe's current_period_start as start date
            if (isFirstTimeActivation || !subscription_start_date) {
              if (currentPeriodStart) {
                // Use Stripe's current_period_start as the PAID subscription start date
                subscription_start_date = currentPeriodStart;
                
                // Calculate fresh subscription end date based on when user actually PAID
                subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
                
                logStep("Using Stripe current_period_start for PAID subscription dates", {
                  subscription_start_date,
                  subscription_end_date,
                  planType,
                  currentPeriodStart,
                  currentPeriodEnd,
                  message: "Fresh countdown from actual payment date"
                });
              } else {
                // Fallback: Use creation time for missing dates (should rarely happen)
                logStep("Stripe timestamps missing, using creation time fallback");
                const fixedDates = await fixActiveSubscriptionDates(supabase, user.id, planType);
                subscription_start_date = fixedDates.subscription_start_date;
                subscription_end_date = fixedDates.subscription_end_date;
              }
            }
            
            logStep("Found active subscription", { 
              subscriptionId: subscription.id,
              planType,
              currentPeriodEnd,
              currentPeriodStart,
              subscription_start_date,
              subscription_end_date,
              isFirstTimeActivation,
              message: "Using Stripe data as source of truth for paid subscription"
            });

            // Update subscription record with proper dates
            const updateData: any = {
              status: 'active',
              plan_type: planType,
              current_period_end: currentPeriodEnd || subscription_end_date,
              current_period_start: currentPeriodStart || subscription_start_date,
              stripe_subscription_id: subscription.id,
              attrs: subscription,
              currency: subscription.currency || 'usd',
              updated_at: new Date().toISOString()
            };
            
            // Set the dates for first activation or update existing ones with Stripe data
            if (isFirstTimeActivation || currentPeriodStart) {
              updateData.subscription_start_date = subscription_start_date;
              updateData.subscription_end_date = subscription_end_date;
            }

            const { error: updateError } = await supabase
              .from('subscriptions')
              .update(updateData)
              .eq('email', user.email);

            if (updateError) {
              logStep("Error updating subscription", updateError);
              throw updateError;
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
      logStep("Found active subscription", { subscriptionId: subscription.id });

      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
      const currentPeriodStart = safeTimestamp(subscription.current_period_start);

      // Check if this is a first-time activation
      const isFirstTimeActivation = !existingSubscription || 
                                   !existingSubscription.subscription_start_date ||
                                   !existingSubscription.subscription_end_date;
      
      let subscription_start_date = existingSubscription?.subscription_start_date;
      let subscription_end_date = existingSubscription?.subscription_end_date;
      
      // CRITICAL FIX: For NEW customers with paid subscriptions, use Stripe's current_period_start
      if (isFirstTimeActivation) {
        if (currentPeriodStart) {
          // Use Stripe's current_period_start as the PAID subscription start date
          subscription_start_date = currentPeriodStart;
          
          // Calculate fresh subscription end date based on when user actually PAID
          subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
          
          logStep("First time activation for new customer - using Stripe current_period_start", {
            subscription_start_date,
            subscription_end_date,
            planType,
            currentPeriodStart,
            message: "Fresh 30-day countdown from actual payment date"
          });
        } else {
          // Fallback: Use creation time for missing dates (should rarely happen)
          logStep("Stripe timestamps missing for new customer, using creation time fallback");
          const fixedDates = await fixActiveSubscriptionDates(supabase, user.id, planType);
          subscription_start_date = fixedDates.subscription_start_date;
          subscription_end_date = fixedDates.subscription_end_date;
        }
      }

      // Prepare update data
      const upsertData: any = {
        user_id: user.id,
        email: user.email,
        stripe_customer_id: stripeCustomer.id,
        stripe_subscription_id: subscription.id,
        status: 'active',
        plan_type: planType,
        current_period_end: currentPeriodEnd || subscription_end_date,
        current_period_start: currentPeriodStart || subscription_start_date,
        trial_end_date: null,
        attrs: subscription,
        currency: subscription.currency || 'usd',
        updated_at: new Date().toISOString()
      };

      // Set subscription dates using Stripe data as source of truth
      if (isFirstTimeActivation || currentPeriodStart) {
        upsertData.subscription_start_date = subscription_start_date;
        upsertData.subscription_end_date = subscription_end_date;
      }

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
        currentPeriodEnd: currentPeriodEnd || subscription_end_date,
        subscription_start_date: subscription_start_date,
        subscription_end_date: subscription_end_date
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
