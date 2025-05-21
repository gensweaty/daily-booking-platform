
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYPAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    // Get request body
    const { orderID } = await req.json();
    if (!orderID) {
      throw new Error('No PayPal order ID provided');
    }
    logStep('Order ID received', { orderID });

    // Get PayPal credentials from environment variables
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const secretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!clientId || !secretKey) {
      throw new Error('Missing PayPal credentials');
    }
    logStep('PayPal credentials verified');

    // Get access token from PayPal
    const auth = btoa(`${clientId}:${secretKey}`);
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logStep('Error getting PayPal token', { status: tokenResponse.status, error: errorText });
      throw new Error(`Failed to get PayPal access token: ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();
    logStep('Retrieved PayPal access token');

    // Verify the order
    const orderResponse = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      logStep('Error verifying PayPal order', { status: orderResponse.status, error: errorText });
      throw new Error(`Failed to verify PayPal order: ${errorText}`);
    }

    const orderData = await orderResponse.json();
    logStep('Order verification response', { status: orderData.status });

    // Check if the order is completed
    if (orderData.status !== 'COMPLETED') {
      logStep('Order not completed', { status: orderData.status });
      return new Response(JSON.stringify({ success: false, message: `Order status is ${orderData.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get user information from the request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }

    const user = userData.user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    logStep('User authenticated', { userId: user.id, email: user.email });

    // Extract plan type from order data
    // You'll need to customize this based on your PayPal plan IDs or item descriptions
    const purchaseUnits = orderData.purchase_units || [];
    const items = purchaseUnits[0]?.items || [];
    const item = items[0];
    const planType = item?.name?.toLowerCase().includes('yearly') ? 'yearly' : 'monthly';

    // Calculate subscription end date
    const now = new Date();
    const periodEnd = planType === 'yearly'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Update subscription record
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        email: user.email,
        status: 'active',
        plan_type: planType,
        last_payment_id: orderID,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString()
      }, { onConflict: 'user_id' });

    if (upsertError) {
      logStep('Error updating subscription record', { error: upsertError });
      throw new Error(`Error updating subscription: ${upsertError.message}`);
    }

    logStep('Subscription record updated successfully');

    // All done, return success
    return new Response(JSON.stringify({
      success: true,
      message: 'Payment verified',
      subscription: {
        plan_type: planType,
        end_date: periodEnd.toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    logStep('ERROR in verify-paypal-payment', { message: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
