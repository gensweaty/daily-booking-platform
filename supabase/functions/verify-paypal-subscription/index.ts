
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { subscriptionId, plan_type } = await req.json()

    // PayPal API Configuration
    const PAYPAL_API_URL = 'https://api-m.paypal.com'
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_SECRET_KEY')

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Get access token
    const authResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    })

    const authData = await authResponse.json()

    // Verify subscription
    const subscriptionResponse = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    const subscriptionData = await subscriptionResponse.json()

    if (!subscriptionResponse.ok || subscriptionData.status !== 'ACTIVE') {
      throw new Error('Invalid or inactive subscription')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update subscription in database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        plan_type: plan_type,
        paypal_subscription_id: subscriptionId,
        current_period_start: new Date(),
        current_period_end: new Date(subscriptionData.billing_info.next_billing_time),
      })
      .eq('user_id', req.auth?.uid)
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error('Failed to update subscription in database')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      },
    )
  }
})
