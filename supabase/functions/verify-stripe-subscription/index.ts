
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
    // For GET requests (client-side verification)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("session_id");
      
      if (!sessionId) {
        logStep("No session ID provided");
        return new Response(
          JSON.stringify({ success: false, error: "Session ID is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session || session.status !== "complete") {
        logStep("Session incomplete", { sessionId });
        return new Response(
          JSON.stringify({ success: false, error: "Payment incomplete" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      const userId = session.metadata?.user_id;
      
      if (!userId) {
        logStep("No user ID in session metadata", { sessionId });
        return new Response(
          JSON.stringify({ success: false, error: "User ID not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Check if subscription is already recorded
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, stripe_subscription_id')
        .eq('user_id', userId)
        .single();
      
      if (error || !data || !data.stripe_subscription_id) {
        logStep("Subscription not found in database", { userId });
        return new Response(
          JSON.stringify({ success: false, error: "Subscription not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      logStep("Verification successful", { userId });
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // For POST requests (checking subscription status)
    if (req.method === "POST") {
      const { user_id } = await req.json();
      
      if (!user_id) {
        return new Response(
          JSON.stringify({ success: false, error: "User ID is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      // Check subscription status
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end, current_period_end')
        .eq('user_id', user_id)
        .single();
      
      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "Subscription not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      const now = new Date();
      const trialEnd = data.trial_end ? new Date(data.trial_end) : null;
      const isTrialExpired = trialEnd && now > trialEnd;
      
      // If trial expired but status is still trialing, update status
      if (isTrialExpired && data.status === 'trialing') {
        await supabase
          .from('subscriptions')
          .update({ status: 'trial_expired' })
          .eq('user_id', user_id);
        
        data.status = 'trial_expired';
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: data.status,
          trialEnd: data.trial_end,
          isTrialExpired
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
