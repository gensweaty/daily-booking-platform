
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAYPAL-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logStep('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
    
    if (!paypalClientId || !paypalSecretKey || !paypalWebhookId) {
      throw new Error('Missing PayPal credentials');
    }
    logStep('PayPal credentials verified');

    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // Get request payload
    const body = await req.text();
    const paypalSignature = req.headers.get('paypal-transmission-sig') || '';
    const paypalCertUrl = req.headers.get('paypal-cert-url') || '';
    const paypalTransmissionId = req.headers.get('paypal-transmission-id') || '';
    const paypalTransmissionTime = req.headers.get('paypal-transmission-time') || '';
    
    logStep('Received webhook payload', {
      signature_length: paypalSignature.length,
      body_length: body.length
    });
    
    // Parse the webhook data
    const webhookData = JSON.parse(body);
    const eventType = webhookData.event_type;
    
    logStep('Processing webhook event', { eventType });
    
    // Store the event in the database
    const { data: storedEvent, error: storeError } = await supabaseAdmin
      .from('paypal_webhook_events')
      .insert({
        id: webhookData.id,
        type: eventType,
        data: webhookData,
        event_time: webhookData.create_time
      })
      .select()
      .single();
    
    if (storeError) {
      // If the error is about duplicate events, we can safely ignore
      if (storeError.code === '23505') { // Postgres unique violation code
        logStep('Duplicate event received, ignoring', { event_id: webhookData.id });
        return new Response(JSON.stringify({ received: true, status: 'duplicate' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      logStep('Error storing event', { error: storeError });
      throw new Error(`Error storing webhook event: ${storeError.message}`);
    }
    
    logStep('Event stored successfully', { event_id: storedEvent.id });
    
    // Process subscription-related events
    try {
      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.CREATED':
        case 'BILLING.SUBSCRIPTION.ACTIVATED': {
          await handleSubscriptionCreated(webhookData, supabaseAdmin);
          break;
        }
        
        case 'BILLING.SUBSCRIPTION.UPDATED': {
          await handleSubscriptionUpdated(webhookData, supabaseAdmin);
          break;
        }
        
        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED': {
          await handleSubscriptionCancelled(webhookData, supabaseAdmin);
          break;
        }
      }
      
      // Mark the event as processed
      await supabaseAdmin
        .from('paypal_webhook_events')
        .update({ processed: true })
        .eq('id', webhookData.id);
      
      logStep('Event processed successfully', { type: eventType });
      
    } catch (processError) {
      logStep('Error processing event', { error: processError.message });
      
      // Update the event with the error
      await supabaseAdmin
        .from('paypal_webhook_events')
        .update({
          processed: false,
          processing_error: processError.message
        })
        .eq('id', webhookData.id);
        
      // Still return 200 to PayPal so they don't retry, since we've stored the event
      return new Response(JSON.stringify({ received: true, error: processError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logStep('ERROR in paypal-webhook', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleSubscriptionCreated(webhookData: any, supabase: any) {
  logStep('Processing subscription created/activated');
  
  const subscription = webhookData.resource;
  const subscriptionId = subscription.id;
  const customerId = subscription.subscriber?.payer_id;
  const email = subscription.subscriber?.email_address;
  
  if (!email) {
    throw new Error('No email found in subscription data');
  }
  
  logStep('Subscription details', { subscriptionId, customerId, email });
  
  // Find user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    throw new Error(`Error listing users: ${userError.message}`);
  }
  
  const user = userData.users.find(u => u.email === email);
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }
  
  logStep('Found user for subscription', { userId: user.id });
  
  // Calculate period end date
  const now = new Date();
  let periodEnd;
  
  // Determine if monthly or yearly subscription from billing plan
  // This is simplified - you'll need to adjust based on actual PayPal plan IDs
  const planId = subscription.plan_id;
  const isMonthly = planId.includes('MONTH') || planId === 'SZHF9WLR5RQWU';
  const isYearly = planId.includes('YEAR') || planId === 'YDK5G6VR2EA8L';
  
  if (isMonthly) {
    periodEnd = new Date(now.setMonth(now.getMonth() + 1));
  } else if (isYearly) {
    periodEnd = new Date(now.setFullYear(now.getFullYear() + 1));
  } else {
    // Default to monthly if we can't determine
    periodEnd = new Date(now.setMonth(now.getMonth() + 1));
  }
  
  // Update subscription record
  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: user.id,
      email: email,
      status: 'active',
      stripe_customer_id: null, // Not applicable for PayPal
      last_payment_id: subscriptionId,
      plan_type: isMonthly ? 'monthly' : (isYearly ? 'yearly' : 'monthly'),
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    
  if (upsertError) {
    throw new Error(`Error updating subscription: ${upsertError.message}`);
  }
  
  logStep('Subscription record updated', { user_id: user.id, email: email });
}

async function handleSubscriptionUpdated(webhookData: any, supabase: any) {
  logStep('Processing subscription updated');
  
  const subscription = webhookData.resource;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const email = subscription.subscriber?.email_address;
  
  if (!email) {
    throw new Error('No email found in subscription data');
  }
  
  // Find user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    throw new Error(`Error listing users: ${userError.message}`);
  }
  
  const user = userData.users.find(u => u.email === email);
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }
  
  // Map PayPal status to our status
  let subscriptionStatus = 'active';
  if (status === 'ACTIVE') {
    subscriptionStatus = 'active';
  } else if (status === 'SUSPENDED' || status === 'CANCELLED') {
    subscriptionStatus = 'cancelled';
  } else if (status === 'EXPIRED') {
    subscriptionStatus = 'expired';
  }
  
  // Update subscription record
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: subscriptionStatus,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);
    
  if (updateError) {
    throw new Error(`Error updating subscription: ${updateError.message}`);
  }
  
  logStep('Subscription status updated', { 
    user_id: user.id, 
    email: email, 
    status: subscriptionStatus 
  });
}

async function handleSubscriptionCancelled(webhookData: any, supabase: any) {
  logStep('Processing subscription cancellation/expiration');
  
  const subscription = webhookData.resource;
  const subscriptionId = subscription.id;
  const email = subscription.subscriber?.email_address;
  
  if (!email) {
    throw new Error('No email found in subscription data');
  }
  
  // Find user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    throw new Error(`Error listing users: ${userError.message}`);
  }
  
  const user = userData.users.find(u => u.email === email);
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }
  
  // Update subscription record
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);
    
  if (updateError) {
    throw new Error(`Error updating subscription: ${updateError.message}`);
  }
  
  logStep('Subscription marked as cancelled', { 
    user_id: user.id, 
    email: email
  });
}
