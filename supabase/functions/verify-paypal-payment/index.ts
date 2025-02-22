
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Payment verification request received');

    // Verify authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { user_id, plan_type, order_id } = await req.json();
    console.log('Request payload:', { user_id, plan_type, order_id });

    if (!user_id || !plan_type || !order_id) {
      console.error('Missing required fields:', { user_id, plan_type, order_id });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PayPal access token
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': 'Basic ' + btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();
    console.log('PayPal token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Failed to get PayPal access token:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with PayPal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order with PayPal
    const orderResponse = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${order_id}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const orderData = await orderResponse.json();
    console.log('PayPal order verification response:', {
      status: orderResponse.status,
      order: orderData
    });

    if (!orderResponse.ok || orderData.status !== 'COMPLETED') {
      console.error('Invalid PayPal order:', orderData);
      return new Response(
        JSON.stringify({ error: 'Invalid PayPal order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the activate_subscription function
    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin.rpc(
      'activate_subscription',
      {
        p_user_id: user_id,
        p_subscription_type: plan_type
      }
    );

    if (subscriptionError) {
      console.error('Failed to activate subscription:', subscriptionError);
      return new Response(
        JSON.stringify({ error: 'Failed to activate subscription', details: subscriptionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Subscription activated successfully:', subscriptionData);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payment verified and subscription activated',
        data: subscriptionData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
