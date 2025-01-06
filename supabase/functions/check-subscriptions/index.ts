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

    // Get all active subscriptions
    const { data: subscriptions, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError)
      throw fetchError
    }

    console.log(`Checking ${subscriptions?.length || 0} active subscriptions`)

    // Process each subscription
    for (const subscription of subscriptions || []) {
      try {
        const currentPeriodEnd = new Date(subscription.current_period_end)
        const now = new Date()

        // If subscription has expired
        if (currentPeriodEnd < now) {
          console.log(`Subscription ${subscription.id} has expired. Updating status...`)
          
          const { error: updateError } = await supabaseClient
            .from('subscriptions')
            .update({ status: 'expired' })
            .eq('id', subscription.id)

          if (updateError) {
            console.error(`Error updating subscription ${subscription.id}:`, updateError)
          }
        } else {
          console.log(`Subscription ${subscription.id} is still active. Expires on ${currentPeriodEnd}`)
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ message: 'Subscription check completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in check-subscriptions function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to check subscriptions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})