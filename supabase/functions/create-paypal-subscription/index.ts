
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { plan_type } = await req.json()
    
    // PayPal API Configuration
    const PAYPAL_API_URL = 'https://api-m.paypal.com' // Use sandbox URL for testing
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

    if (!authResponse.ok) {
      console.error('PayPal auth error:', authData)
      throw new Error('Failed to authenticate with PayPal')
    }

    // Create subscription
    const planId = plan_type === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'
    
    const subscriptionResponse = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        application_context: {
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          },
        },
      }),
    })

    const subscriptionData = await subscriptionResponse.json()

    if (!subscriptionResponse.ok) {
      console.error('PayPal subscription error:', subscriptionData)
      throw new Error('Failed to create PayPal subscription')
    }

    return new Response(
      JSON.stringify({ subscriptionId: subscriptionData.id }),
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
