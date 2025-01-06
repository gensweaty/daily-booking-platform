import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Received PayPal webhook payload:', JSON.stringify(payload, null, 2))

    // Extract plan type from URL parameters
    const url = new URL(req.url)
    const planType = url.searchParams.get('plan')
    console.log('Plan type from URL:', planType)

    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      console.error('Invalid or missing plan type:', planType)
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the payment was completed or subscription was activated
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED' || 
        payload.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      
      console.log('Processing payment event:', payload.event_type)
      
      // Extract subscription details from the payload
      const subscriptionId = payload.resource.custom_id
      const orderId = payload.resource.id
      const subscriptionStatus = payload.resource.status

      console.log('Extracted details:', {
        subscriptionId,
        orderId,
        subscriptionStatus,
        planType
      })

      if (!subscriptionId) {
        console.error('No subscription ID found in payload')
        return new Response(
          JSON.stringify({ error: 'No subscription ID found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch the subscription
      const { data: subscription, error: fetchError } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError) {
        console.error('Error fetching subscription:', fetchError)
        throw fetchError
      }

      if (!subscription) {
        console.error('No subscription found with ID:', subscriptionId)
        return new Response(
          JSON.stringify({ error: 'Subscription not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})