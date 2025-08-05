
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
    console.log('🔄 Processing due reminders at', new Date().toISOString());

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

    // Find all due reminders that haven't been delivered
    const now = new Date().toISOString();
    const { data: dueReminders, error: fetchError } = await supabase
      .from('reminder_entries')
      .select('*')
      .eq('delivered', false)
      .lte('remind_at', now)
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('Error fetching due reminders:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reminders' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log('📭 No due reminders found');
      return new Response(
        JSON.stringify({ message: 'No due reminders', processed: 0 }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`📬 Found ${dueReminders.length} due reminders to process`);

    let processed = 0;
    let failed = 0;

    // Process each reminder
    for (const reminder of dueReminders) {
      try {
        console.log(`🔔 Processing reminder ${reminder.id} for ${reminder.type}: ${reminder.title}`);

        // Determine which email function to call based on type
        const functionName = reminder.type === 'event' 
          ? 'send-event-reminder-email'
          : 'send-task-reminder-email';

        const payload = reminder.type === 'event' 
          ? { eventId: reminder.event_id }
          : { taskId: reminder.task_id };

        // Call the appropriate email function
        const { error: emailError } = await supabase.functions.invoke(functionName, {
          body: payload
        });

        if (emailError) {
          console.error(`❌ Failed to send ${reminder.type} reminder email for ${reminder.id}:`, emailError);
          failed++;
          continue;
        }

        // Mark reminder as delivered
        const { error: updateError } = await supabase
          .from('reminder_entries')
          .update({
            delivered: true,
            delivered_at: new Date().toISOString()
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`⚠️ Email sent but failed to mark reminder ${reminder.id} as delivered:`, updateError);
          // Don't count as failed since email was sent
        }

        console.log(`✅ Successfully processed reminder ${reminder.id}`);
        processed++;

      } catch (error) {
        console.error(`❌ Exception processing reminder ${reminder.id}:`, error);
        failed++;
      }
    }

    console.log(`🎯 Reminder processing complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: 'Reminder processing complete',
        processed,
        failed,
        total: dueReminders.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('❌ Error in process-reminders function:', error);
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
