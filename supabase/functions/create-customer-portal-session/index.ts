
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for browser access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function for logging
function logStep(step: string, data?: any) {
  console.log(`[CUSTOMER-PORTAL] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    const { user_id, return_url } = await req.json();
    
    if (!user_id) {
      throw new Error("User ID is required");
    }
    
    logStep("Request received", { user_id });
    
    // Get subscription data
    const { data: subscriptionData, error } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .single();
    
    if (error || !subscriptionData?.stripe_customer_id) {
      logStep("No customer ID found", { error });
      throw new Error("No active subscription found");
    }
    
    const customerId = subscriptionData.stripe_customer_id;
    logStep("Customer ID found", { customerId });
    
    // Create portal session
    const baseUrl = return_url || req.headers.get("origin") || "https://smartbookly.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: baseUrl,
    });
    
    logStep("Portal session created", { url: session.url });
    
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
