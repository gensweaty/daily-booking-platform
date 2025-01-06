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
    console.log('Received PayPal webhook:', payload)

    // Verify the payment was completed or subscription was activated
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED' || 
        payload.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      
      const subscriptionId = payload.resource.custom_id // This should be set when creating the order
      const orderId = payload.resource.id
      const subscriptionStatus = payload.resource.status // PayPal subscription status

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

      // Calculate new period end date
      const currentDate = new Date()
      const nextPeriodEnd = new Date(currentDate)
      if (subscription.plan_type === 'monthly') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1)
      }

      // Update subscription status
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          last_payment_id: orderId
        })
        .eq('id', subscriptionId)

      if (updateError) {
        console.error('Error updating subscription:', updateError)
        throw updateError
      }

      console.log(`Successfully updated subscription ${subscriptionId}`)
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