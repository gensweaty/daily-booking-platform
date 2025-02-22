
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('PayPal webhook received:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rawBody = await req.text();
    console.log('Raw webhook payload:', rawBody);
    
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

    // Verify webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    const paypalHeaders = {
      'PAYPAL-AUTH-ALGO': req.headers.get('PAYPAL-AUTH-ALGO'),
      'PAYPAL-CERT-URL': req.headers.get('PAYPAL-CERT-URL'),
      'PAYPAL-TRANSMISSION-ID': req.headers.get('PAYPAL-TRANSMISSION-ID'),
      'PAYPAL-TRANSMISSION-SIG': req.headers.get('PAYPAL-TRANSMISSION-SIG'),
      'PAYPAL-TRANSMISSION-TIME': req.headers.get('PAYPAL-TRANSMISSION-TIME'),
    };

    console.log('PayPal headers:', paypalHeaders);
    console.log('Webhook ID:', webhookId);

    // Extract plan type from payment description or custom field
    const paymentDetails = payload.resource;
    console.log('Payment details:', paymentDetails);

    // Get the payer's email
    const payerEmail = paymentDetails?.payer?.email_address;
    if (!payerEmail) {
      console.error('No payer email found in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing payer email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('auth.users')
      .select('id')
      .eq('email', payerEmail)
      .single();

    if (userError || !userData) {
      console.error('Error finding user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine subscription type from payment amount
    // Assuming monthly is less expensive than yearly
    const amount = parseFloat(paymentDetails?.amount?.value || '0');
    const planType = amount <= 10 ? 'monthly' : 'yearly';

    console.log('Activating subscription:', {
      userId: userData.id,
      planType,
      amount
    });

    // Call the activate_subscription function
    const { data: subscriptionData, error: subscriptionError } = await supabaseClient.rpc(
      'activate_subscription',
      {
        p_user_id: userData.id,
        p_subscription_type: planType
      }
    );

    if (subscriptionError) {
      console.error('Error activating subscription:', subscriptionError);
      return new Response(
        JSON.stringify({ error: 'Failed to activate subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Subscription activated successfully:', subscriptionData);

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
})
