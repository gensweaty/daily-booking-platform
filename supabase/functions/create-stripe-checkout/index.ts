

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
    logStep("🔥 YEARLY DEBUG: Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("❌ YEARLY DEBUG: No authorization header provided");
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    logStep("🔥 YEARLY DEBUG: Request body received", requestBody);

    // Step 1: Accept and validate required parameters
    const { user_id, price_id, plan_type, return_url } = requestBody;
    
    if (!user_id || !price_id || !plan_type) {
      logStep("❌ YEARLY DEBUG: Missing required parameters", { user_id: !!user_id, price_id: !!price_id, plan_type: !!plan_type });
      return new Response(JSON.stringify({ error: 'Missing required parameters: user_id, price_id, or plan_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Enhanced logging for debugging
    logStep('🔥 YEARLY DEBUG: Received plan_type', { plan_type });
    logStep('🔥 YEARLY DEBUG: Using price_id', { price_id });

    // Validate plan_type
    if (!['monthly', 'yearly'].includes(plan_type)) {
      logStep("❌ YEARLY DEBUG: Invalid plan type", { plan_type });
      return new Response(JSON.stringify({ error: `Invalid plan type: ${plan_type}. Must be 'monthly' or 'yearly'` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !userData.user?.email) {
      logStep("❌ YEARLY DEBUG: User lookup failed", { error: userError });
      return new Response(JSON.stringify({ error: 'User not found or no email associated' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logStep("✅ YEARLY DEBUG: User found", { userId: user_id, email: userData.user.email, planType: plan_type });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer already exists
    logStep("🔥 YEARLY DEBUG: Checking for existing customer", { email: userData.user.email });
    const existingCustomers = await stripe.customers.list({ 
      email: userData.user.email,
      limit: 1 
    });

    let customerId = existingCustomers.data.length > 0 ? existingCustomers.data[0].id : undefined;
    logStep("🔥 YEARLY DEBUG: Customer lookup result", { customerId: customerId || "none" });

    // CRITICAL: Validate the price ID exists in Stripe and check if it's a recurring price
    try {
      logStep("🔥 YEARLY DEBUG: Validating price ID in Stripe", { price_id });
      const priceValidation = await stripe.prices.retrieve(price_id);
      logStep("✅ YEARLY DEBUG: Price validation successful", { 
        priceId: price_id, 
        currency: priceValidation.currency,
        amount: priceValidation.unit_amount,
        interval: priceValidation.recurring?.interval,
        type: priceValidation.type,
        active: priceValidation.active,
        product: priceValidation.product
      });

      // Check if price is active
      if (!priceValidation.active) {
        logStep("❌ YEARLY DEBUG: Price is not active", { priceId: price_id, active: priceValidation.active });
        return new Response(JSON.stringify({ 
          error: `Price ${price_id} is not active in Stripe. Please contact support.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For subscription mode, ensure the price is recurring
      if (priceValidation.type !== 'recurring' || !priceValidation.recurring) {
        logStep("❌ YEARLY DEBUG: Price is not recurring", { priceId: price_id, type: priceValidation.type });
        return new Response(JSON.stringify({ 
          error: `Price ${price_id} is configured as a one-time payment, not a subscription. Please use a recurring price for ${plan_type} subscriptions.`,
          details: {
            priceType: priceValidation.type,
            planType: plan_type,
            solution: `Create a new ${plan_type} recurring price in your Stripe dashboard`
          }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (priceError) {
      logStep("❌ YEARLY DEBUG: Price validation failed", { priceId: price_id, error: priceError.message });
      return new Response(JSON.stringify({ 
        error: `Invalid price ID: ${price_id}`,
        details: priceError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create checkout session with conditional customer/customer_email
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: return_url,
      metadata: {
        user_id: user_id,
        plan_type: plan_type,
      },
      // Use either customer OR customer_email, never both
      ...(customerId
        ? { customer: customerId }
        : { customer_email: userData.user.email }
      ),
    };

    logStep("🔥 YEARLY DEBUG: Creating checkout session", { 
      customerId: customerId || "new customer",
      priceId: price_id,
      planType: plan_type,
      mode: "subscription"
    });

    logStep("🧾 YEARLY DEBUG: Final sessionParams", sessionParams);

    const session = await stripe.checkout.sessions.create(sessionParams);
    
    logStep("✅ YEARLY DEBUG: Checkout session created successfully", { 
      sessionId: session.id, 
      url: session.url,
      priceUsed: price_id,
      planType: plan_type
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
      logStep("✅ YEARLY DEBUG: Checkout session stored in database");
    } catch (dbError) {
      logStep("⚠️ YEARLY DEBUG: Database storage failed", { error: dbError });
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
    logStep("❌ YEARLY DEBUG: ERROR in create-stripe-checkout", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

