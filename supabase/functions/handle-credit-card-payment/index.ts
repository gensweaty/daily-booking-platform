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

    const payload = await req.json()
    console.log('Received PayPal webhook:', payload)

    // Verify the payment was completed
    if (payload.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const userId = payload.resource.custom_id
      const planType = payload.resource.purchase_units[0].description
      const orderId = payload.resource.id

      if (!userId) {
        throw new Error('No user ID found in payload')
      }

      // Calculate new period end date
      const currentDate = new Date()
      const nextPeriodEnd = new Date(currentDate)
      if (planType === 'monthly') {
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
        .eq('user_id', userId)

      if (updateError) throw updateError

      console.log(`Successfully updated subscription for user ${userId}`)
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