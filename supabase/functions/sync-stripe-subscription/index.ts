
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}`, data ? JSON.stringify(data) : "");
}

// Fixed timestamp conversion function with better error handling
function safeTimestamp(timestamp: number | null | undefined): string | null {
  if (timestamp == null) {
    logStep("Timestamp is null or undefined", { timestamp });
    return null;
  }
  
  // Convert to number if it's a string
  let numTimestamp: number;
  if (typeof timestamp === 'string') {
    numTimestamp = parseInt(timestamp, 10);
  } else {
    numTimestamp = timestamp;
  }
  
  if (typeof numTimestamp !== 'number' || !Number.isFinite(numTimestamp) || numTimestamp <= 0) {
    logStep("Invalid timestamp value", { timestamp, numTimestamp, type: typeof numTimestamp });
    return null;
  }
  
  try {
    // Stripe timestamps are in seconds, convert to milliseconds for JavaScript Date
    const dateInMs = numTimestamp * 1000;
    const date = new Date(dateInMs);
    
    if (isNaN(date.getTime())) {
      logStep("Date creation failed", { timestamp: numTimestamp, dateInMs, date });
      return null;
    }
    
    const isoString = date.toISOString();
    logStep("Timestamp converted successfully", { 
      originalTimestamp: numTimestamp, 
      convertedDate: isoString,
      dateCheck: date.getTime()
    });
    return isoString;
  } catch (error) {
    logStep("Error converting timestamp", { timestamp: numTimestamp, error: error.message });
    return null;
  }
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

    if (existingSubscription) {
      logStep("Found existing subscription", { 
        status: existingSubscription.status,
        planType: existingSubscription.plan_type,
        currentPeriodEnd: existingSubscription.current_period_end,
        trialEndDate: existingSubscription.trial_end_date,
        stripeCustomerId: existingSubscription.stripe_customer_id
      });

      // For trial subscriptions, check if trial is still valid
      if (existingSubscription.status === 'trial' && existingSubscription.trial_end_date) {
        const trialEnd = new Date(existingSubscription.trial_end_date);
        const now = new Date();
        
        if (trialEnd > now) {
          // Trial is still valid, but check if user has paid for a subscription
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
                
                logStep("Raw Stripe subscription data for trial conversion", {
                  subscriptionId: subscription.id,
                  currentPeriodEnd: subscription.current_period_end,
                  currentPeriodStart: subscription.current_period_start,
                  status: subscription.status,
                  rawEndTimestamp: subscription.current_period_end,
                  rawStartTimestamp: subscription.current_period_start
                });
                
                // Fixed timestamp conversion - ensure we get valid dates
                const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
                const currentPeriodStart = safeTimestamp(subscription.current_period_start);
                
                logStep("Converting trial to active subscription", { 
                  subscriptionId: subscription.id,
                  planType,
                  currentPeriodEnd,
                  currentPeriodStart,
                  conversionSuccess: !!(currentPeriodEnd && currentPeriodStart)
                });

                // Only update if we have valid timestamps
                if (currentPeriodEnd && currentPeriodStart) {
                  const { error: updateError } = await supabase
                    .from('subscriptions')
                    .update({
                      status: 'active',
                      plan_type: planType,
                      current_period_end: currentPeriodEnd,
                      current_period_start: currentPeriodStart,
                      subscription_end_date: currentPeriodEnd,
                      stripe_subscription_id: subscription.id,
                      attrs: subscription,
                      currency: subscription.currency || 'usd',
                      trial_end_date: null, // Clear trial date
                      updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id);

                  if (updateError) {
                    logStep("Error updating trial to active", updateError);
                    throw updateError;
                  }

                  logStep("Successfully converted trial to active subscription");

                  return new Response(JSON.stringify({
                    success: true,
                    status: 'active',
                    planType: planType,
                    stripe_subscription_id: subscription.id,
                    currentPeriodEnd: currentPeriodEnd
                  }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                  });
                } else {
                  logStep("Failed to convert timestamps, keeping trial status");
                }
              }
            }
          }
          
          // Still on trial, return trial status
          return new Response(JSON.stringify({
            success: true,
            status: 'trial',
            planType: existingSubscription.plan_type,
            trialEnd: existingSubscription.trial_end_date,
            currentPeriodEnd: existingSubscription.current_period_end
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
            message: 'Trial period has expired'
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // Check Stripe if user has a customer ID (for active subscriptions or force refresh)
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
            
            logStep("Raw Stripe subscription data for existing active subscription", {
              subscriptionId: subscription.id,
              currentPeriodEnd: subscription.current_period_end,
              currentPeriodStart: subscription.current_period_start,
              status: subscription.status,
              rawData: {
                current_period_end: subscription.current_period_end,
                current_period_start: subscription.current_period_start
              }
            });
            
            // Fixed timestamp conversion with detailed logging
            const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
            const currentPeriodStart = safeTimestamp(subscription.current_period_start);
            
            logStep("Processed subscription timestamps for existing active subscription", {
              planType,
              currentPeriodEnd,
              currentPeriodStart,
              rawCurrentPeriodEnd: subscription.current_period_end,
              rawCurrentPeriodStart: subscription.current_period_start,
              timestampConversionSuccess: !!(currentPeriodEnd && currentPeriodStart)
            });

            // Only update if we have valid timestamps
            if (currentPeriodEnd && currentPeriodStart) {
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  plan_type: planType,
                  current_period_end: currentPeriodEnd,
                  current_period_start: currentPeriodStart,
                  subscription_end_date: currentPeriodEnd,
                  stripe_subscription_id: subscription.id,
                  attrs: subscription,
                  currency: subscription.currency || 'usd',
                  trial_end_date: null, // Clear trial date for active subscriptions
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);

              if (updateError) {
                logStep("Error updating subscription", updateError);
                throw updateError;
              }

              logStep("Successfully updated existing subscription with fresh Stripe data");

              return new Response(JSON.stringify({
                success: true,
                status: 'active',
                planType: planType,
                stripe_subscription_id: subscription.id,
                currentPeriodEnd: currentPeriodEnd
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            } else {
              logStep("Failed to convert Stripe timestamps - data sync issue");
              return new Response(JSON.stringify({
                success: false,
                status: 'active',
                error: 'Failed to sync subscription timestamps from Stripe',
                message: 'Subscription is active but dates could not be synced'
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
              });
            }
          }
        }
      }
    }

    // If no existing subscription or no Stripe customer ID, try to find Stripe customer by email
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
            currentPeriodEnd: trialEndDate.toISOString()
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
          .eq('user_id', user.id);

        if (upsertError) {
          logStep("Error updating subscription to expired", upsertError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'No Stripe customer found'
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
      
      logStep("Found active subscription - raw Stripe data", { 
        subscriptionId: subscription.id,
        rawCurrentPeriodEnd: subscription.current_period_end,
        rawCurrentPeriodStart: subscription.current_period_start,
        status: subscription.status,
        fullSubscription: subscription
      });

      const planType = subscription.items.data[0].price.recurring?.interval === "month" ? "monthly" : "yearly";
      const currentPeriodEnd = safeTimestamp(subscription.current_period_end);
      const currentPeriodStart = safeTimestamp(subscription.current_period_start);

      logStep("Processed subscription timestamps for new subscription", {
        planType,
        currentPeriodEnd,
        currentPeriodStart,
        timestampConversionSuccess: !!(currentPeriodEnd && currentPeriodStart)
      });

      // Only proceed if we have valid timestamps
      if (currentPeriodEnd && currentPeriodStart) {
        // Update subscription record using email for conflict resolution
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            email: user.email,
            stripe_customer_id: stripeCustomer.id,
            stripe_subscription_id: subscription.id,
            status: 'active',
            plan_type: planType,
            current_period_end: currentPeriodEnd,
            current_period_start: currentPeriodStart,
            subscription_end_date: currentPeriodEnd,
            trial_end_date: null, // Clear trial date for active subscriptions
            attrs: subscription,
            currency: subscription.currency || 'usd',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (upsertError) {
          logStep("Error upserting subscription", upsertError);
          throw new Error(`Failed to update subscription: ${upsertError.message}`);
        }

        logStep("Successfully updated subscription in database");

        return new Response(JSON.stringify({
          success: true,
          status: 'active',
          planType: planType,
          stripe_subscription_id: subscription.id,
          currentPeriodEnd: currentPeriodEnd
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        logStep("Failed to convert Stripe timestamps for new subscription");
        return new Response(JSON.stringify({
          success: false,
          status: 'active',
          error: 'Failed to sync subscription timestamps from Stripe',
          message: 'Subscription found but dates could not be synced'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
    } else {
      logStep("No active subscription found");
      
      // Update subscriptions with expired status using user_id conflict resolution
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
        }, { onConflict: 'user_id' });

      if (upsertError) {
        logStep("Error upserting expired subscription", upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'trial_expired',
        message: 'Customer found but no active subscription'
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
