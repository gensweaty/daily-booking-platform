import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a map to track recently sent emails to avoid duplicates
const recentlySentEmails = new Map<string, number>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (timestamp < tenMinutesAgo) {
      recentlySentEmails.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Helper function to format time with proper timezone and locale
const formatReminderTimeForLocale = (reminderAtISO: string, lang: string): string => {
  console.log("Original reminderAt ISO string:", reminderAtISO);
  
  const date = new Date(reminderAtISO);
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'es' ? 'es-ES' : 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi',
  });

  const formattedResult = formatter.format(date);
  console.log("Formatted reminder time:", formattedResult);
  console.log("Language:", lang, "Locale:", locale);
  
  return formattedResult;
};

// Multi-language email content with dashboard-style design
const getEmailContent = (language: string, taskTitle: string, reminderTime: string, taskDescription?: string) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "📋 დავალების შეხსენება";
    body = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #9b87f5 0%, #7e69ab 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">დავალების შეხსენება</h1>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 32px;">
          
          <!-- Task Card -->
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #9b87f5; border-radius: 50%; margin-right: 12px;"></div>
              <h2 style="color: #111827; margin: 0; font-size: 18px; font-weight: 600;">${taskTitle}</h2>
            </div>
            
            ${taskDescription ? `
            <div style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 16px; padding-left: 20px;">
              ${taskDescription}
            </div>
            ` : ''}
            
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border-left: 3px solid #9b87f5;">
              <div style="display: flex; align-items: center;">
                <span style="color: #9b87f5; margin-right: 8px;">🕐</span>
                <span style="color: #374151; font-size: 14px; font-weight: 500;">შესრულების დრო: ${reminderTime}</span>
              </div>
            </div>
          </div>
          
          <!-- Action Message -->
          <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              🎯 <strong style="color: #334155;">არ დაგავიწყდეს!</strong> თქვენი დავალება მზად არის შესასრულებლად.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 32px; text-align: center; background: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            📱 SmartBookly-დან მიღებული შეხსენება
          </p>
        </div>
      </div>
    `;
  } else if (language === 'es') {
    subject = "📋 Recordatorio de Tarea";
    body = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #9b87f5 0%, #7e69ab 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Recordatorio de Tarea</h1>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 32px;">
          
          <!-- Task Card -->
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #9b87f5; border-radius: 50%; margin-right: 12px;"></div>
              <h2 style="color: #111827; margin: 0; font-size: 18px; font-weight: 600;">${taskTitle}</h2>
            </div>
            
            ${taskDescription ? `
            <div style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 16px; padding-left: 20px;">
              ${taskDescription}
            </div>
            ` : ''}
            
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border-left: 3px solid #9b87f5;">
              <div style="display: flex; align-items: center;">
                <span style="color: #9b87f5; margin-right: 8px;">🕐</span>
                <span style="color: #374151; font-size: 14px; font-weight: 500;">Programada para: ${reminderTime}</span>
              </div>
            </div>
          </div>
          
          <!-- Action Message -->
          <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              🎯 <strong style="color: #334155;">¡No lo olvides!</strong> Tu tarea está lista para ser completada.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 32px; text-align: center; background: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            📱 Recordatorio de SmartBookly
          </p>
        </div>
      </div>
    `;
  } else {
    subject = "📋 Task Reminder";
    body = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #9b87f5 0%, #7e69ab 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Task Reminder</h1>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 32px;">
          
          <!-- Task Card -->
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #9b87f5; border-radius: 50%; margin-right: 12px;"></div>
              <h2 style="color: #111827; margin: 0; font-size: 18px; font-weight: 600;">${taskTitle}</h2>
            </div>
            
            ${taskDescription ? `
            <div style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 16px; padding-left: 20px;">
              ${taskDescription}
            </div>
            ` : ''}
            
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border-left: 3px solid #9b87f5;">
              <div style="display: flex; align-items: center;">
                <span style="color: #9b87f5; margin-right: 8px;">🕐</span>
                <span style="color: #374151; font-size: 14px; font-weight: 500;">Scheduled for: ${reminderTime}</span>
              </div>
            </div>
          </div>
          
          <!-- Action Message -->
          <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              🎯 <strong style="color: #334155;">Don't forget!</strong> Your task is ready to be completed.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 32px; text-align: center; background: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            📱 Reminder from SmartBookly
          </p>
        </div>
      </div>
    `;
  }
  
  return { subject, body };
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Task reminder email function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { taskId } = body;

    // If taskId is provided, send email for specific task
    if (taskId) {
      console.log('📧 Sending email for specific task:', taskId);
      
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.error('Error fetching task:', taskError);
        return new Response(
          JSON.stringify({ error: 'Task not found' }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Check if email reminder is enabled
      if (!task.email_reminder_enabled) {
        console.log('📧 Email reminder not enabled for task:', taskId);
        return new Response(
          JSON.stringify({ message: 'Email reminder not enabled for this task' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get user email and language preference
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
      
      if (userError || !userData.user?.email) {
        console.error(`Failed to get user email for task ${task.id}:`, userError);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      const userEmail = userData.user.email;
      const deduplicationKey = `${task.id}_${userEmail}`;

      // Check if we've recently sent this email (prevent duplicates)
      const recentSendTime = recentlySentEmails.get(deduplicationKey);
      if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
        console.log(`⏭️ Skipping duplicate email for task ${task.id}`);
        return new Response(
          JSON.stringify({ message: 'Email already sent recently' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get user's language preference from profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', task.user_id)
        .single();

      const language = profileData?.language || 'en';
      
      // Format reminder time using the new function with proper locale and timezone
      const formattedTime = formatReminderTimeForLocale(task.reminder_at, language);

      // Get localized email content
      const { subject, body: emailBody } = getEmailContent(language, task.title, formattedTime, task.description);

      // Send email
      const emailResult = await resend.emails.send({
        from: 'SmartBookly <noreply@smartbookly.com>',
        to: [userEmail],
        subject: subject,
        html: emailBody
      });

      if (emailResult.error) {
        console.error(`Failed to send email for task ${task.id}:`, emailResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      console.log(`✅ Reminder email sent for task ${task.id} to ${userEmail} in language ${language}`);
      
      // Mark the task as email sent and disable future sends
      await supabase
        .from('tasks')
        .update({ 
          reminder_sent_at: new Date().toISOString(),
          email_reminder_enabled: false
        })
        .eq('id', task.id);

      // Track in deduplication map
      recentlySentEmails.set(deduplicationKey, Date.now());

      return new Response(
        JSON.stringify({
          message: 'Task reminder email sent successfully',
          emailsSent: 1,
          taskId: task.id,
          language: language
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // If no taskId provided, process all due task reminders (original functionality)
    const now = new Date().toISOString();
    
    console.log('📋 Querying for due task reminders...');
    
    // Find tasks with due reminders that haven't been sent yet
    const { data: dueTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .lte('reminder_at', now)
      .eq('email_reminder_enabled', true)
      .is('reminder_sent_at', null)
      .is('deleted_at', null);

    if (tasksError) {
      console.error('Error fetching due tasks:', tasksError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch due tasks' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`📝 Found ${dueTasks?.length || 0} due tasks with email reminders`);

    if (!dueTasks || dueTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No due task reminders found' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const task of dueTasks) {
      try {
        // Get user email
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
        
        if (userError || !userData.user?.email) {
          console.error(`Failed to get user email for task ${task.id}:`, userError);
          continue;
        }

        const userEmail = userData.user.email;
        const deduplicationKey = `${task.id}_${userEmail}`;

        // Check if we've recently sent this email
        const recentSendTime = recentlySentEmails.get(deduplicationKey);
        if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
          console.log(`⏭️ Skipping duplicate email for task ${task.id}`);
          emailsSkipped++;
          continue;
        }

        // Get user's language preference
        const { data: profileData } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', task.user_id)
          .single();

        const language = profileData?.language || 'en';
        
        // Format reminder time using the new function with proper locale and timezone
        const formattedTime = formatReminderTimeForLocale(task.reminder_at, language);

        // Get localized email content
        const { subject, body: emailBody } = getEmailContent(language, task.title, formattedTime, task.description);

        // Send email
        const emailResult = await resend.emails.send({
          from: 'SmartBookly <noreply@smartbookly.com>',
          to: [userEmail],
          subject: subject,
          html: emailBody
        });

        if (emailResult.error) {
          console.error(`Failed to send email for task ${task.id}:`, emailResult.error);
          continue;
        }

        console.log(`✅ Reminder email sent for task ${task.id} to ${userEmail} in language ${language}`);
        
        // Mark the task as email sent
        await supabase
          .from('tasks')
          .update({ 
            reminder_sent_at: new Date().toISOString(),
            email_reminder_enabled: false
          })
          .eq('id', task.id);

        // Track in deduplication map
        recentlySentEmails.set(deduplicationKey, Date.now());
        
        emailsSent++;

      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Task reminder email summary: ${emailsSent} sent, ${emailsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        message: 'Task reminder emails processed',
        emailsSent,
        emailsSkipped,
        totalTasks: dueTasks.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in task reminder email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);
