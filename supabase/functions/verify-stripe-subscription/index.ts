
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2025-04-30",
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
    const body = await req.json();
    logStep("Request body", body);
    
    // For GET requests (client-side verification)
    if (req.method === "GET") {
      // Get session_id from request body
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
      
      const userId = session.metadata?.user_id;
      const planType = session.metadata?.plan_type || 'monthly';
      
      if (!userId) {
        logStep("No user ID in session metadata", { sessionId });
        return new Response(
          JSON.stringify({ success: false, error: "User ID not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      logStep("Session payment completed", { userId, planType });
      
      // Get subscription from Stripe
      const subscriptionId = session.subscription as string;
      let subscription;
      
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
        logStep("Subscription retrieved", { subscriptionId, status: subscription.status });
      } else {
        logStep("No subscription ID in session", { sessionId });
      }
      
      // Calculate subscription period
      const now = new Date();
      let currentPeriodEnd;
      
      if (subscription) {
        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      } else {
        // If no subscription (one-time payment), calculate based on plan type
        currentPeriodEnd = planType === 'monthly' 
          ? new Date(now.setDate(now.getDate() + 30))  // 30 days
          : new Date(now.setDate(now.getDate() + 365));  // 365 days
      }
      
      // Update subscription in database
      const { data: userData, error: userError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
          stripe_subscription_id: subscriptionId || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select('*')
        .single();
      
      if (userError) {
        logStep("Error updating subscription in DB", { error: userError });
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update subscription status" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      logStep("Subscription updated successfully", { userId, status: 'active', expiresAt: currentPeriodEnd });
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // For POST requests (checking subscription status)
    if (req.method === "POST") {
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
      
      // Check for test user
      if (userData.user && userData.user.email === testEmail) {
        logStep("Test user detected, forcing trial expired status");
        
        // Update subscription to expired for test user
        await supabase
          .from('subscriptions')
          .update({ 
            status: 'trial_expired',
            trial_end_date: new Date(Date.now() - 86400000).toISOString() // Yesterday
          })
          .eq('user_id', user_id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'trial_expired',
            daysRemaining: 0,
            trialEnd: new Date(Date.now() - 86400000).toISOString(),
            isTrialExpired: true,
            isSubscriptionExpired: false
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
    logStep(`Error: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
