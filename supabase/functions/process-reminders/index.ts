

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
    const result: ReminderProcessingResult = {
      taskReminders: 0,
      eventReminders: 0,
      errors: []
    };

    console.log('⏰ Processing reminders at:', now.toISOString());

    // Process Task Reminders - FIXED: Remove status filter to send reminders for tasks in any status
    try {
      const { data: dueTasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .not('reminder_at', 'is', null)
        .lte('reminder_at', now.toISOString())
        .is('reminder_sent_at', null) // Only unsent reminders
        .eq('archived', false); // Only non-archived tasks

      if (taskError) {
        console.error('❌ Error fetching due tasks:', taskError);
        result.errors.push(`Task fetch error: ${taskError.message}`);
      } else {
        console.log(`📋 Found ${dueTasks?.length || 0} due task reminders`);
        
        for (const task of dueTasks || []) {
          try {
            // Send email reminder using existing function
            const { error: emailError } = await supabase.functions.invoke('send-task-reminder-email', {
              body: { taskId: task.id }
            });

            if (emailError) {
              console.error(`❌ Error sending task email for ${task.id}:`, emailError);
              result.errors.push(`Task ${task.id}: ${emailError.message}`);
            } else {
              // Mark reminder as sent
              const { error: updateError } = await supabase
                .from('tasks')
                .update({ reminder_sent_at: now.toISOString() })
                .eq('id', task.id);

              if (updateError) {
                console.error(`❌ Error updating task ${task.id}:`, updateError);
                result.errors.push(`Task update ${task.id}: ${updateError.message}`);
              } else {
                console.log(`✅ Task reminder sent successfully for: ${task.title}`);
                result.taskReminders++;
              }
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
        .lte('reminder_at', now.toISOString())
        .is('reminder_sent_at', null) // Only unsent reminders
        .is('deleted_at', null);

      if (eventError) {
        console.error('❌ Error fetching due events:', eventError);
        result.errors.push(`Event fetch error: ${eventError.message}`);
      } else {
        console.log(`📅 Found ${dueEvents?.length || 0} due event reminders`);
        
        for (const event of dueEvents || []) {
          try {
            // Send email reminder using existing function
            const { error: emailError } = await supabase.functions.invoke('send-event-reminder-email', {
              body: { eventId: event.id }
            });

            if (emailError) {
              console.error(`❌ Error sending event email for ${event.id}:`, emailError);
              result.errors.push(`Event ${event.id}: ${emailError.message}`);
            } else {
              // Mark reminder as sent
              const { error: updateError } = await supabase
                .from('events')
                .update({ reminder_sent_at: now.toISOString() })
                .eq('id', event.id);

              if (updateError) {
                console.error(`❌ Error updating event ${event.id}:`, updateError);
                result.errors.push(`Event update ${event.id}: ${updateError.message}`);
              } else {
                console.log(`✅ Event reminder sent successfully for: ${event.title}`);
                result.eventReminders++;
              }
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

