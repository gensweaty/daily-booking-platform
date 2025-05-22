
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2023-10-16", // Using a valid Stripe API version
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
  console.log(`[CREATE-CHECKOUT] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    const { user_id, price_id, product_id, plan_type, return_url } = await req.json();
    
    logStep("Request received", { user_id, price_id, product_id, plan_type });
    
    if (!user_id) {
      throw new Error("User ID is required");
    }
    
    if (!price_id) {
      throw new Error("Price ID is required");
    }
    
    // Get user details
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    
    if (userError || !userData.user) {
      logStep("User not found", { error: userError });
      throw new Error("User not found");
    }
    
    const user = userData.user;
    logStep("User found", { email: user.email });
    
    // Get or create Stripe customer
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .single();
    
    let customerId = subscriptionData?.stripe_customer_id;
    
    // Create new customer if one doesn't exist
    if (!customerId) {
      logStep("Creating new Stripe customer");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user_id,
        },
      });
      customerId = customer.id;
      
      // Save customer ID to database
      await supabase
        .from('subscriptions')
        .upsert({ 
          user_id: user_id,
          stripe_customer_id: customerId,
          email: user.email,
          status: 'trial_expired',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      logStep("Customer created", { customerId });
    } else {
      logStep("Using existing customer", { customerId });
    }
    
    // Create checkout session
    const baseUrl = return_url || req.headers.get("origin") || "https://smartbookly.com";
    
    let finalPriceId = price_id;
    // First, verify if the price exists
    try {
      logStep("Verifying price exists", { priceId: price_id });
      await stripe.prices.retrieve(price_id);
      logStep("Price verified successfully");
    } catch (priceError) {
      logStep("Price verification failed", { 
        error: priceError instanceof Error ? priceError.message : String(priceError),
        priceId: price_id 
      });
      
      // List available prices for the product
      try {
        logStep("Searching for available prices", { productId: product_id });
        const availablePrices = await stripe.prices.list({ 
          active: true,
          limit: 10
        });
        
        if (availablePrices.data.length > 0) {
          logStep("Available active prices", { 
            count: availablePrices.data.length,
            prices: availablePrices.data.map(p => ({ 
              id: p.id, 
              productId: p.product,
              amount: p.unit_amount, 
              currency: p.currency,
              recurring: p.recurring
            }))
          });
          
          // Try to find a price for the specified product
          const matchingPrice = availablePrices.data.find(p => 
            typeof p.product === 'string' && p.product === product_id
          );
          
          if (matchingPrice) {
            finalPriceId = matchingPrice.id;
            logStep("Found matching price for product", { 
              productId: product_id,
              priceId: finalPriceId 
            });
          } else {
            // Use any valid price if we can't find one for this product
            finalPriceId = availablePrices.data[0].id;
            logStep("Using first available price", { fallbackPriceId: finalPriceId });
          }
        } else {
          throw new Error("No active prices found in your Stripe account");
        }
      } catch (listError) {
        logStep("Failed to get alternative prices", { error: listError instanceof Error ? listError.message : String(listError) });
        throw new Error(`Price ${price_id} does not exist and no alternatives found`);
      }
    }
    
    // Create session with the specified product/price
    logStep("Creating checkout session", { 
      customerId,
      priceId: finalPriceId,
      baseUrl
    });
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
      metadata: {
        user_id: user_id,
        plan_type: plan_type,
      },
    });
    
    logStep("Checkout session created", { sessionId: session.id, url: session.url });
    
    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = {
      message: errorMessage,
      name: error instanceof Error ? error.name : "Unknown",
      type: error instanceof Stripe.errors.StripeError ? error.type : "Unknown"
    };
    
    logStep("Error", errorDetails);
    return new Response(JSON.stringify({ error: errorMessage, details: errorDetails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
