import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, newPlan } = await req.json()
    
    if (!userId || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or newPlan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['monthly', 'yearly', 'ultimate'].includes(newPlan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Admin changing plan for user ${userId} to ${newPlan}`)

    // Get or create subscription
    const { data: existingSubs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null

    const now = new Date()
    let updateData: any = {
      plan_type: newPlan,
      status: 'active',
      updated_at: now.toISOString()
    }

    if (newPlan === 'ultimate') {
      // Ultimate plan - lifetime access
      updateData.subscription_start_date = now.toISOString()
      updateData.subscription_end_date = null
      updateData.current_period_start = null
      updateData.current_period_end = null
      updateData.trial_end_date = null
    } else {
      // Monthly or yearly plan
      const periodMonths = newPlan === 'yearly' ? 12 : 1
      const periodEnd = new Date(now.getTime() + periodMonths * 30 * 24 * 60 * 60 * 1000)
      
      updateData.current_period_start = now.toISOString()
      updateData.current_period_end = periodEnd.toISOString()
      updateData.subscription_start_date = now.toISOString()
      updateData.subscription_end_date = periodEnd.toISOString()
      updateData.trial_end_date = null
    }

    if (existingSub) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', existingSub.id)

      if (updateError) {
        console.error('Error updating subscription:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          ...updateData,
          created_at: now.toISOString()
        })

      if (insertError) {
        console.error('Error creating subscription:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Successfully changed plan for user ${userId} to ${newPlan}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Plan changed to ${newPlan}`,
        plan: newPlan
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
