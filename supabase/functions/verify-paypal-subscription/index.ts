
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { subscriptionId, plan_type } = await req.json()
    console.log('Received subscription verification request:', { subscriptionId, plan_type })

    if (!subscriptionId) {
      throw new Error('No subscription ID provided')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get PayPal API credentials
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_SECRET_KEY')

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Get access token from PayPal
    const auth = btoa(`${clientId}:${clientSecret}`)
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const { access_token } = await tokenResponse.json()

    // Verify subscription with PayPal
    const subscriptionResponse = await fetch(`https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    })

    const subscriptionData = await subscriptionResponse.json()
    console.log('PayPal subscription data:', subscriptionData)

    if (!subscriptionResponse.ok || subscriptionData.status !== 'ACTIVE') {
      throw new Error('Invalid or inactive subscription')
    }

    // Get the user ID from the auth header
    const authHeader = req.headers.get('Authorization')?.split('Bearer ')[1]
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader)
    if (userError || !user) {
      throw new Error('Failed to get user')
    }

    // Get subscription plan ID
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('type', plan_type)
      .single()

    if (planError || !planData) {
      throw new Error('Failed to get subscription plan')
    }

    const currentDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + (plan_type === 'yearly' ? 12 : 1))

    // Update subscription in database
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan_id: planData.id,
        plan_type: plan_type,
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: endDate.toISOString(),
        last_payment_id: subscriptionId,
      })

    if (subscriptionError) {
      throw new Error('Failed to update subscription in database')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Subscription verification error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
