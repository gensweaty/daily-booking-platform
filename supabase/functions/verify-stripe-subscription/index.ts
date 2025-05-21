
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
      console.error('No session ID provided');
      return new Response(
        JSON.stringify({ error: 'Session ID is required', success: false }),
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
      console.error(`Payment not completed. Status: ${session.payment_status}`);
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
    
    // Try to find the user by their email
    let userId = null;
    
    // First check in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      filter: {
        email: customerEmail as string,
      },
    });
    
    if (authError) {
      console.error('Error looking up user by email:', authError);
    } else if (authData && authData.users.length > 0) {
      userId = authData.users[0].id;
      console.log(`Found user by email in auth.users: ${userId}`);
    }
    
    if (!userId) {
      console.error('Could not find user ID for email:', customerEmail);
      // Even though we couldn't find the user, let's continue with the subscription info update
      // This will at least create the subscription record that can be associated with the user later
    }
    
    // Get subscription information from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });
    
    let subscriptionId = null;
    let subscriptionEndDate = null;
    let isActive = false;
    
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      subscriptionId = subscription.id;
      subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      isActive = subscription.status === 'active';
      console.log(`Found subscription: ${subscriptionId}, status: ${subscription.status}, ends: ${subscriptionEndDate}`);
    } else {
      // If no subscription found but payment is successful, we might have a one-time payment
      // For one-time payments, we'll set an arbitrary subscription end date (e.g., 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      subscriptionEndDate = thirtyDaysFromNow;
      isActive = true; // Consider it active
      console.log(`No subscription found, but payment successful. Setting artificial end date: ${subscriptionEndDate}`);
    }
    
    // Update or create subscription record in database
    const subscriptionData = {
      user_id: userId,
      email: customerEmail,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active', // Always set to active when payment is successful
      trial_end_date: null,
      plan_type: 'monthly', // Assuming monthly plan by default
      subscription_end_date: subscriptionEndDate?.toISOString(),
      current_period_end: subscriptionEndDate?.toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('Updating subscription with data:', subscriptionData);
    
    try {
      if (userId) {
        // If we have a user ID, try to find existing subscription
        const { data: existingSub, error: existingSubError } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (existingSubError) {
          console.error('Error checking existing subscription:', existingSubError);
        }
        
        if (existingSub?.id) {
          // Update existing subscription
          const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existingSub.id);
            
          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log('Successfully updated subscription for user:', userId);
          }
        } else {
          // Insert new subscription
          const { error: insertError } = await supabaseAdmin
            .from('subscriptions')
            .insert([subscriptionData]);
            
          if (insertError) {
            console.error('Error inserting subscription:', insertError);
          } else {
            console.log('Successfully created subscription for user:', userId);
          }
        }
      } else if (customerEmail) {
        // If we don't have user ID but have email, upsert by email
        const { error: upsertError } = await supabaseAdmin
          .from('subscriptions')
          .upsert([subscriptionData], { 
            onConflict: 'email',
            ignoreDuplicates: false 
          });
          
        if (upsertError) {
          console.error('Error upserting subscription by email:', upsertError);
        } else {
          console.log('Successfully upserted subscription by email:', customerEmail);
        }
      }
    } catch (dbError) {
      console.error('Database operation error:', dbError);
    }
    
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
