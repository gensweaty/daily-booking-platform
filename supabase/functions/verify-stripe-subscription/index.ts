
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
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY is not set in the environment');
      throw new Error('Stripe key is not configured');
    }
    
    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    let sessionId;
    
    // Parse request body for session ID
    try {
      const requestData = await req.json();
      sessionId = requestData.sessionId;
      logStep('Received direct verification request', { sessionId });
    } catch (err) {
      logStep('Error parsing request JSON', { error: err.message });
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    
    // Retrieve the session
    const sessionData = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'line_items.data.price.product']
    });
    
    logStep(`Session retrieved`, { 
      status: sessionData.status, 
      payment_status: sessionData.payment_status,
      metadata: sessionData.metadata || 'No metadata'
    });
    
    // Check for user ID in metadata
    let userId = sessionData.metadata?.user_id;
    logStep(`User ID from metadata: ${userId || 'NOT FOUND'}`);
    
    if (sessionData.payment_status !== 'paid') {
      logStep(`Payment not completed. Status: ${sessionData.payment_status}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get customer email from the session
    const customerEmail = sessionData.customer_details?.email;
    logStep(`Customer email from session: ${customerEmail || 'No email found'}`);
    
    if (!customerEmail) {
      logStep('No email associated with customer in session');
      return new Response(
        JSON.stringify({ success: false, message: 'No email associated with customer' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get customer ID from the session
    const customerId = sessionData.customer;
    
    if (!customerId) {
      logStep('No customer ID found in session');
      return new Response(
        JSON.stringify({ success: false, message: 'No customer associated with session' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep(`Customer ID from session: ${customerId}`);
    
    // Initialize Supabase client with service role to update subscription info
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // If userId from metadata is not available, try to find the user by their email
    if (!userId) {
      logStep('No userId in metadata, searching by email:', customerEmail);
      
      try {
        // First check auth users by email
        const { data: users, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          logStep('Error looking up users:', authError);
        } else {
          const matchingUser = users.users.find(u => u.email === customerEmail);
          if (matchingUser) {
            userId = matchingUser.id;
            logStep(`Found user by email: ${userId}`);
          }
        }
      } catch (authError) {
        logStep('Error querying auth users:', authError);
      }
      
      if (!userId) {
        logStep('Could not find user ID for email:', customerEmail);
      }
    }
    
    // Get subscription information from the session
    let subscriptionId = null;
    let subscriptionEndDate = null;
    let planType = 'monthly'; // Default to monthly
    
    if (sessionData.subscription) {
      const subscriptionData = typeof sessionData.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(sessionData.subscription)
        : sessionData.subscription;
      
      subscriptionId = subscriptionData.id;
      
      // Calculate end date
      const periodEnd = new Date(subscriptionData.current_period_end * 1000);
      subscriptionEndDate = periodEnd.toISOString();
      
      // Try to determine plan type
      if (subscriptionData.items?.data?.length > 0) {
        const item = subscriptionData.items.data[0];
        if (item.price?.recurring?.interval === 'year') {
          planType = 'yearly';
        }
      }
      
      logStep(`Found subscription details`, { 
        subscriptionId, 
        planType,
        endDate: subscriptionEndDate
      });
    } else {
      // If no subscription found but payment is successful, set default end date
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      subscriptionEndDate = thirtyDaysFromNow.toISOString();
      logStep(`No subscription found, using default end date: ${subscriptionEndDate}`);
    }
    
    // Update or create subscription record in database
    const subscriptionData = {
      user_id: userId,
      email: customerEmail,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      plan_type: planType,
      current_period_end: subscriptionEndDate,
      updated_at: new Date().toISOString()
    };
    
    logStep('Updating subscription with data:', subscriptionData);

    // First, try to update by user_id if available
    let upsertResult = null;
    
    if (userId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();
          
        if (error) {
          logStep('Error upserting subscription by user_id:', error);
        } else {
          logStep('Successfully updated subscription by user_id:', data);
          upsertResult = data;
        }
      } catch (dbError) {
        logStep('Database operation error:', dbError);
      }
    }
    
    // If user_id update failed or wasn't available, try by email
    if (!upsertResult) {
      try {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          })
          .select()
          .single();
          
        if (error) {
          logStep('Error upserting subscription by email:', error);
          
          // Last resort: Try simple insert
          const { data: insertData, error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert(subscriptionData)
            .select()
            .single();
            
          if (insertError) {
            logStep('Error inserting subscription:', insertError);
            throw insertError;
          } else {
            logStep('Successfully inserted new subscription:', insertData);
            upsertResult = insertData;
          }
        } else {
          logStep('Successfully updated subscription by email:', data);
          upsertResult = data;
        }
      } catch (dbError) {
        logStep('Database operation error during email upsert:', dbError);
        throw dbError;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and subscription activated',
        subscription_id: subscriptionId,
        user_id: userId,
        email: customerEmail,
        plan_type: planType
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error verifying subscription:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
