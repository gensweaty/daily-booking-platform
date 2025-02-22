
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text();
    console.log('Raw webhook payload:', rawBody);
    
    // Verify webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    const transmissionId = req.headers.get('paypal-transmission-id');
    const timestamp = req.headers.get('paypal-transmission-time');
    const webhookSignature = req.headers.get('paypal-transmission-sig');
    const certUrl = req.headers.get('paypal-cert-url');

    console.log('Webhook verification details:', {
      webhookId,
      transmissionId,
      timestamp,
      webhookSignature,
      certUrl
    });

    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PayPal access token
    const authResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`),
      },
      body: "grant_type=client_credentials",
    });

    const authData = await authResponse.json();
    if (!authData.access_token) {
      console.error('PayPal auth error:', authData);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with PayPal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different webhook events
    const eventType = payload.event_type;
    const resourceId = payload.resource.id;
    
    console.log('Processing webhook event:', eventType);

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const userEmail = payload.resource.payer.email_address;
        const amount = parseFloat(payload.resource.amount.value);

        // Get user by email
        const { data: userData, error: userError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', userEmail)
          .single();

        if (userError || !userData) {
          console.error('Error finding user:', userError);
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Determine subscription type based on amount
        const subscriptionType = amount >= 100 ? 'yearly' : 'monthly';

        // Activate subscription
        const { error: subscriptionError } = await supabaseAdmin.rpc(
          'activate_subscription',
          { 
            p_user_id: userData.id,
            p_subscription_type: subscriptionType
          }
        );

        if (subscriptionError) {
          console.error('Error activating subscription:', subscriptionError);
          return new Response(
            JSON.stringify({ error: 'Failed to activate subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
