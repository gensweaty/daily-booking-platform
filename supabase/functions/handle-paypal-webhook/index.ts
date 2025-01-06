import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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

    // Extract plan type from payload
    const planType = payload.plan_type;
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      console.error('Invalid or missing plan type:', planType);
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the payer email to identify the user
    const payerEmail = payload.resource?.payer?.email_address;
    console.log('Looking up user with email:', payerEmail);

    if (!payerEmail) {
      console.error('No payer email found in payload');
      return new Response(
        JSON.stringify({ error: 'No payer email found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('auth.users')
      .select('id, email')
      .eq('email', payerEmail)
      .maybeSingle();

    if (userError) {
      console.error('Error finding user:', userError);
      return new Response(
        JSON.stringify({ error: 'Database error while finding user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userData) {
      console.error('User not found for email:', payerEmail);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user:', userData);

    // Calculate subscription dates
    const currentDate = new Date();
    const nextPeriodEnd = new Date(currentDate);
    if (planType === 'monthly') {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    } else {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    }

    console.log('Updating subscription for user:', userData.id);
    console.log('New subscription period:', {
      start: currentDate.toISOString(),
      end: nextPeriodEnd.toISOString()
    });

    // Get the subscription plan ID
    const { data: planData, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('id')
      .eq('type', planType)
      .single();

    if (planError || !planData) {
      console.error('Error finding subscription plan:', planError);
      return new Response(
        JSON.stringify({ error: 'Failed to find subscription plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update subscription
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        user_id: userData.id,
        plan_id: planData.id,
        status: 'active',
        plan_type: planType,
        current_period_start: currentDate.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        last_payment_id: payload.resource?.id
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully processed webhook and updated subscription');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription updated successfully',
        user: userData.id,
        plan_type: planType,
        current_period_end: nextPeriodEnd.toISOString()
      }),
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