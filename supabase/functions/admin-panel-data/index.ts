
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
    const { type, dateRange } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === 'traffic') {
      return new Response(JSON.stringify(await trafficStats(supabase, dateRange)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
      
      // Get new users in selected date range
      const { count: newUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
      
      // Get all subscriptions for distribution stats
      const { data: allSubscriptions } = await supabase
        .from('subscriptions')
        .select('plan_type, status, current_period_end, subscription_end_date, trial_end_date')
        .range(0, 9999)
      
      let subscriptionStats = { trial: 0, monthly: 0, yearly: 0, ultimate: 0 }
      
      if (allSubscriptions) {
        const now = new Date()
        subscriptionStats = allSubscriptions.reduce((acc: any, sub) => {
          let plan = 'trial'
          
          if (sub.plan_type === 'ultimate') {
            plan = 'ultimate'
          } else if (sub.plan_type === 'yearly') {
            if (sub.status === 'active') {
              const endDate = sub.current_period_end ? new Date(sub.current_period_end) : 
                             sub.subscription_end_date ? new Date(sub.subscription_end_date) : null
              plan = (endDate && endDate > now) ? 'yearly' : 'trial'
            }
          } else if (sub.plan_type === 'monthly') {
            if (sub.status === 'active') {
              const endDate = sub.current_period_end ? new Date(sub.current_period_end) : 
                             sub.subscription_end_date ? new Date(sub.subscription_end_date) : null
              plan = (endDate && endDate > now) ? 'monthly' : 'trial'
            }
          }
          
          acc[plan] = (acc[plan] || 0) + 1
          return acc
        }, { trial: 0, monthly: 0, yearly: 0, ultimate: 0 })
      }
      
      const subscriptionData = [
        { name: 'Trial', value: subscriptionStats.trial || 0, color: '#94a3b8' },
        { name: 'Monthly', value: subscriptionStats.monthly || 0, color: '#335CF4' },
        { name: 'Yearly', value: subscriptionStats.yearly || 0, color: '#08B531' },
        { name: 'Ultimate', value: subscriptionStats.ultimate || 0, color: '#FF4E32' }
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
        activeSessions: 0,
        avgSessionTime: '',
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
            
            // Get sub-users count and emails
            const { data: subUsers } = await supabase
              .from('sub_users')
              .select('id, email, fullname')
              .eq('board_owner_id', authUser.id)
            
            const subUsersCount = subUsers?.length || 0
            const subUsersEmails = subUsers?.map(su => su.email || su.fullname).filter(Boolean) || []
            
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
              hasBusinessProfile: !!businessProfile,
              subUsersCount: subUsersCount,
              subUsersEmails: subUsersEmails
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
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


// ---------- Visitor traffic (privacy-friendly, aggregated) ----------
const HOUR = 3600_000, DAY = 86_400_000

async function fetchAll(q: () => any) {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

function top(rows: { value: string; views: number; visitors: number }[], n = 10) {
  const m = new Map<string, { value: string; views: number; visitors: number }>()
  for (const r of rows) {
    const c = m.get(r.value) || { value: r.value, views: 0, visitors: 0 }
    c.views += r.views; c.visitors += r.visitors; m.set(r.value, c)
  }
  return [...m.values()].sort((a, b) => b.visitors - a.visitors || b.views - a.views).slice(0, n)
}

async function trafficStats(supabase: any, range: string) {
  const now = Date.now()
  const days = ({ '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as Record<string, number>)[range] || 7
  const liveSince = new Date(now - 5 * 60_000).toISOString()
  const { data: live } = await supabase.from('site_visits').select('visitor_id').gte('created_at', liveSince).limit(1000)
  const activeNow = new Set((live || []).map((r: any) => r.visitor_id)).size

  // Short windows: compute exactly from raw page views (kept 8 days)
  if (days <= 7) {
    const start = now - days * DAY
    const raw = await fetchAll(() => supabase.from('site_visits')
      .select('visitor_id, session_id, path, referrer_host, country, device, browser, created_at')
      .gte('created_at', new Date(start - days * DAY).toISOString()).order('created_at'))
    const cur = raw.filter(r => Date.parse(r.created_at) >= start)
    const prev = raw.filter(r => Date.parse(r.created_at) < start)
    const summarize = (rows: any[]) => {
      const sessions = new Map<string, { n: number; a: number; b: number }>()
      for (const r of rows) {
        const t = Date.parse(r.created_at), s = sessions.get(r.session_id)
        if (s) { s.n++; s.b = Math.max(s.b, t); s.a = Math.min(s.a, t) } else sessions.set(r.session_id, { n: 1, a: t, b: t })
      }
      const ss = [...sessions.values()]
      return {
        views: rows.length,
        visitors: new Set(rows.map(r => r.visitor_id)).size,
        sessions: ss.length,
        bounces: ss.filter(s => s.n === 1).length,
        duration: ss.reduce((x, s) => x + (s.b - s.a) / 1000, 0),
      }
    }
    const bucketMs = days === 1 ? HOUR : DAY
    const buckets = days === 1 ? 24 : 7
    const first = days === 1 ? Math.floor(now / HOUR) * HOUR - 23 * HOUR : new Date(new Date(now).toISOString().slice(0, 10)).getTime() - 6 * DAY
    const series = Array.from({ length: buckets }, (_, i) => ({ t: new Date(first + i * bucketMs).toISOString(), views: 0, visitors: 0, _v: new Set<string>() }))
    for (const r of cur) {
      const i = Math.floor((Date.parse(r.created_at) - first) / bucketMs)
      if (i >= 0 && i < buckets) { series[i].views++; series[i]._v.add(r.visitor_id) }
    }
    const dim = (k: string, fallback: string) => {
      const m = new Map<string, { value: string; views: number; v: Set<string> }>()
      for (const r of cur) {
        const val = r[k] || fallback, c = m.get(val) || { value: val, views: 0, v: new Set<string>() }
        c.views++; c.v.add(r.visitor_id); m.set(val, c)
      }
      return [...m.values()].map(c => ({ value: c.value, views: c.views, visitors: c.v.size }))
        .sort((a, b) => b.visitors - a.visitors || b.views - a.views).slice(0, 10)
    }
    return {
      range, granularity: days === 1 ? 'hour' : 'day', activeNow,
      current: summarize(cur), previous: summarize(prev),
      series: series.map(({ _v, ...s }) => ({ ...s, visitors: _v.size })),
      pages: dim('path', '/'), countries: dim('country', '??'), devices: dim('device', 'unknown'),
      browsers: dim('browser', 'Other'), sources: dim('referrer_host', 'direct'),
    }
  }

  // Long windows: daily totals (visitors = sum of daily unique visitors)
  const today = new Date(new Date(now).toISOString().slice(0, 10)).getTime()
  const startDay = new Date(today - (days - 1) * DAY).toISOString().slice(0, 10)
  const prevStart = new Date(today - (2 * days - 1) * DAY).toISOString().slice(0, 10)
  const daily = await fetchAll(() => supabase.from('site_visit_daily').select('*').gte('day', prevStart).order('day'))
  const sum = (rows: any[]) => rows.reduce((a, r) => ({
    views: a.views + r.views, visitors: a.visitors + r.visitors, sessions: a.sessions + r.sessions,
    bounces: a.bounces + r.bounces, duration: a.duration + Number(r.duration_sec),
  }), { views: 0, visitors: 0, sessions: 0, bounces: 0, duration: 0 })
  const cur = daily.filter(r => r.day >= startDay), prev = daily.filter(r => r.day < startDay)
  const byDay = new Map(cur.map(r => [r.day, r]))
  const monthly = days > 90
  const series: any[] = []
  if (monthly) {
    const m = new Map<string, any>()
    for (let i = 0; i < days; i++) {
      const d = new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10), k = d.slice(0, 7) + '-01'
      const c = m.get(k) || { t: k, views: 0, visitors: 0 }; const r = byDay.get(d)
      if (r) { c.views += r.views; c.visitors += r.visitors } m.set(k, c)
    }
    series.push(...m.values())
  } else {
    for (let i = 0; i < days; i++) {
      const d = new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10), r = byDay.get(d)
      series.push({ t: d, views: r?.views || 0, visitors: r?.visitors || 0 })
    }
  }
  const br = await fetchAll(() => supabase.from('site_visit_daily_breakdown').select('dim, value, views, visitors').gte('day', startDay))
  const pick = (d: string) => top(br.filter(r => r.dim === d))
  return {
    range, granularity: monthly ? 'month' : 'day', activeNow, current: sum(cur), previous: sum(prev), series,
    pages: pick('page'), countries: pick('country'), devices: pick('device'), browsers: pick('browser'), sources: pick('source'),
  }
}
