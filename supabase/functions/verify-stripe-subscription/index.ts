
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
    // Get the Stripe key - make sure to log the status for debugging
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    console.log('Stripe key available for verification:', !!stripeKey);
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY is not set in the environment');
      throw new Error('Stripe key is not configured');
    }
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Verifying session ID: ${sessionId}`);
    
    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );
    
    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });
    
    // Retrieve checkout session
    console.log('Retrieving checkout session from Stripe...');
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    
    if (!session) {
      console.error('Session not found');
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Session status:', session.status);
    console.log('Payment status:', session.payment_status);
    
    const { user_id } = session.metadata || {};
    
    if (!user_id) {
      console.error('Invalid session metadata: missing user_id');
      return new Response(
        JSON.stringify({ error: 'Invalid session metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Session was successful, update subscription in database
    if (session.status === 'complete' && session.payment_status === 'paid') {
      const subscriptionId = session.subscription as string;
      console.log(`Fetching subscription details for: ${subscriptionId}`);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        console.error('Subscription not found');
        return new Response(
          JSON.stringify({ error: 'Subscription not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      console.log(`Subscription period ends: ${currentPeriodEnd}`);
      
      // Get subscription plan ID for the default plan
      const { data: planData } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('type', 'monthly')
        .single();
        
      if (!planData) {
        console.error('Plan not found in database');
        return new Response(
          JSON.stringify({ error: 'Plan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Update subscription in database
      console.log(`Updating subscription in database for user: ${user_id}`);
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: currentPeriodEnd,
          plan_type: 'monthly',
          last_payment_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id);
      
      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Subscription successfully updated');
      return new Response(
        JSON.stringify({ success: true, subscription: { status: 'active', plan_type: 'monthly', subscription_end: currentPeriodEnd } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, status: session.status, payment_status: session.payment_status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
