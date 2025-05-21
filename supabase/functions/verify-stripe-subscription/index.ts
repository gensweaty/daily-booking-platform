
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
    
    // Get user by email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', customerEmail)
      .maybeSingle();
    
    // Try to get the user from auth.users if not found in profiles
    let userId = userData?.id;
    
    if (!userId) {
      console.log('User not found in profiles, checking auth users...');
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authUserError) {
        console.error('Error listing users:', authUserError);
      } else {
        const matchingUser = authUserData.users.find(u => u.email === customerEmail);
        if (matchingUser) {
          userId = matchingUser.id;
          console.log(`Found user in auth.users: ${userId}`);
        }
      }
    }
    
    if (!userId) {
      console.log('Trying to find user by email in profiles...');
      const { data: emailProfileData } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle();
        
      if (emailProfileData?.id) {
        userId = emailProfileData.id;
        console.log(`Found user by email in profiles: ${userId}`);
      }
    }
    
    if (!userId) {
      console.error('Could not find user ID for email:', customerEmail);
      // Even if we can't find the user, let's still try to update by email
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
    
    // Check if a subscription already exists
    const { data: existingSubscription, error: subFetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('email', customerEmail)
      .maybeSingle();
    
    if (subFetchError) {
      console.error('Error fetching existing subscription:', subFetchError);
    }
    
    console.log('Existing subscription:', existingSubscription);
    
    // Update or create subscription record in database
    const subscriptionData = {
      user_id: userId,
      email: customerEmail,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: isActive ? 'active' : 'expired',
      trial_end_date: null,
      plan_type: 'monthly', // Assuming monthly plan by default
      subscription_end_date: subscriptionEndDate?.toISOString(),
      current_period_end: subscriptionEndDate?.toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('Updating subscription with data:', subscriptionData);
    
    const { data: subData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: existingSubscription?.id ? 'id' : 'email' });
    
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
