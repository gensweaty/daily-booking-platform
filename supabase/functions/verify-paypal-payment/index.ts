
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const paymentStatus = url.searchParams.get('st');
    const amount = url.searchParams.get('amt');
    const transactionId = url.searchParams.get('tx');
    const currency = url.searchParams.get('cc');

    console.log('Payment verification request received:', {
      status: paymentStatus,
      amount,
      transactionId,
      currency
    });

    if (paymentStatus !== 'COMPLETED') {
      return new Response(
        JSON.stringify({ error: "Payment not completed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client using service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get PayPal access token
    const authResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`),
      },
      body: "grant_type=client_credentials",
    })

    const authData = await authResponse.json()
    
    if (!authData.access_token) {
      console.error('PayPal auth error:', authData)
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with PayPal" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify transaction with PayPal
    const verificationResponse = await fetch(
      `https://api-m.paypal.com/v2/payments/captures/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
        },
      }
    )

    const verificationData = await verificationResponse.json()
    
    if (verificationData.status !== "COMPLETED") {
      return new Response(
        JSON.stringify({ error: "Transaction verification failed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Assuming the first payment will activate a monthly subscription
    // You may want to adjust this based on your payment amounts
    const subscriptionType = parseFloat(amount) >= 100 ? 'yearly' : 'monthly';

    // Call the database function to activate the subscription
    const { error: dbError } = await supabaseAdmin.rpc(
      'activate_subscription',
      { 
        p_user_id: verificationData.custom_id, // You'll need to pass the user ID in the PayPal button setup
        p_subscription_type: subscriptionType
      }
    )

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: "Failed to activate subscription" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Redirect to success page
    return new Response(
      null,
      {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': '/dashboard?payment=success'
        }
      }
    )

  } catch (err) {
    console.error('Verification error:', err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
