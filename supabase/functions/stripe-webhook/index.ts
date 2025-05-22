
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// This function will need to be made public in the config.toml file
// because Stripe webhooks don't send auth tokens

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logStep('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    logStep('Stripe key verified');

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    
    // Get the signature from the header
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('No stripe-signature header provided');
    }
    
    // Get the webhook secret from environment variables
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    
    // Get the raw request body using arrayBuffer to preserve exact bytes
    const rawBody = await req.arrayBuffer();
    const rawBodyText = new TextDecoder().decode(new Uint8Array(rawBody));
    
    logStep('Received webhook payload', { 
      signature_length: signature.length, 
      body_length: rawBodyText.length,
      body_sample: rawBodyText.substring(0, 100) + '...' // Log sample for debugging
    });
    
    // Construct the event
    let event;
    try {
      // Use constructEventAsync with the preserved raw body
      event = await stripe.webhooks.constructEventAsync(
        rawBodyText, 
        signature, 
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
      logStep('Event constructed successfully', { type: event.type });
    } catch (err) {
      logStep('Error verifying webhook signature', { 
        error: err.message,
        rawBodySample: rawBodyText.substring(0, 50) + '...'
      });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // Store the event in the database
    const { data: storedEvent, error: storeError } = await supabaseAdmin
      .from('stripe_webhook_events')
      .insert({
        id: event.id,
        type: event.type,
        object_id: event.data.object.id,
        object_type: event.data.object.object,
        data: event.data.object,
      })
      .select()
      .single();
    
    if (storeError) {
      // If the error is about duplicate events, we can safely ignore
      if (storeError.code === '23505') { // Postgres unique violation code
        logStep('Duplicate event received, ignoring', { event_id: event.id });
        return new Response(JSON.stringify({ received: true, status: 'duplicate' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      logStep('Error storing event', { error: storeError });
      throw new Error(`Error storing webhook event: ${storeError.message}`);
    }
    
    logStep('Event stored successfully', { event_id: storedEvent.id });
    
    // Process different event types
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          logStep('Processing checkout session', { sessionId: session.id });
          await handleCheckoutSessionCompleted(session, supabaseAdmin, stripe);
          break;
        }
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          await handleSubscriptionChange(subscription, supabaseAdmin, stripe);
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await handleSubscriptionCancelled(subscription, supabaseAdmin);
          break;
        }
      }
      
      // Mark the event as processed
      await supabaseAdmin
        .from('stripe_webhook_events')
        .update({ processed: true })
        .eq('id', event.id);
      
      logStep('Event processed successfully', { type: event.type });
      
    } catch (processError) {
      logStep('Error processing event', { error: processError.message });
      
      // Update the event with the error
      await supabaseAdmin
        .from('stripe_webhook_events')
        .update({
          processed: false,
          processing_error: processError.message
        })
        .eq('id', event.id);
        
      // Still return 200 to Stripe so they don't retry, since we've stored the event
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
    logStep('ERROR in stripe-webhook', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Handle checkout.session.completed events
async function handleCheckoutSessionCompleted(
  session: any,
  supabase: any,
  stripe: any
) {
  logStep('Processing checkout.session.completed', { session_id: session.id });
  
  if (session.payment_status !== 'paid') {
    logStep('Session not paid', { status: session.payment_status });
    return;
  }
  
  // Extract user identification from metadata and customer details
  const userId = session.metadata?.user_id;
  const customerEmail = session.customer_details?.email;
  
  if (!customerEmail) {
    logStep('No email found in session');
    throw new Error('No email associated with customer in session');
  }
  
  logStep('Found customer details', { email: customerEmail, userId: userId || 'unknown' });
  
  // Extract subscription information from the session
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  let planType = 'monthly'; // Default to monthly
  let periodEnd = null;
  
  // If we have subscription details, get more info
  if (subscriptionId) {
    const subscriptionData = typeof subscriptionId === 'string' 
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : subscriptionId;
    
    // Calculate end date
    periodEnd = new Date(subscriptionData.current_period_end * 1000).toISOString();
    
    // Try to determine plan type
    if (subscriptionData.items?.data?.length > 0) {
      const item = subscriptionData.items.data[0];
      if (item.price?.recurring?.interval === 'year') {
        planType = 'yearly';
      }
    }
    
    logStep('Extracted subscription details', { 
      subscriptionId: subscriptionData.id, 
      planType,
      periodEnd
    });
  } else {
    // If no subscription found but payment is successful, set default end date
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    periodEnd = thirtyDaysFromNow.toISOString();
    logStep('No subscription found, using default end date', { periodEnd });
  }
  
  let foundUserId = userId;
  
  // If no userId from metadata, try to find the user by their email
  if (!foundUserId && customerEmail) {
    logStep('No userId in metadata, searching by email', { email: customerEmail });
    
    try {
      // First check auth users by email
      const { data: users, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        logStep('Error looking up users:', { error: authError.message });
      } else {
        const matchingUser = users.users.find((u: any) => u.email === customerEmail);
        if (matchingUser) {
          foundUserId = matchingUser.id;
          logStep('Found user by email:', { userId: foundUserId });
        }
      }
    } catch (authError: any) {
      logStep('Error querying auth users:', { error: authError.message });
    }
  }
  
  // Create or update subscription record in database
  const subscriptionData = {
    user_id: foundUserId,
    email: customerEmail,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: 'active',
    plan_type: planType,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString()
  };
  
  logStep('Updating subscription with data:', subscriptionData);

  // First try updating by user_id if available
  if (foundUserId) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert(subscriptionData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (error) {
        logStep('Error upserting subscription by user_id:', { error: error.message });
      } else {
        logStep('Successfully updated subscription by user_id:', data);
        return;
      }
    } catch (dbError: any) {
      logStep('Database operation error:', { error: dbError.message });
    }
  }
  
  // If user_id update failed or wasn't available, try by email
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      })
      .select()
      .single();
      
    if (error) {
      logStep('Error upserting subscription by email:', { error: error.message });
      
      // Last resort: Try simple insert
      const { data: insertData, error: insertError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();
        
      if (insertError) {
        logStep('Error inserting subscription:', { error: insertError.message });
        throw insertError;
      } else {
        logStep('Successfully inserted new subscription:', insertData);
      }
    } else {
      logStep('Successfully updated subscription by email:', data);
    }
  } catch (dbError: any) {
    logStep('Database operation error during email upsert:', { error: dbError.message });
    throw dbError;
  }
}

// Handle subscription created or updated events
async function handleSubscriptionChange(
  subscription: any, 
  supabase: any,
  stripe: any
) {
  logStep('Processing subscription change', { 
    subscription_id: subscription.id, 
    status: subscription.status 
  });
  
  const customerId = subscription.customer;
  
  // Get customer email
  const customer = await stripe.customers.retrieve(customerId);
  const email = customer.email;
  if (!email) {
    throw new Error('No email associated with customer');
  }
  
  // Find user by email
  let userId = null;
  
  try {
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
      throw new Error(`Error listing users: ${userError.message}`);
    }
    
    const user = userData.users.find((u: any) => u.email === email);
    if (user) {
      userId = user.id;
    }
  } catch (error: any) {
    logStep('Error finding user by email:', { error: error.message });
  }
  
  // Calculate next period end
  const periodEnd = new Date(subscription.current_period_end * 1000);
  
  // Determine subscription status
  let status = 'active';
  if (subscription.status !== 'active') {
    status = subscription.status;
  }
  
  // Determine plan type
  let planType = 'monthly';
  if (subscription.items?.data?.length > 0) {
    const item = subscription.items.data[0];
    if (item.plan?.interval === 'year') {
      planType = 'yearly';
    }
  }
  
  // Update subscription record
  const subscriptionData = {
    user_id: userId,
    email: email,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: status,
    plan_type: planType,
    current_period_end: periodEnd.toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    // Try by user_id first if available
    if (userId) {
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert(subscriptionData, { onConflict: 'user_id' });
        
      if (!upsertError) {
        logStep('Subscription updated successfully by user_id', { 
          user_id: userId, 
          email: email,
          status: status
        });
        return;
      }
    }
    
    // If no user_id or error, try by email
    const { error: emailUpsertError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'email' });
      
    if (emailUpsertError) {
      throw emailUpsertError;
    }
    
    logStep('Subscription updated successfully by email', { 
      email: email,
      status: status
    });
  } catch (error: any) {
    logStep('Error updating subscription', { error: error.message });
    throw new Error(`Error updating subscription: ${error.message}`);
  }
}

// Handle subscription cancelled/deleted events
async function handleSubscriptionCancelled(
  subscription: any, 
  supabase: any
) {
  logStep('Processing subscription cancellation', { subscription_id: subscription.id });
  
  // Find subscription by stripe_subscription_id
  const { data: existingSub, error: findError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
    
  if (findError) {
    throw new Error(`Error finding subscription: ${findError.message}`);
  }
  
  if (!existingSub) {
    throw new Error(`No subscription found with ID: ${subscription.id}`);
  }
  
  // Update the subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);
    
  if (updateError) {
    throw new Error(`Error updating subscription: ${updateError.message}`);
  }
  
  logStep('Subscription marked as cancelled', { 
    user_id: existingSub.user_id, 
    subscription_id: subscription.id
  });
}
