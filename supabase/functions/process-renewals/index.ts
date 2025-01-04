import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active subscriptions that are due for renewal
    const { data: subscriptions, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lt('current_period_end', new Date().toISOString())

    if (fetchError) throw fetchError

    for (const subscription of subscriptions) {
      try {
        // Create a new PayPal order for renewal
        const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`)}`,
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: {
                currency_code: 'USD',
                value: subscription.plan_type === 'monthly' ? '9.95' : '89.95'
              }
            }]
          })
        })

        const orderData = await response.json()

        if (orderData.status === 'CREATED') {
          // Capture the payment
          const captureResponse = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderData.id}/capture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET_KEY')}`)}`,
            }
          })

          const captureData = await captureResponse.json()

          if (captureData.status === 'COMPLETED') {
            // Update subscription period
            const nextPeriodEnd = new Date()
            if (subscription.plan_type === 'monthly') {
              nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
            } else {
              nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1)
            }

            await supabaseClient
              .from('subscriptions')
              .update({
                current_period_start: new Date().toISOString(),
                current_period_end: nextPeriodEnd.toISOString(),
                last_payment_id: captureData.id
              })
              .eq('id', subscription.id)

            console.log(`Successfully renewed subscription ${subscription.id}`)
          }
        }
      } catch (error) {
        console.error(`Failed to process renewal for subscription ${subscription.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ message: 'Renewals processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing renewals:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process renewals' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})