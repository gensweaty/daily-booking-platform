import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Webhook received:', new Date().toISOString());
  
  // Handle CORS preflight requests
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

    // Log the raw request body for debugging
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
                      payload.email_address; // Add direct email field check
                      
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

    // Calculate new period end date
    const currentDate = new Date();
    const nextPeriodEnd = new Date(currentDate);
    
    if (planType === 'monthly') {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    } else {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    }

    console.log('Calculated dates:', {
      currentDate: currentDate.toISOString(),
      nextPeriodEnd: nextPeriodEnd.toISOString()
    });

    // Update subscription status
    console.log('Updating subscription for user:', userData.id);
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        plan_type: planType,
        last_payment_id: payload.resource?.id || payload.id
      })
      .eq('user_id', userData.id)

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully updated subscription for user:', userData.id);

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