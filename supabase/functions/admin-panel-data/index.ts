
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
    const { type, dateRange } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === 'analytics') {
      const now = new Date()
      let startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Default to 24h ago
      let endDate = now

      // Use date range if provided
      if (dateRange) {
        startDate = new Date(dateRange.start)
        endDate = new Date(dateRange.end)
      }
      
      // Get total users in date range
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
      
      // Get new users in selected date range
      const { count: newUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
      
      // Get all users for subscription distribution (not filtered by date)
      const { data: allUsers } = await supabase.functions.invoke('admin-panel-data', {
        body: { type: 'users' }
      });

      let subscriptionStats = { trial: 0, monthly: 0, yearly: 0, ultimate: 0 }
      
      if (allUsers && Array.isArray(allUsers)) {
        subscriptionStats = allUsers.reduce((acc: any, user) => {
          const plan = user.subscriptionPlan || 'trial'
          acc[plan] = (acc[plan] || 0) + 1
          return acc
        }, { trial: 0, monthly: 0, yearly: 0, ultimate: 0 })
      }
      
      const subscriptionData = [
        { name: 'Trial', value: subscriptionStats.trial || 0, color: '#8884d8' },
        { name: 'Monthly', value: subscriptionStats.monthly || 0, color: '#82ca9d' },
        { name: 'Yearly', value: subscriptionStats.yearly || 0, color: '#ffc658' },
        { name: 'Ultimate', value: subscriptionStats.ultimate || 0, color: '#ff7300' }
      ]
      
      // Generate hourly registration data for selected date range
      const registrationData = []
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays <= 1) {
        // Hourly data for single day
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(endDate.getTime() - i * 60 * 60 * 1000)
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
      } else {
        // Daily data for longer ranges
        for (let i = diffDays - 1; i >= 0; i--) {
          const day = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)
          const dayStart = new Date(day)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
          
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dayStart.toISOString())
            .lt('created_at', dayEnd.toISOString())
          
          registrationData.push({
            hour: dayStart.toLocaleDateString(),
            users: count || 0
          })
        }
      }
      
      const analyticsData = {
        totalUsers: totalUsers || 0,
        newUsers24h: newUsers || 0,
        activeSessions: Math.floor(Math.random() * 50) + 10,
        avgSessionTime: '12m',
        registrationData,
        subscriptionData
      }
      
      return new Response(JSON.stringify(analyticsData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (type === 'users') {
      console.log('Fetching user data for admin panel...')
      
      // Get ALL auth users first to ensure we don't miss anyone
      const { data: { users: authUsers }, error: authUsersError } = await supabase.auth.admin.listUsers()
      if (authUsersError) {
        console.error('Error fetching auth users:', authUsersError)
        return new Response(JSON.stringify({ error: 'Failed to fetch auth users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`Found ${authUsers?.length || 0} auth users`)
      
      if (!authUsers || authUsers.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get ALL profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      }
      
      console.log(`Found ${profiles?.length || 0} profiles`)

      // Create a map of profiles by ID for quick lookup
      const profileMap = new Map()
      if (profiles) {
        profiles.forEach(profile => {
          profileMap.set(profile.id, profile)
        })
      }

      // Process ALL auth users (not just those with profiles)
      const userData = await Promise.all(
        authUsers.map(async (authUser) => {
          try {
            console.log(`Processing user: ${authUser.email}`)

            // Get profile data from the map (might not exist)
            const profile = profileMap.get(authUser.id)

            // Get subscription info - get the most recent subscription
            const { data: subscriptions, error: subError } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', authUser.id)
              .order('updated_at', { ascending: false })
            
            if (subError) {
              console.error(`Error getting subscription for user ${authUser.id}:`, subError)
            }

            const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null
            
            // Use the same logic as the dashboard for subscription status
            let displayStatus = 'trial'
            let displayPlan = 'trial'
            
            if (subscription) {
              const now = new Date()
              
              console.log(`Processing subscription for user ${authUser.email}:`, {
                plan_type: subscription.plan_type,
                status: subscription.status,
                current_period_end: subscription.current_period_end,
                subscription_end_date: subscription.subscription_end_date,
                trial_end_date: subscription.trial_end_date
              })
              
              if (subscription.plan_type === 'ultimate') {
                displayStatus = 'active'
                displayPlan = 'ultimate'
              } else if (subscription.plan_type === 'yearly') {
                displayPlan = 'yearly'
                
                if (subscription.status === 'active') {
                  let isActive = true
                  
                  if (subscription.current_period_end) {
                    const endDate = new Date(subscription.current_period_end)
                    isActive = endDate > now
                  } else if (subscription.subscription_end_date) {
                    const endDate = new Date(subscription.subscription_end_date)
                    isActive = endDate > now
                  }
                  
                  displayStatus = isActive ? 'active' : 'expired'
                } else if (subscription.status === 'trial') {
                  if (subscription.trial_end_date) {
                    const trialEnd = new Date(subscription.trial_end_date)
                    displayStatus = trialEnd > now ? 'trial' : 'trial_expired'
                  } else {
                    displayStatus = 'trial'
                  }
                } else {
                  displayStatus = subscription.status || 'expired'
                }
              } else if (subscription.plan_type === 'monthly') {
                displayPlan = 'monthly'
                
                if (subscription.status === 'active') {
                  let isActive = true
                  
                  if (subscription.current_period_end) {
                    const endDate = new Date(subscription.current_period_end)
                    isActive = endDate > now
                  } else if (subscription.subscription_end_date) {
                    const endDate = new Date(subscription.subscription_end_date)
                    isActive = endDate > now
                  }
                  
                  displayStatus = isActive ? 'active' : 'expired'
                } else if (subscription.status === 'trial') {
                  if (subscription.trial_end_date) {
                    const trialEnd = new Date(subscription.trial_end_date)
                    displayStatus = trialEnd > now ? 'trial' : 'trial_expired'
                  } else {
                    displayStatus = 'trial'
                  }
                } else {
                  displayStatus = subscription.status || 'expired'
                }
              } else {
                if (subscription.trial_end_date) {
                  const trialEnd = new Date(subscription.trial_end_date)
                  displayStatus = trialEnd > now ? 'trial' : 'trial_expired'
                } else {
                  displayStatus = subscription.status || 'trial'
                }
                displayPlan = subscription.plan_type || 'trial'
              }
            }

            // Get task count
            const { count: tasksCount } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', authUser.id)
            
            // Get booking/event count
            const { count: bookingsCount } = await supabase
              .from('events')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', authUser.id)
            
            // Get customer count
            const { count: customersCount } = await supabase
              .from('customers')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', authUser.id)
            
            // Check business profile
            const { data: businessProfile } = await supabase
              .from('business_profiles')
              .select('id')
              .eq('user_id', authUser.id)
              .single()
            
            console.log(`Final result for ${authUser.email}:`, {
              displayPlan,
              displayStatus
            })
            
            return {
              id: authUser.id,
              username: profile?.username || 'N/A',
              email: authUser.email || 'N/A',
              registeredOn: profile?.created_at || authUser.created_at,
              lastLogin: authUser.last_sign_in_at || null,
              subscriptionPlan: displayPlan,
              subscriptionStatus: displayStatus,
              tasksCount: tasksCount || 0,
              bookingsCount: bookingsCount || 0,
              customersCount: customersCount || 0,
              hasBusinessProfile: !!businessProfile
            }
          } catch (error) {
            console.error(`Error processing user ${authUser.id}:`, error)
            return {
              id: authUser.id,
              username: 'Error loading',
              email: authUser.email || 'Error loading',
              registeredOn: authUser.created_at,
              lastLogin: null,
              subscriptionPlan: 'trial',
              subscriptionStatus: 'trial',
              tasksCount: 0,
              bookingsCount: 0,
              customersCount: 0,
              hasBusinessProfile: false
            }
          }
        })
      )
      
      console.log(`Processed ${userData.length} users`)
      
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
