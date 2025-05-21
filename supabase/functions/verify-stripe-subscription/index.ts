
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY is not set in the environment');
      throw new Error('Stripe key is not configured');
    }
    
    console.log('Verifying Stripe subscription with available key:', stripeKey ? 'Yes' : 'No');
    
    // Parse request body for session ID
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Verifying session ID: ${sessionId}`);
    
    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });
    
    // Retrieve the session to check its status
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log(`Session retrieved. Status: ${session.status}, Payment status: ${session.payment_status}`);
    
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get customer ID from the session
    const customerId = session.customer as string;
    
    if (!customerId) {
      console.error('No customer ID found in session');
      return new Response(
        JSON.stringify({ success: false, message: 'No customer associated with session' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Customer ID from session: ${customerId}`);
    
    // Get customer information to extract user email
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer || customer.deleted) {
      console.error('Customer not found or deleted');
      return new Response(
        JSON.stringify({ success: false, message: 'Customer not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const customerEmail = customer.email;
    console.log(`Customer email: ${customerEmail}`);
    
    if (!customerEmail) {
      console.error('No email associated with customer');
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
    
    // Get user by email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();
    
    if (userError) {
      console.error('Error fetching user:', userError);
      // Continue anyway as we might still want to record the subscription
    }
    
    const userId = userData?.id;
    console.log(`User ID from database: ${userId || 'Not found'}`);
    
    // Get subscription information from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    
    let subscriptionId = null;
    let subscriptionEndDate = null;
    
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      subscriptionId = subscription.id;
      subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      console.log(`Active subscription found: ${subscriptionId}, ends: ${subscriptionEndDate}`);
    } else {
      console.log('No active subscription found for customer');
    }
    
    // Update or create subscription record in database
    const { data: subData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email: customerEmail,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        trial_end_date: null,
        subscription_end_date: subscriptionEndDate?.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();
    
    if (subError) {
      console.error('Error updating subscription in database:', subError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment verified but could not update subscription data',
          subscription_id: subscriptionId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Subscription record updated successfully in database');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and subscription activated',
        subscription_id: subscriptionId 
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
