
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Enhanced timestamp conversion with multiple fallback strategies
function extractTimestampFromStripe(stripeSubscription: any, source: string = "stripe"): string | null {
  logStep(`Analyzing Stripe subscription object structure from ${source}`, {
    fullObject: stripeSubscription,
    hasCurrentPeriodStart: !!stripeSubscription.current_period_start,
    hasCurrentPeriodEnd: !!stripeSubscription.current_period_end,
    hasStartDate: !!stripeSubscription.start_date,
    hasCreated: !!stripeSubscription.created,
    currentPeriodStartType: typeof stripeSubscription.current_period_start,
    currentPeriodEndType: typeof stripeSubscription.current_period_end
  });

  // Strategy 1: Use current_period_start (most recent billing cycle)
  if (stripeSubscription.current_period_start) {
    const timestamp = parseStripeTimestamp(stripeSubscription.current_period_start, "current_period_start");
    if (timestamp) {
      logStep(`Successfully extracted timestamp from current_period_start`, { 
        raw: stripeSubscription.current_period_start, 
        parsed: timestamp 
      });
      return timestamp;
    }
  }

  // Strategy 2: Use start_date (original subscription start)
  if (stripeSubscription.start_date) {
    const timestamp = parseStripeTimestamp(stripeSubscription.start_date, "start_date");
    if (timestamp) {
      logStep(`Successfully extracted timestamp from start_date`, { 
        raw: stripeSubscription.start_date, 
        parsed: timestamp 
      });
      return timestamp;
    }
  }

  // Strategy 3: Use created (subscription creation time)
  if (stripeSubscription.created) {
    const timestamp = parseStripeTimestamp(stripeSubscription.created, "created");
    if (timestamp) {
      logStep(`Successfully extracted timestamp from created`, { 
        raw: stripeSubscription.created, 
        parsed: timestamp 
      });
      return timestamp;
    }
  }

  logStep(`Failed to extract any valid timestamp from Stripe subscription`, {
    availableFields: Object.keys(stripeSubscription),
    timestampFields: {
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
      start_date: stripeSubscription.start_date,
      created: stripeSubscription.created
    }
  });

  return null;
}

// Robust timestamp parser that handles multiple formats
function parseStripeTimestamp(value: any, fieldName: string): string | null {
  logStep(`Parsing timestamp field ${fieldName}`, { 
    value, 
    type: typeof value,
    isNumber: typeof value === 'number',
    isString: typeof value === 'string',
    isFinite: Number.isFinite(value)
  });

  if (value == null || value === undefined) {
    logStep(`Timestamp field ${fieldName} is null/undefined`);
    return null;
  }

  let timestamp: number;

  // Handle different formats
  if (typeof value === 'number') {
    timestamp = value;
  } else if (typeof value === 'string') {
    // Try to parse string as number
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      logStep(`Cannot parse string timestamp ${fieldName}`, { value });
      return null;
    }
    timestamp = parsed;
  } else {
    logStep(`Unsupported timestamp type for ${fieldName}`, { value, type: typeof value });
    return null;
  }

  // Validate timestamp is reasonable
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logStep(`Invalid timestamp value for ${fieldName}`, { timestamp });
    return null;
  }

  // Handle potential scientific notation or milliseconds vs seconds
  if (timestamp > 1e12) {
    // Timestamp is in milliseconds, convert to seconds
    timestamp = timestamp / 1000;
    logStep(`Converted milliseconds to seconds for ${fieldName}`, { original: value, converted: timestamp });
  }

  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      logStep(`Date creation failed for ${fieldName}`, { timestamp, date });
      return null;
    }
    
    const isoString = date.toISOString();
    logStep(`Successfully converted timestamp for ${fieldName}`, { 
      originalValue: value,
      timestamp, 
      isoString,
      dateCheck: date.getTime()
    });
    return isoString;
  } catch (error) {
    logStep(`Error converting timestamp for ${fieldName}`, { timestamp, error: error.message });
    return null;
  }
}

// Step 3: Enhanced plan recognition for yearly subscriptions
function calculateSubscriptionEndDate(startDate: string, planType: string): string {
  const start = new Date(startDate);
  let endDate = new Date(start);
  
  if (planType === 'yearly') {
    // Add 365 days for yearly plan
    endDate.setDate(start.getDate() + 365);
  } else if (planType === 'monthly') {
    endDate.setDate(start.getDate() + 30);
  } else {
    // Default to 30 days
    endDate.setDate(start.getDate() + 30);
  }
  
  logStep(`Calculated subscription end date`, { 
    startDate, 
    planType, 
    endDate: endDate.toISOString(),
    daysAdded: planType === 'yearly' ? 365 : 30
  });
  
  return endDate.toISOString();
}

