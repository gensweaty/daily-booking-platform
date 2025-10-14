
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

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
  customReminders: number;
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
      customReminders: 0,
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
            result.errors.push(`Task ${task.id} exception: ${(error as Error).message}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Task processing exception:', error);
      result.errors.push(`Task processing exception: ${(error as Error).message}`);
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
            result.errors.push(`Event ${event.id} exception: ${(error as Error).message}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Event processing exception:', error);
      result.errors.push(`Event processing exception: ${(error as Error).message}`);
    }

    // Process Custom Reminders
    try {
      const { data: dueCustomReminders, error: customError } = await supabase
        .from('custom_reminders')
        .select('*')
        .lte('remind_at', reminderCheckTime.toISOString())
        .is('reminder_sent_at', null)
        .is('deleted_at', null);

      if (customError) {
        console.error('❌ Error fetching due custom reminders:', customError);
        result.errors.push(`Custom reminder fetch error: ${customError.message}`);
      } else {
        console.log(`🔔 Found ${dueCustomReminders?.length || 0} due custom reminders`);
        
        for (const reminder of dueCustomReminders || []) {
          try {
            console.log(`🔍 Processing custom reminder: ${reminder.title} (ID: ${reminder.id}, created_by: ${reminder.created_by_type}, remind_at: ${reminder.remind_at})`);
            
            // Determine recipient email based on creator type
            let userEmail: string;
            const recipientUserId = reminder.user_id; // Always use board owner ID for language lookup
            
            if (reminder.created_by_type === 'sub_user' && reminder.created_by_sub_user_id) {
              // This reminder was created by a sub-user - send to sub-user's email
              const { data: subUserData, error: subUserError } = await supabase
                .from('sub_users')
                .select('email')
                .eq('id', reminder.created_by_sub_user_id)
                .single();
              
              if (subUserError || !subUserData?.email) {
                console.error(`❌ Could not get sub-user email for reminder ${reminder.id}:`, subUserError);
                result.errors.push(`Custom reminder ${reminder.id}: Sub-user email not found`);
                continue;
              }
              
              userEmail = subUserData.email;
              console.log(`📧 Sending reminder to sub-user's email: ${userEmail}`);
            } else {
              // This reminder was created by admin - send to admin's email
              const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reminder.user_id);
              
              if (userError || !userData?.user?.email) {
                console.error(`❌ Could not get user email for reminder ${reminder.id}:`, userError);
                result.errors.push(`Custom reminder ${reminder.id}: User email not found`);
                continue;
              }

              userEmail = userData.user.email;
              console.log(`📧 Sending reminder to admin's email: ${userEmail}`);
            }

            // 1. Send email reminder
            const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-custom-reminder-email', {
              body: { 
                reminderId: reminder.id,
                userEmail: userEmail,
                title: reminder.title,
                message: reminder.message,
                reminderTime: reminder.remind_at,
                userId: reminder.user_id,
                recipientUserId: recipientUserId // Pass the actual recipient's auth user ID
              }
            });

            if (emailError || !emailResult?.success) {
              const errorMsg = emailError?.message || emailResult?.error || 'Unknown email error';
              console.error(`❌ Error sending custom reminder email for ${reminder.id}:`, errorMsg);
              result.errors.push(`Custom reminder ${reminder.id}: ${errorMsg}`);
              // Skip marking as sent if email failed
              continue;
            } else if (emailResult?.duplicate) {
              console.log(`⚠️ Duplicate email prevented for ${reminder.id}`);
              // Continue to next reminder without marking as sent
              continue;
            } else {
              console.log(`✅ Email sent to ${userEmail} in language ${emailResult.language || 'default'}`);
            }

            // 2. Dashboard notification handled by frontend (CustomReminderNotifications component)

            // 3. Send chat message in AI channel (if exists)
            try {
              // Find the correct AI channel based on who created the reminder
              let aiChannelId = null;
              
              if (reminder.created_by_type === 'sub_user' && reminder.created_by_sub_user_id) {
                // Find personal AI channel for this sub-user
                const { data: personalChannels } = await supabase
                  .from('chat_channels')
                  .select('id')
                  .eq('owner_id', reminder.user_id)
                  .eq('is_ai', true)
                  .eq('is_dm', true)
                  .eq('is_deleted', false);
                
                // Find the channel where this sub-user is a participant
                if (personalChannels && personalChannels.length > 0) {
                  for (const channel of personalChannels) {
                    const { data: participant } = await supabase
                      .from('chat_participants')
                      .select('id')
                      .eq('channel_id', channel.id)
                      .eq('sub_user_id', reminder.created_by_sub_user_id)
                      .eq('user_type', 'sub_user')
                      .maybeSingle();
                    
                    if (participant) {
                      aiChannelId = channel.id;
                      console.log(`✅ Found personal AI channel for sub-user: ${channel.id}`);
                      break;
                    }
                  }
                }
                
                if (!aiChannelId) {
                  console.log(`⚠️ No personal AI channel found for sub-user ${reminder.created_by_sub_user_id}`);
                }
              } else {
                // Find admin's AI channel - get the first one
                const { data: adminChannels } = await supabase
                  .from('chat_channels')
                  .select('id')
                  .eq('owner_id', reminder.user_id)
                  .eq('is_ai', true)
                  .eq('is_dm', true)
                  .eq('is_deleted', false)
                  .limit(1);
                
                if (adminChannels && adminChannels.length > 0) {
                  aiChannelId = adminChannels[0].id;
                  console.log(`✅ Found admin AI channel: ${aiChannelId}`);
                } else {
                  console.log(`⚠️ No AI channel found for admin ${reminder.user_id}`);
                }
              }

              if (aiChannelId) {
                // SKIP chat message - it was already sent when reminder was created
                // This prevents duplicate messages in chat
                console.log(`⏭️ Skipping chat message for ${reminder.id} - already sent at creation time`);
                
                if (chatInsertError) {
                  console.error(`❌ Failed to send chat message:`, chatInsertError);
                } else {
                  console.log(`✅ Chat message sent to AI channel ${aiChannelId}`);
                }
              } else {
                console.log(`⚠️ No AI channel found for reminder creator`);
              }
            } catch (chatError) {
              console.error(`⚠️ Could not send chat message (non-critical):`, chatError);
            }

            // 4. Mark as fully processed
            await supabase
              .from('custom_reminders')
              .update({ 
                reminder_sent_at: now.toISOString(),
                email_sent: true 
              })
              .eq('id', reminder.id);
            
            console.log(`✅ Custom reminder fully processed: ${reminder.title}`);
            result.customReminders++;
          } catch (error) {
            console.error(`❌ Exception processing custom reminder ${reminder.id}:`, error);
            result.errors.push(`Custom reminder ${reminder.id} exception: ${(error as Error).message}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Custom reminder processing exception:', error);
      result.errors.push(`Custom reminder processing exception: ${(error as Error).message}`);
    }

    // Log final results
    console.log('📊 Processing complete:', {
      taskReminders: result.taskReminders,
      eventReminders: result.eventReminders,
      customReminders: result.customReminders,
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
      custom_reminders_sent: result.customReminders,
      errors: result.errors
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('❌ Critical error in process-reminders:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
