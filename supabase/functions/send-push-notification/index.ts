import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  userId: string;
  subUserId?: string;
  title: string;
  body: string;
  data?: any;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: PushPayload = await req.json();
    console.log('[Push] Sending notification to user:', payload.userId);

    // Get VAPID keys from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@smartbookly.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    // Fetch user's push subscriptions
    let query = supabaseClient
      .from('push_subscriptions')
      .select('*');
    
    if (payload.subUserId) {
      query = query.eq('sub_user_id', payload.subUserId);
    } else {
      query = query.eq('user_id', payload.userId);
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No subscriptions found for user');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Push] Found ${subscriptions.length} subscription(s)`);

    // Prepare notification payload
    const notificationPayload = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: payload.data || {},
      tag: payload.tag || 'default',
      requireInteraction: payload.requireInteraction || false,
      vibrate: [200, 100, 200]
    };

    // Send to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // Dynamic import of web-push
          const webpush = await import('https://esm.sh/web-push@3.6.7');
          
          webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
          );

          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(notificationPayload)
          );

          // Update last_used_at
          await supabaseClient
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', subscription.id);

          console.log('[Push] Sent to subscription:', subscription.endpoint);
          return { success: true, endpoint: subscription.endpoint };
        } catch (error: any) {
          console.error('[Push] Failed to send to subscription:', error);

          // Remove invalid subscriptions (expired/unsubscribed)
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('[Push] Removing invalid subscription:', subscription.endpoint);
            await supabaseClient
              .from('push_subscriptions')
              .delete()
              .eq('id', subscription.id);
          }

          return { success: false, endpoint: subscription.endpoint, error: error.message };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`[Push] Sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        message: `Sent ${successCount} notification(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Push] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});