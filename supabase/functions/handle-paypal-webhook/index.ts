import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalAccessToken() {
  console.log('Getting PayPal access token...');
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_SECRET_KEY');
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to get PayPal access token:', error);
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  console.log('Successfully obtained PayPal access token');
  return data.access_token;
}

async function verifyPayPalWebhook(accessToken: string, webhookId: string, event: any) {
  console.log('Verifying PayPal webhook signature...');
  const response = await fetch('https://api.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to verify webhook signature:', error);
    throw new Error('Failed to verify webhook signature');
  }

  const verification = await response.json();
  console.log('Webhook verification status:', verification.verification_status);
  return verification.verification_status === 'SUCCESS';
}

async function updateSubscription(supabaseClient: any, userId: string, planType: string, orderId: string) {
  console.log('Updating subscription for user:', userId);
  const currentDate = new Date();
  const nextPeriodEnd = new Date(currentDate);
  
  if (planType === 'monthly') {
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  } else {
    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
  }

  const { error } = await supabaseClient
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: currentDate.toISOString(),
      current_period_end: nextPeriodEnd.toISOString(),
      plan_type: planType,
      last_payment_id: orderId
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log('Successfully updated subscription for user:', userId);
}

serve(async (req) => {
  console.log('Webhook received:', new Date().toISOString());
  
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
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2));

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();
    
    // Verify webhook signature
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new Error('PayPal webhook ID not configured');
    }
    
    const isValid = await verifyPayPalWebhook(accessToken, webhookId, payload);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Extract plan type from URL parameters
    const url = new URL(req.url);
    const planType = url.searchParams.get('plan');
    console.log('Plan type from URL:', planType);

    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      console.error('Invalid or missing plan type:', planType);
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the payer email to identify the user
    const payerEmail = payload.resource?.payer?.email_address || 
                      payload.resource?.sender?.email_address ||
                      payload.resource?.custom_id ||
                      payload.email_address;
                      
    console.log('Attempting to find payer email from payload:', payerEmail);

    if (!payerEmail) {
      console.error('No payer email found in payload');
      return new Response(
        JSON.stringify({ error: 'No payer email found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user by email
    console.log('Looking up user with email:', payerEmail);
    const { data: userData, error: userError } = await supabaseClient
      .from('auth.users')
      .select('id')
      .eq('email', payerEmail)
      .single()

    if (userError || !userData) {
      console.error('Error finding user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user:', userData);

    // Update subscription status
    await updateSubscription(
      supabaseClient, 
      userData.id, 
      planType, 
      payload.resource?.id || payload.id
    );

    console.log('Successfully processed webhook');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})