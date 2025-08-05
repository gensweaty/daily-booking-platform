
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Use service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderProcessingResult {
  taskReminders: number;
  eventReminders: number;
  errors: string[];
}

const handler = async (req: Request): Promise<Response> => {
  console.log('🔄 Process reminders function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log('📨 Request body:', body);

    const now = new Date();
    // Use 1-minute buffer BEFORE scheduled time for much earlier delivery
    const reminderCheckTime = new Date(now.getTime() + 60 * 1000); // 1 minute ahead for earlier checking
    
    const result: ReminderProcessingResult = {
      taskReminders: 0,
      eventReminders: 0,
      errors: []
    };

    console.log('⏰ Processing reminders at:', now.toISOString());
    console.log('📅 Checking reminders up to:', reminderCheckTime.toISOString());

    // Process Task Reminders - CRITICAL: Check for ALL tasks with due reminders regardless of status
    try {
      const { data: dueTasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .not('reminder_at', 'is', null)
        .lte('reminder_at', reminderCheckTime.toISOString())
        .is('reminder_sent_at', null)
        .eq('archived', false); // Only check archived status, ignore email_reminder_enabled filter

      if (taskError) {
        console.error('❌ Error fetching due tasks:', taskError);
        result.errors.push(`Task fetch error: ${taskError.message}`);
      } else {
        console.log(`📋 Found ${dueTasks?.length || 0} potential due task reminders (all statuses)`);
        
        for (const task of dueTasks || []) {
          try {
            console.log(`🔍 Processing task: ${task.title} (ID: ${task.id}, status: ${task.status}, reminder_at: ${task.reminder_at}, email_reminder_enabled: ${task.email_reminder_enabled})`);
            
            // CRITICAL: Force send email for ANY task with reminder_at set, regardless of email_reminder_enabled
            // This ensures tasks moved between statuses still get their reminders
            const shouldSendReminder = task.reminder_at && !task.reminder_sent_at;
            
            if (shouldSendReminder) {
              console.log(`🚀 FORCE SENDING reminder for task ${task.id} - ignoring email_reminder_enabled status`);
              
              // Send email reminder using existing function
              const { error: emailError } = await supabase.functions.invoke('send-task-reminder-email', {
                body: { taskId: task.id }
              });

              if (emailError) {
                console.error(`❌ Error sending task email for ${task.id}:`, emailError);
                result.errors.push(`Task ${task.id}: ${emailError.message}`);
              } else {
                console.log(`✅ Task reminder sent successfully for: ${task.title}`);
                result.taskReminders++;
              }
            } else {
              console.log(`⏭️ Skipping task ${task.id} - already sent or no reminder set`);
            }
          } catch (error) {
            console.error(`❌ Exception processing task ${task.id}:`, error);
            result.errors.push(`Task ${task.id} exception: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Task processing exception:', error);
      result.errors.push(`Task processing exception: ${error.message}`);
    }

    // Process Event Reminders
    try {
      const { data: dueEvents, error: eventError } = await supabase
        .from('events')
        .select('*')
        .not('reminder_at', 'is', null)
        .eq('email_reminder_enabled', true)
        .lte('reminder_at', reminderCheckTime.toISOString())
        .is('reminder_sent_at', null)
        .is('deleted_at', null);

      if (eventError) {
        console.error('❌ Error fetching due events:', eventError);
        result.errors.push(`Event fetch error: ${eventError.message}`);
      } else {
        console.log(`📅 Found ${dueEvents?.length || 0} due event reminders`);
        
        for (const event of dueEvents || []) {
          try {
            console.log(`🔍 Processing event: ${event.title} (reminder_at: ${event.reminder_at})`);
            
            // Send email reminder using existing function
            const { error: emailError } = await supabase.functions.invoke('send-event-reminder-email', {
              body: { eventId: event.id }
            });

            if (emailError) {
              console.error(`❌ Error sending event email for ${event.id}:`, emailError);
              result.errors.push(`Event ${event.id}: ${emailError.message}`);
            } else {
              console.log(`✅ Event reminder sent successfully for: ${event.title}`);
              result.eventReminders++;
            }
          } catch (error) {
            console.error(`❌ Exception processing event ${event.id}:`, error);
            result.errors.push(`Event ${event.id} exception: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Event processing exception:', error);
      result.errors.push(`Event processing exception: ${error.message}`);
    }

    // Log final results
    console.log('📊 Processing complete:', {
      taskReminders: result.taskReminders,
      eventReminders: result.eventReminders,
      totalErrors: result.errors.length,
      timestamp: now.toISOString()
    });

    if (result.errors.length > 0) {
      console.error('❌ Errors encountered:', result.errors);
    }

    return new Response(JSON.stringify({
      success: true,
      processed_at: now.toISOString(),
      task_reminders_sent: result.taskReminders,
      event_reminders_sent: result.eventReminders,
      errors: result.errors
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('❌ Critical error in process-reminders:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
