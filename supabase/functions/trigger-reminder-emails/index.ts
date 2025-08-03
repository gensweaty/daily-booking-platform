
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Reminder email trigger function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();
    
    console.log('📋 Querying for due event reminders at:', now);
    
    // Find events with due reminders that haven't been sent yet
    const { data: dueEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .lte('reminder_at', now)
      .eq('email_reminder_enabled', true)
      .is('reminder_sent_at', null)
      .is('deleted_at', null);

    if (eventsError) {
      console.error('Error fetching due events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch due events' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`📝 Found ${dueEvents?.length || 0} due events with email reminders`);

    if (!dueEvents || dueEvents.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No due event reminders found',
          checkedAt: now,
          totalProcessed: 0
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    let emailsSent = 0;
    let emailsSkipped = 0;

    // Process each due event by calling the send-event-reminder-email function
    for (const event of dueEvents) {
      try {
        console.log(`📧 Processing reminder for event ${event.id}`);
        
        // Call the send-event-reminder-email function for this specific event
        const { data, error } = await supabase.functions.invoke('send-event-reminder-email', {
          body: { eventId: event.id }
        });

        if (error) {
          console.error(`❌ Error sending reminder for event ${event.id}:`, error);
          emailsSkipped++;
        } else {
          console.log(`✅ Reminder sent for event ${event.id}`);
          emailsSent++;
        }

      } catch (error) {
        console.error(`💥 Exception processing event ${event.id}:`, error);
        emailsSkipped++;
      }
    }

    console.log(`📊 Reminder processing summary: ${emailsSent} sent, ${emailsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        message: 'Reminder emails processed',
        emailsSent,
        emailsSkipped,
        totalEvents: dueEvents.length,
        processedAt: now
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('💥 Error in trigger-reminder-emails function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);
