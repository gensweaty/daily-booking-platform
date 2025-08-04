
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

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Helper function to format time with proper timezone and locale
const formatEventTimeForLocale = (eventStartISO: string, lang: string): string => {
  console.log("Original event start ISO string:", eventStartISO);
  
  const date = new Date(eventStartISO);
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
  console.log("Formatted event time:", formattedResult);
  console.log("Language:", lang, "Locale:", locale);
  
  return formattedResult;
};

// Multi-language email content for events
const getEventEmailContent = (language: string, eventTitle: string, eventTime: string, eventNotes?: string) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "📅 მოვლენის შეხსენება!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">მოვლენის შეხსენება</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          შეგახსენებთ თქვენს მოვლენაზე: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>დრო:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>შენიშვნები:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 არ დაგავიწყდეს!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          SmartBookly-დან მიღებული შეხსენება
        </p>
      </div>
    `;
  } else if (language === 'es') {
    subject = "📅 ¡Recordatorio de evento!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Recordatorio de Evento</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Este es un recordatorio de tu evento: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Programado para:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notas:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 ¡No lo olvides!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Recordatorio de SmartBookly
        </p>
      </div>
    `;
  } else {
    subject = "📅 Event reminder!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Event Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          This is a reminder for your upcoming event: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Scheduled for:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notes:</strong> ${eventNotes}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">📅 Don't forget!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Reminder from SmartBookly
        </p>
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
    console.log('📅 Event reminder email function started');
    
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
    const { eventId } = body;

    // If eventId is provided, send email for specific event
    if (eventId) {
      console.log('📧 Sending email for specific event:', eventId);
      
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          customers (
            social_network_link,
            user_surname,
            event_notes
          )
        `)
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        console.error('Error fetching event:', eventError);
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Check if email reminder is enabled
      if (!event.email_reminder_enabled) {
        console.log('📧 Email reminder not enabled for event:', eventId);
        return new Response(
          JSON.stringify({ message: 'Email reminder not enabled for this event' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get user's language preference
      const { data: profileData } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', event.user_id)
        .single();

      const language = profileData?.language || 'en';
      
      // Format event time using the new function with proper locale and timezone
      const formattedTime = formatEventTimeForLocale(event.start_date, language);

      // Compile recipient list from event and additional persons
      const recipients = [
        event.social_network_link, // Main event contact
        ...(event.customers || []).map((customer: any) => customer.social_network_link)
      ].filter(isValidEmail)
       .filter((email, index, arr) => arr.indexOf(email) === index); // Deduplicate

      console.log('📧 Event recipients found:', recipients.length);

      if (recipients.length === 0) {
        console.log('📧 No valid email recipients found for event:', eventId);
        return new Response(
          JSON.stringify({ message: 'No valid email recipients found' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get localized email content
      const { subject, body: emailBody } = getEventEmailContent(
        language, 
        event.title, 
        formattedTime, 
        event.event_notes
      );

      let emailsSent = 0;
      let emailsFailed = 0;

      // Send email to each recipient separately
      for (const email of recipients) {
        const deduplicationKey = `${event.id}_${email}`;

        // Check if we've recently sent this email (prevent duplicates)
        const recentSendTime = recentlySentEmails.get(deduplicationKey);
        if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
          console.log(`⏭️ Skipping duplicate email for event ${event.id} to ${email}`);
          continue;
        }

        try {
          const emailResult = await resend.emails.send({
            from: 'SmartBookly <noreply@smartbookly.com>',
            to: [email],
            subject: subject,
            html: emailBody
          });

          if (emailResult.error) {
            console.error(`Failed to send email for event ${event.id} to ${email}:`, emailResult.error);
            emailsFailed++;
            continue;
          }

          console.log(`✅ Reminder email sent for event ${event.id} to ${email} in language ${language}`);
          
          // Track in deduplication map
          recentlySentEmails.set(deduplicationKey, Date.now());
          emailsSent++;

        } catch (error) {
          console.error(`Error sending email for event ${event.id} to ${email}:`, error);
          emailsFailed++;
        }
      }

      // Mark the event as email sent and disable future sends only if at least one email was sent
      if (emailsSent > 0) {
        await supabase
          .from('events')
          .update({ 
            reminder_sent_at: new Date().toISOString(),
            email_reminder_enabled: false
          })
          .eq('id', event.id);
      }

      return new Response(
        JSON.stringify({
          message: 'Event reminder emails processed',
          emailsSent,
          emailsFailed,
          totalRecipients: recipients.length,
          eventId: event.id,
          language: language
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // If no eventId provided, process all due event reminders
    const now = new Date().toISOString();
    
    console.log('📋 Querying for due event reminders at:', now);
    
    // ENHANCED: Find events with due reminders that haven't been sent yet
    const { data: dueEvents, error: eventsError } = await supabase
      .from('events')
      .select(`
        *,
        customers (
          social_network_link,
          user_surname,
          event_notes
        )
      `)
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
        JSON.stringify({ message: 'No due event reminders found' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    let totalEmailsSent = 0;
    let totalEmailsSkipped = 0;

    for (const event of dueEvents) {
      try {
        console.log(`📧 Processing reminder for event: ${event.id} - ${event.title}`);

        // Get user's language preference
        const { data: profileData } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', event.user_id)
          .single();

        const language = profileData?.language || 'en';
        
        // Format event time
        const formattedTime = formatEventTimeForLocale(event.start_date, language);

        // Compile recipient list
        const recipients = [
          event.social_network_link,
          ...(event.customers || []).map((customer: any) => customer.social_network_link)
        ].filter(isValidEmail)
         .filter((email, index, arr) => arr.indexOf(email) === index); // Deduplicate

        if (recipients.length === 0) {
          console.log('📧 No valid recipients for event:', event.id);
          continue;
        }

        console.log(`📧 Found ${recipients.length} recipients for event ${event.id}`);

        // Get localized email content
        const { subject, body: emailBody } = getEventEmailContent(
          language, 
          event.title, 
          formattedTime, 
          event.event_notes
        );

        let eventEmailsSent = 0;

        // Send email to each recipient
        for (const email of recipients) {
          const deduplicationKey = `${event.id}_${email}`;

          // Check for duplicates
          const recentSendTime = recentlySentEmails.get(deduplicationKey);
          if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
            console.log(`⏭️ Skipping duplicate email for event ${event.id} to ${email}`);
            totalEmailsSkipped++;
            continue;
          }

          try {
            const emailResult = await resend.emails.send({
              from: 'SmartBookly <noreply@smartbookly.com>',
              to: [email],
              subject: subject,
              html: emailBody
            });

            if (emailResult.error) {
              console.error(`Failed to send email for event ${event.id} to ${email}:`, emailResult.error);
              continue;
            }

            console.log(`✅ Reminder email sent for event ${event.id} to ${email} in language ${language}`);
            
            // Track in deduplication map
            recentlySentEmails.set(deduplicationKey, Date.now());
            eventEmailsSent++;
            totalEmailsSent++;

          } catch (error) {
            console.error(`Error sending email for event ${event.id} to ${email}:`, error);
            continue;
          }
        }

        // Mark event as processed if at least one email was sent
        if (eventEmailsSent > 0) {
          console.log(`📧 Marking event ${event.id} as processed, ${eventEmailsSent} emails sent`);
          await supabase
            .from('events')
            .update({ 
              reminder_sent_at: new Date().toISOString(),
              email_reminder_enabled: false
            })
            .eq('id', event.id);
        }

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Event reminder email summary: ${totalEmailsSent} sent, ${totalEmailsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent: totalEmailsSent,
        emailsSkipped: totalEmailsSkipped,
        totalEvents: dueEvents.length
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in event reminder email function:', error);
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
