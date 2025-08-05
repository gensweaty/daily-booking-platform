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

// Multi-language email content
const getEmailContent = (language: string, taskTitle: string, reminderTime: string, taskDescription?: string) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "📋 დაგეგმილი დავალების შეხსენება!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">დავალების შეხსენება</h1>
        </div>
        
        <div style="padding: 30px; background: #ffffff; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold;">✅ ${taskTitle}</h2>
          </div>
          
          <div style="background: #f8f9ff; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #667eea;">📅 შესრულების დრო:</strong><br>
              <span style="font-size: 18px; color: #2d3748;">${reminderTime}</span>
            </p>
          </div>
          
          ${taskDescription ? `
          <div style="background: #f7fafc; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #4299e1;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #4299e1;">📝 აღწერა:</strong><br>
              <span style="color: #2d3748; line-height: 1.6;">${taskDescription}</span>
            </p>
          </div>
          ` : ''}
          
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
            <p style="margin: 0; font-size: 18px; color: #ffffff; font-weight: bold;">🎯 არ დაგავიწყდეს!</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #ffffff; opacity: 0.9;">თქვენი დავალება გელოდებათ</p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f7fafc; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #718096;">
            📱 SmartBookly-დან მიღებული შეხსენება
          </p>
        </div>
      </div>
    `;
  } else if (language === 'es') {
    subject = "📋 ¡Tienes un recordatorio de tarea!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Recordatorio de Tarea</h1>
        </div>
        
        <div style="padding: 30px; background: #ffffff; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold;">✅ ${taskTitle}</h2>
          </div>
          
          <div style="background: #f8f9ff; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #667eea;">📅 Programada para:</strong><br>
              <span style="font-size: 18px; color: #2d3748;">${reminderTime}</span>
            </p>
          </div>
          
          ${taskDescription ? `
          <div style="background: #f7fafc; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #4299e1;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #4299e1;">📝 Descripción:</strong><br>
              <span style="color: #2d3748; line-height: 1.6;">${taskDescription}</span>
            </p>
          </div>
          ` : ''}
          
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
            <p style="margin: 0; font-size: 18px; color: #ffffff; font-weight: bold;">🎯 ¡No lo olvides!</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #ffffff; opacity: 0.9;">Tu tarea te está esperando</p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f7fafc; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #718096;">
            📱 Recordatorio de SmartBookly
          </p>
        </div>
      </div>
    `;
  } else {
    subject = "📋 You have a task reminder!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Task Reminder</h1>
        </div>
        
        <div style="padding: 30px; background: #ffffff; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold;">✅ ${taskTitle}</h2>
          </div>
          
          <div style="background: #f8f9ff; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #667eea;">📅 Scheduled for:</strong><br>
              <span style="font-size: 18px; color: #2d3748;">${reminderTime}</span>
            </p>
          </div>
          
          ${taskDescription ? `
          <div style="background: #f7fafc; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #4299e1;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              <strong style="color: #4299e1;">📝 Description:</strong><br>
              <span style="color: #2d3748; line-height: 1.6;">${taskDescription}</span>
            </p>
          </div>
          ` : ''}
          
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
            <p style="margin: 0; font-size: 18px; color: #ffffff; font-weight: bold;">🎯 Don't forget!</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #ffffff; opacity: 0.9;">Your task is waiting for you</p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f7fafc; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; font-size: 12px; color: #718096;">
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
