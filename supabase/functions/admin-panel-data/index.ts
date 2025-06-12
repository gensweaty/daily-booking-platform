
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { type } = await req.json();

    if (type === 'analytics') {
      // Get user analytics data
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count new users in last 24h
      const { count: newUsersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      // Count total users
      const { count: totalUsersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Generate hourly user registration data for last 24h
      const userGrowthData = [];
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);
        
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', hour.toISOString())
          .lt('created_at', nextHour.toISOString());

        userGrowthData.push({
          hour: hour.getHours().toString().padStart(2, '0') + ':00',
          users: count || 0
        });
      }

      // Get subscription distribution
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('plan_type, status');

      const subscriptionMap = {
        trial: { name: 'Trial', color: '#f59e0b' },
        monthly: { name: 'Monthly', color: '#3b82f6' },
        yearly: { name: 'Yearly', color: '#10b981' },
        ultimate: { name: 'Ultimate', color: '#8b5cf6' }
      };

      const subscriptionData = Object.entries(subscriptionMap).map(([key, config]) => ({
        name: config.name,
        value: subscriptions?.filter(s => s.plan_type === key).length || 0,
        color: config.color
      }));

      return new Response(
        JSON.stringify({
          newUsersLast24h: newUsersCount || 0,
          totalUsers: totalUsersCount || 0,
          userGrowthData,
          subscriptionData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === 'users') {
      // Get comprehensive user data
      const { data: users, error: usersError } = await supabase
        .rpc('get_admin_user_data');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      // If RPC doesn't exist, build data manually
      if (!users) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select(`
            id,
            created_at,
            profiles!inner(username)
          `)
          .order('created_at', { ascending: false });

        const userData = [];
        
        for (const profile of profiles || []) {
          // Get user email from auth.users (we'll need to create a secure way to access this)
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          
          // Get subscription info
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_type, status')
            .eq('user_id', profile.id)
            .maybeSingle();

          // Get counts
          const { count: tasksCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { count: eventsCount } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('id')
            .eq('user_id', profile.id)
            .maybeSingle();

          userData.push({
            id: profile.id,
            email: authUser?.user?.email || 'N/A',
            registeredOn: profile.created_at,
            lastLogin: authUser?.user?.last_sign_in_at || null,
            subscriptionPlan: subscription?.plan_type || 'trial',
            subscriptionStatus: subscription?.status || 'trial',
            tasksCount: tasksCount || 0,
            bookingsCount: eventsCount || 0,
            customersCount: customersCount || 0,
            hasBusinessProfile: !!businessProfile
          });
        }

        return new Response(
          JSON.stringify(userData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(users),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request type" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error('Error in admin-panel-data function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