// CRITICAL: Handle payment detection and proper date calculation
async function handleActiveSubscriptionDates(supabase: any, userId: string, planType: string, stripeSubscription: any, existingSubscription?: any) {
  logStep("HANDLING ACTIVE SUBSCRIPTION DATES", { 
    userId, 
    planType, 
    hasStripeData: !!stripeSubscription,
    existingStatus: existingSubscription?.status,
    existingHasStartDate: !!existingSubscription?.subscription_start_date,
    existingHasEndDate: !!existingSubscription?.subscription_end_date
  });

  let subscription_start_date: string;
  let subscription_end_date: string;

  // DETECT PAYMENT EVENT: If user was on trial and now has active Stripe subscription
  const isPaymentEvent = existingSubscription?.status === 'trial' || 
                        !existingSubscription?.subscription_start_date ||
                        !existingSubscription?.subscription_end_date;

  if (isPaymentEvent) {
    logStep("PAYMENT EVENT DETECTED - User just paid or needs fresh dates", {
      reason: existingSubscription?.status === 'trial' ? 'trial_to_active' : 'missing_dates',
      existingStatus: existingSubscription?.status
    });

    // For payment events, try to use Stripe timestamps first
    const stripeStartDate = extractTimestampFromStripe(stripeSubscription, "payment_event");
    
    if (stripeStartDate) {
      subscription_start_date = stripeStartDate;
      logStep("Using Stripe timestamp for payment event", { subscription_start_date });
    } else {
      // Fallback: Use current time (user just paid)
      subscription_start_date = new Date().toISOString();
      logStep("FALLBACK: Using current time for payment event", { 
        subscription_start_date,
        reason: "No valid Stripe timestamp found"
      });
    }

    subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);

    logStep("PAYMENT EVENT: Calculated fresh subscription period", {
      subscription_start_date,
      subscription_end_date,
      planType,
      daysFromNow: Math.ceil((new Date(subscription_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    });

  } else {
    // User already has valid dates, keep them unless Stripe has newer data
    const stripeStartDate = extractTimestampFromStripe(stripeSubscription, "existing_subscription");
    
    if (stripeStartDate && new Date(stripeStartDate) > new Date(existingSubscription.subscription_start_date)) {
      // Stripe has newer data, use it
      subscription_start_date = stripeStartDate;
      subscription_end_date = calculateSubscriptionEndDate(subscription_start_date, planType);
      logStep("Updated with newer Stripe timestamp", { subscription_start_date, subscription_end_date });
    } else {
      // Keep existing dates
      subscription_start_date = existingSubscription.subscription_start_date;
      subscription_end_date = existingSubscription.subscription_end_date;
      logStep("Keeping existing subscription dates", { subscription_start_date, subscription_end_date });
    }
  }

  // Update the subscription with the calculated dates
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      subscription_start_date,
      subscription_end_date,
      current_period_start: subscription_start_date,
      current_period_end: subscription_end_date,
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    logStep("Error updating subscription dates", updateError);
  } else {
    logStep("Successfully updated subscription with dates", {
      subscription_start_date,
      subscription_end_date,
      daysRemaining: Math.ceil((new Date(subscription_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    });
  }

  return { subscription_start_date, subscription_end_date };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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

    // If user has existing subscription, check if it's still valid
    if (existingSubscription) {
      logStep("Found existing subscription", { 
        status: existingSubscription.status,
        planType: existingSubscription.plan_type,
        currentPeriodEnd: existingSubscription.current_period_end,
        trialEndDate: existingSubscription.trial_end_date,
        subscriptionStartDate: existingSubscription.subscription_start_date,
        subscriptionEndDate: existingSubscription.subscription_end_date
      });

      // CRITICAL: If user has ultimate plan, NEVER change it
      if (existingSubscription.plan_type === 'ultimate' && existingSubscription.status === 'active') {
        logStep("User has ultimate plan, returning without checking Stripe");
        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          planType: 'ultimate',
          subscription_start_date: existingSubscription.subscription_start_date,
          subscription_end_date: null // Ultimate has no end date
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // CRITICAL: If user has active subscription with future end date, preserve it
      if (existingSubscription.status === 'active' && existingSubscription.subscription_end_date) {
        const endDate = new Date(existingSubscription.subscription_end_date);
        const now = new Date();
        
        if (endDate > now) {
          logStep("User has active subscription with future end date, preserving it", {
            endDate: existingSubscription.subscription_end_date,
            planType: existingSubscription.plan_type,
            daysRemaining: Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          });
          
          return new Response(JSON.stringify({
            success: true,
            status: 'active',
            planType: existingSubscription.plan_type,
            currentPeriodEnd: existingSubscription.subscription_end_date,
            subscription_start_date: existingSubscription.subscription_start_date,
            subscription_end_date: existingSubscription.subscription_end_date
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          // Subscription has expired, update status
          logStep("Active subscription has expired, updating status");
          await supabase
            .from('subscriptions')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

          return new Response(JSON.stringify({
            success: true,
            status: 'expired',
            planType: existingSubscription.plan_type,
            subscription_end_date: existingSubscription.subscription_end_date
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // For trial subscriptions, check if trial is still valid
      if (existingSubscription.status === 'trial' && existingSubscription.trial_end_date) {
        const trialEnd = new Date(existingSubscription.trial_end_date);
        const now = new Date();
        
        logStep("Checking trial validity", {
          trialEndDate: existingSubscription.trial_end_date,
          currentTime: now.toISOString(),
          isTrialValid: trialEnd > now,
          hoursRemaining: Math.round((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60))
        });
        
        if (trialEnd > now) {
          // Trial is still valid, but check Stripe for payment first
          logStep("Trial still valid, checking Stripe for payment");
        } else {
          // Trial has expired, update status with proper constraint handling
          logStep("Trial has expired, updating status");
          await supabase
            .from('subscriptions')
            .update({
              status: 'trial_expired',
              subscription_end_date: existingSubscription.trial_end_date, // Set end date to satisfy constraint
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

          return new Response(JSON.stringify({
            success: true,
            status: 'trial_expired',
            message: 'Trial period has expired',
            subscription_end_date: existingSubscription.trial_end_date
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // Only check Stripe if user has a customer ID and we need to validate/update
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
            
            // Step 3: Enhanced plan recognition for yearly subscriptions
            const interval = subscription.items.data[0].price.recurring?.interval;
            const planType = interval === 'year' ? 'yearly'
                          : interval === 'month' ? 'monthly'
                          : 'unknown';
            
            logStep("Found active Stripe subscription - FULL DEBUG", {
              subscriptionId: subscription.id,
              planType,
              interval,
              fullStripeObject: subscription,
              timestampFields: {
                created: subscription.created,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                start_date: subscription.start_date
              }
            });
            
            // Handle the active subscription with proper date calculation
            const { subscription_start_date, subscription_end_date } = await handleActiveSubscriptionDates(
              supabase, 
              user.id, 
              planType,
              subscription,
              existingSubscription
            );

            return new Response(JSON.stringify({
              success: true,
              status: 'active',
              planType: planType,
              stripe_subscription_id: subscription.id,
              currentPeriodEnd: subscription_end_date,
              subscription_start_date: subscription_start_date,
              subscription_end_date: subscription_end_date
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          } else {
            // No active Stripe subscription found, but preserve existing valid subscription if still valid
            if (existingSubscription.status === 'active' && existingSubscription.subscription_end_date) {
              const endDate = new Date(existingSubscription.subscription_end_date);
              const now = new Date();
              
              if (endDate > now) {
                logStep("No Stripe subscription but local subscription still valid, preserving it");
                return new Response(JSON.stringify({
                  success: true,
                  status: 'active',
                  planType: existingSubscription.plan_type,
                  currentPeriodEnd: existingSubscription.subscription_end_date,
                  subscription_start_date: existingSubscription.subscription_start_date,
                  subscription_end_date: existingSubscription.subscription_end_date
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                  status: 200,
                });
              }
            }
          }
        }
      } else {
        // No Stripe customer ID, but user has existing subscription - preserve it if valid
        if (existingSubscription.status === 'active' && existingSubscription.subscription_end_date) {
          const endDate = new Date(existingSubscription.subscription_end_date);
          const now = new Date();
          
          if (endDate > now) {
            logStep("No Stripe customer ID but local subscription still valid, preserving it");
            return new Response(JSON.stringify({
              success: true,
              status: 'active',
              planType: existingSubscription.plan_type,
              currentPeriodEnd: existingSubscription.subscription_end_date,
              subscription_start_date: existingSubscription.subscription_start_date,
              subscription_end_date: existingSubscription.subscription_end_date
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
      
      // CRITICAL: Don't throw error on Stripe failure - preserve existing valid subscriptions
      if (existingSubscription) {
        if (existingSubscription.plan_type === 'ultimate' && existingSubscription.status === 'active') {
          logStep("Stripe failed but preserving ultimate subscription");
          return new Response(JSON.stringify({
            success: true,
            status: 'active',
            planType: 'ultimate',
            subscription_start_date: existingSubscription.subscription_start_date,
            subscription_end_date: null
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        
        if (existingSubscription.status === 'active' && existingSubscription.subscription_end_date) {
          const endDate = new Date(existingSubscription.subscription_end_date);
          const now = new Date();
          
          if (endDate > now) {
            logStep("Stripe failed but preserving active subscription with future end date");
            return new Response(JSON.stringify({
              success: true,
              status: 'active',
              planType: existingSubscription.plan_type,
              currentPeriodEnd: existingSubscription.subscription_end_date,
              subscription_start_date: existingSubscription.subscription_start_date,
              subscription_end_date: existingSubscription.subscription_end_date
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
        
        if (existingSubscription.status === 'trial' && existingSubscription.trial_end_date) {
          const trialEnd = new Date(existingSubscription.trial_end_date);
          const now = new Date();
          
          if (trialEnd > now) {
            logStep("Stripe failed but preserving valid trial");
            return new Response(JSON.stringify({
              success: true,
              status: 'trial',
              planType: existingSubscription.plan_type,
              trialEnd: existingSubscription.trial_end_date,
              currentPeriodEnd: existingSubscription.trial_end_date,
              subscription_end_date: null
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
      }
      
      // Only throw error if no existing subscription to preserve
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
      } else {
        // User has existing subscription but no Stripe customer
        // Check if trial is still valid
        if (existingSubscription.status === 'trial' && existingSubscription.trial_end_date) {
          const trialEnd = new Date(existingSubscription.trial_end_date);
          const now = new Date();
          
          if (trialEnd > now) {
            // Trial is still valid, return trial status
            logStep("Existing trial is still valid, returning trial status");
            return new Response(JSON.stringify({
              success: true,
              status: 'trial',
              planType: existingSubscription.plan_type,
              trialEnd: existingSubscription.trial_end_date,
              currentPeriodEnd: existingSubscription.trial_end_date,
              subscription_end_date: null
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
        
        // Trial has expired or user has no valid subscription, update with proper constraint handling
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .update({
            status: 'trial_expired',
            subscription_end_date: existingSubscription.trial_end_date || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('email', user.email);

        if (upsertError) {
          logStep("Error updating subscription to expired", upsertError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: existingSubscription?.status === 'trial' ? 'trial' : 'trial_expired',
        message: existingSubscription?.status === 'trial' ? 'Trial is active' : 'No Stripe customer found',
        subscription_end_date: existingSubscription?.trial_end_date
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
      logStep("Found active subscription for customer", { subscriptionId: subscription.id });

      // Step 3: Enhanced plan recognition for yearly subscriptions  
      const interval = subscription.items.data[0].price.recurring?.interval;
      const planType = interval === 'year' ? 'yearly'
                    : interval === 'month' ? 'monthly'
                    : 'unknown';
      
      logStep("New customer active subscription - FULL DEBUG", {
        subscriptionId: subscription.id,
        planType,
        interval,
        fullStripeObject: subscription,
        timestampFields: {
          created: subscription.created,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          start_date: subscription.start_date
        }
      });

      // Handle the new active subscription
      const { subscription_start_date, subscription_end_date } = await handleActiveSubscriptionDates(
        supabase, 
        user.id, 
        planType,
        subscription,
        existingSubscription
      );

      // Prepare update data
      const upsertData: any = {
        user_id: user.id,
        email: user.email,
        stripe_customer_id: stripeCustomer.id,
        stripe_subscription_id: subscription.id,
        status: 'active',
        plan_type: planType,
        current_period_end: subscription_end_date,
        current_period_start: subscription_start_date,
        trial_end_date: null,
        attrs: subscription,
        currency: subscription.currency || 'usd',
        subscription_start_date: subscription_start_date,
        subscription_end_date: subscription_end_date,
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
        currentPeriodEnd: subscription_end_date,
        subscription_start_date: subscription_start_date,
        subscription_end_date: subscription_end_date
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No active subscription found");
      
      // Update subscriptions with expired status using email conflict resolution, but set proper end date
      const endDate = existingSubscription?.trial_end_date || new Date().toISOString();
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: stripeCustomer.id,
          status: 'trial_expired',
          plan_type: 'monthly',
          currency: 'usd',
          subscription_end_date: endDate, // Set end date to satisfy constraint
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
        subscription_end_date: endDate
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
