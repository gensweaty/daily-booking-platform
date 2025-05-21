
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || 'whsec_Otf1IP0z86ivQ4y1nXOsENWQCZEQOtUz';
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY is not set in the environment');
      throw new Error('Stripe key is not configured');
    }
    
    logStep('Function triggered with available keys', { 
      stripeKeyAvailable: !!stripeKey, 
      webhookSecretAvailable: !!stripeWebhookSecret 
    });
    
    // Determine if this is a webhook call or direct verification call
    const signature = req.headers.get('stripe-signature');
    const isWebhook = !!signature;
    
    logStep('Request type', { isWebhook, method: req.method });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    let sessionId;
    let event;
    
    // Handle different request types
    if (isWebhook) {
      // This is a webhook call from Stripe
      logStep('Processing Stripe webhook event');
      
      const body = await req.text();
      
      try {
        // CRITICAL FIX: Use constructEventAsync instead of constructEvent
        event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
        logStep('Webhook event constructed successfully', { type: event.type });
        
        // Extract sessionId based on event type
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
          sessionId = event.data.object.id;
          logStep('Extracted session ID from webhook event', { sessionId });
        } else {
          logStep('Unsupported event type', { type: event.type });
          return new Response(
            JSON.stringify({ success: false, message: `Unsupported event type: ${event.type}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        logStep('Error verifying webhook signature', { error: err.message });
        return new Response(
          JSON.stringify({ success: false, error: `Webhook signature verification failed: ${err.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // This is a direct API call, parse request body for session ID
      try {
        const requestData = await req.json();
        sessionId = requestData.sessionId;
        logStep('Received direct verification request', { sessionId });
      } catch (err) {
        logStep('Error parsing request JSON', { error: err.message });
      }
    }
    
    // Check if we have a valid sessionId
    if (!sessionId) {
      logStep('No session ID provided');
      return new Response(
        JSON.stringify({ error: 'Session ID is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep(`Processing session ID: ${sessionId}`);
    
    // Retrieve the session to check its status
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'line_items.data.price.product']
    });
    
    logStep(`Session retrieved`, { 
      status: session.status, 
      payment_status: session.payment_status,
      metadata: session.metadata || 'No metadata'
    });
    
    // Check for user ID in metadata
    let userId = session.metadata?.userId;
    logStep(`User ID from metadata: ${userId || 'NOT FOUND'}`);
    
    if (session.payment_status !== 'paid') {
      logStep(`Payment not completed. Status: ${session.payment_status}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get customer ID from the session
    const customerId = session.customer as string;
    
    if (!customerId) {
      logStep('No customer ID found in session');
      return new Response(
        JSON.stringify({ success: false, message: 'No customer associated with session' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep(`Customer ID from session: ${customerId}`);
    
    // Get customer information to extract user email
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer || customer.deleted) {
      logStep('Customer not found or deleted');
      return new Response(
        JSON.stringify({ success: false, message: 'Customer not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const customerEmail = customer.email;
    logStep(`Customer email: ${customerEmail || 'No email found'}`);
    
    if (!customerEmail) {
      logStep('No email associated with customer');
      return new Response(
        JSON.stringify({ success: false, message: 'No email associated with customer' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client with service role to update subscription info
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // If userId from metadata is not available, try to find the user by their email
    if (!userId) {
      logStep('No userId in metadata, searching by email:', customerEmail);
      
      // First check in auth.users
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
          filter: {
            email: customerEmail as string,
          },
        });
        
        if (authError) {
          logStep('Error looking up user by email:', authError);
        } else if (authData && authData.users.length > 0) {
          userId = authData.users[0].id;
          logStep(`Found user by email in auth.users: ${userId}`);
        }
      } catch (authError) {
        logStep('Error querying auth.users:', authError);
      }
      
      if (!userId) {
        logStep('Could not find user ID for email:', customerEmail);
        // Still continue to create a subscription record by email that can be associated later
      }
    }
    
    // Get subscription information from Stripe
    let subscriptionId = null;
    let subscriptionEndDate = null;
    let planType = 'monthly'; // Default to monthly
    let isActive = false;
    
    if (session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
      
      subscriptionId = subscription.id;
      subscriptionEndDate = new Date(subscription.current_period_end * 1000).toISOString();
      isActive = subscription.status === 'active';
      
      // Try to determine plan type from subscription
      const items = subscription.items?.data;
      if (items && items.length > 0 && items[0].price) {
        if (items[0].price.recurring?.interval === 'year') {
          planType = 'yearly';
        }
      }
      
      logStep(`Found subscription: ${subscriptionId}, status: ${subscription.status}, type: ${planType}, ends: ${subscriptionEndDate}`);
    } else {
      // If no subscription found but payment is successful, we'll set an arbitrary subscription end date
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      subscriptionEndDate = thirtyDaysFromNow.toISOString();
      isActive = true; // Consider it active
      logStep(`No subscription found, but payment successful. Setting artificial end date: ${subscriptionEndDate}`);
    }
    
    // Update or create subscription record in database
    const subscriptionData = {
      user_id: userId,
      email: customerEmail,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active', // Always set to active when payment is successful
      trial_end_date: null, // End any trial
      plan_type: planType,
      subscription_end_date: subscriptionEndDate,
      current_period_end: subscriptionEndDate,
      updated_at: new Date().toISOString(),
    };
    
    logStep('Updating subscription with data:', subscriptionData);

    let upsertedSub = null;
    
    // First attempt: Try upserting by user_id if available
    if (userId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          })
          .select('*')
          .maybeSingle();
          
        if (error) {
          logStep('Error upserting subscription by user_id:', error);
          // Continue to try by email if this fails
        } else {
          logStep('Successfully upserted subscription by user_id. Result:', data);
          upsertedSub = data;
        }
      } catch (dbError) {
        logStep('Database operation error upserting by user_id:', dbError);
        // Continue to try by email
      }
    }
    
    // Second attempt: Try by email if user_id attempt failed or wasn't available
    if (!upsertedSub && customerEmail) {
      try {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          })
          .select('*')
          .maybeSingle();
          
        if (error) {
          logStep('Error upserting subscription by email:', error);
          
          // Last resort: Try insert only as final attempt
          const { data: insertData, error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert([subscriptionData])
            .select('*')
            .maybeSingle();
            
          if (insertError) {
            logStep('Error inserting subscription as last resort:', insertError);
            throw insertError;
          } else {
            logStep('Successfully inserted subscription as last resort. Result:', insertData);
            upsertedSub = insertData;
          }
        } else {
          logStep('Successfully upserted subscription by email. Result:', data);
          upsertedSub = data;
        }
      } catch (dbError) {
        logStep('Database operation error during email upsert/insert:', dbError);
        throw dbError;
      }
    }
    
    // If we still don't have a successful DB operation, report failure
    if (!upsertedSub) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update subscription in database',
          message: 'Database operation failed despite multiple attempts' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For webhook calls, we'll update the session metadata with userId if not present
    if (isWebhook && !session.metadata?.userId && userId) {
      try {
        await stripe.checkout.sessions.update(sessionId, {
          metadata: { ...session.metadata, userId },
        });
        logStep('Updated session metadata with userId', { sessionId, userId });
      } catch (updateErr) {
        logStep('Error updating session metadata', { error: updateErr.message });
        // Non-critical error, continue
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and subscription activated',
        subscription_id: subscriptionId,
        user_id: userId,
        email: customerEmail,
        plan_type: planType,
        subscription_end: subscriptionEndDate
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error verifying subscription:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
