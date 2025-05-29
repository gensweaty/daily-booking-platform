
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, data?: any) {
  console.log(`[CREATE-STRIPE-CHECKOUT] ${step}`, data ? JSON.stringify(data) : "");
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

    const requestBody = await req.json();
    logStep("Request body received", requestBody);

    const { user_id, price_id, plan_type, return_url } = requestBody;
    
    if (!user_id || !price_id || !plan_type) {
      logStep("Missing required parameters", { user_id: !!user_id, price_id: !!price_id, plan_type: !!plan_type });
      throw new Error("Missing required parameters");
    }

    // Validate plan_type
    if (!['monthly', 'yearly'].includes(plan_type)) {
      logStep("Invalid plan type", { plan_type });
      throw new Error(`Invalid plan type: ${plan_type}`);
    }

    // Get user data
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !userData.user?.email) {
      logStep("User lookup failed", { error: userError });
      throw new Error("User not found or no email");
    }

    logStep("User found", { userId: user_id, email: userData.user.email, planType: plan_type });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer already exists
    logStep("Checking for existing customer", { email: userData.user.email });
    const existingCustomers = await stripe.customers.list({ 
      email: userData.user.email,
      limit: 1 
    });

    let customerId = existingCustomers.data.length > 0 ? existingCustomers.data[0].id : undefined;
    logStep("Customer lookup result", { customerId: customerId || "none" });

    // Validate the price ID exists in Stripe
    try {
      const priceValidation = await stripe.prices.retrieve(price_id);
      logStep("Price validation successful", { 
        priceId: price_id, 
        currency: priceValidation.currency,
        amount: priceValidation.unit_amount,
        interval: priceValidation.recurring?.interval
      });
    } catch (priceError) {
      logStep("Price validation failed", { priceId: price_id, error: priceError.message });
      throw new Error(`Invalid price ID: ${price_id}`);
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : userData.user.email,
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: return_url,
      metadata: {
        user_id: user_id,
        plan_type: plan_type,
      },
    };

    logStep("Creating checkout session", { 
      customerId: customerId || "new customer",
      priceId: price_id,
      planType: plan_type
    });

    const session = await stripe.checkout.sessions.create(sessionParams);
    
    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      url: session.url 
    });

    // Store checkout session in database
    try {
      await supabase
        .from('checkout_sessions')
        .upsert({
          id: session.id,
          customer: session.customer as string,
          subscription: session.subscription as string,
          attrs: session,
          currency: session.currency,
          user_id: user_id,
        });
      logStep("Checkout session stored in database");
    } catch (dbError) {
      logStep("Database storage failed", { error: dbError });
      // Don't fail the whole request if database storage fails
    }

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-stripe-checkout", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
