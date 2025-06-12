
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const { type } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === 'analytics') {
      // Get analytics data
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      
      // Get new users in last 24h
      const { count: newUsers24h } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
      
      // Get subscription distribution
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('plan_type, status')
      
      const subscriptionStats = subscriptions?.reduce((acc: any, sub) => {
        const key = sub.plan_type || 'trial'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}) || {}
      
      const subscriptionData = [
        { name: 'Trial', value: subscriptionStats.trial || 0, color: '#8884d8' },
        { name: 'Basic', value: subscriptionStats.basic || 0, color: '#82ca9d' },
        { name: 'Premium', value: subscriptionStats.premium || 0, color: '#ffc658' },
        { name: 'Ultimate', value: subscriptionStats.ultimate || 0, color: '#ff7300' }
      ]
      
      // Generate hourly registration data for last 24h
      const registrationData = []
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
        const hourStart = new Date(hour)
        hourStart.setMinutes(0, 0, 0)
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
        
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', hourStart.toISOString())
          .lt('created_at', hourEnd.toISOString())
        
        registrationData.push({
          hour: hourStart.getHours().toString().padStart(2, '0') + ':00',
          users: count || 0
        })
      }
      
      const analyticsData = {
        totalUsers: totalUsers || 0,
        newUsers24h: newUsers24h || 0,
        activeSessions: Math.floor(Math.random() * 50) + 10, // Simulated for now
        avgSessionTime: '12m', // Simulated for now
        registrationData,
        subscriptionData
      }
      
      return new Response(JSON.stringify(analyticsData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (type === 'users') {
      // Get comprehensive user data
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      const userData = await Promise.all(
        profiles?.map(async (profile) => {
          // Get subscription info
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_type, status')
            .eq('user_id', profile.id)
            .single()
          
          // Get task count
          const { count: tasksCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
          
          // Get booking/event count
          const { count: bookingsCount } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
          
          // Get customer count
          const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
          
          // Check business profile
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('id')
            .eq('user_id', profile.id)
            .single()
          
          // Get user auth data for email and last login
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
          
          return {
            id: profile.id,
            email: authUser.user?.email || 'N/A',
            registeredOn: profile.created_at,
            lastLogin: authUser.user?.last_sign_in_at || null,
            subscriptionPlan: subscription?.plan_type || 'trial',
            subscriptionStatus: subscription?.status || 'trial',
            tasksCount: tasksCount || 0,
            bookingsCount: bookingsCount || 0,
            customersCount: customersCount || 0,
            hasBusinessProfile: !!businessProfile
          }
        }) || []
      )
      
      return new Response(JSON.stringify(userData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
