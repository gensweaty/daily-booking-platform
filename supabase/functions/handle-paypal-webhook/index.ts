import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Received PayPal webhook payload:', JSON.stringify(payload, null, 2))

    // Verify the payment was completed or subscription was activated
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED' || 
        payload.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      
      console.log('Processing payment event:', payload.event_type)
      
      // Extract subscription details from the payload
      const subscriptionId = payload.resource.custom_id
      const orderId = payload.resource.id
      const subscriptionStatus = payload.resource.status
      const planType = new URL(req.url).searchParams.get('plan') || 'monthly'

      console.log('Extracted details:', {
        subscriptionId,
        orderId,
        subscriptionStatus,
        planType
      })

      if (!subscriptionId) {
        console.error('No subscription ID found in payload')
        throw new Error('No subscription ID found in payload')
      }

      // Get the subscription details
      const { data: subscription, error: fetchError } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError) {
        console.error('Error fetching subscription:', fetchError)
        throw fetchError
      }

      console.log('Found subscription:', subscription)

      // Calculate new period end date
      const currentDate = new Date()
      const nextPeriodEnd = new Date(currentDate)
      
      if (planType === 'monthly') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1)
      }

      console.log('Calculated dates:', {
        currentDate: currentDate.toISOString(),
        nextPeriodEnd: nextPeriodEnd.toISOString()
      })

      // Update subscription status
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          plan_type: planType,
          last_payment_id: orderId
        })
        .eq('id', subscriptionId)

      if (updateError) {
        console.error('Error updating subscription:', updateError)
        throw updateError
      }

      console.log(`Successfully updated subscription ${subscriptionId}`)
    } else {
      console.log('Ignoring non-payment event:', payload.event_type)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing PayPal webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})