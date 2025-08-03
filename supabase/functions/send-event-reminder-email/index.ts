
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  return formatter.format(date);
};

// Multi-language email content
const getEventEmailContent = (language: string, eventTitle: string, eventTime: string, reminderTime: string, eventNotes?: string) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "📅 ღონისძიების შეხსენება!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">ღონისძიების შეხსენება</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          შეგახსენებთ მომავალ ღონისძიებაზე: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>ღონისძიების დრო:</strong> ${eventTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>შეხსენების დრო:</strong> ${reminderTime}
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
          Este es un recordatorio de tu próximo evento: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Hora del evento:</strong> ${eventTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Recordatorio programado para:</strong> ${reminderTime}
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
    subject = "📅 Event Reminder!";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Event Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          This is a reminder for your upcoming event: <strong>${eventTitle}</strong>
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Event time:</strong> ${eventTime}
        </p>
        <p style="font-size: 14px; color: #666;">
          <strong>Reminder scheduled for:</strong> ${reminderTime}
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
    console.log('🔔 Event reminder email function started');
    
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { eventId } = body;

    // If eventId is provided, send email for specific event
    if (eventId) {
      console.log('📅 Sending email for specific event:', eventId);
      
      // Get the event details
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
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

      // Get all persons associated with this event (main person + additional persons)
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('event_id', eventId)
        .is('deleted_at', null);

      if (customersError) {
        console.error('Error fetching event customers:', customersError);
      }

      // Collect all email addresses
      const emailAddresses = [];
      
      // Add main person's email (from event.social_network_link)
      if (event.social_network_link && event.social_network_link.includes('@')) {
        emailAddresses.push({
          email: event.social_network_link,
          name: event.user_surname || event.title,
        });
      }

      // Add additional persons' emails
      if (customers && customers.length > 0) {
        for (const customer of customers) {
          if (customer.social_network_link && customer.social_network_link.includes('@')) {
            emailAddresses.push({
              email: customer.social_network_link,
              name: customer.user_surname || customer.title,
            });
          }
        }
      }

      if (emailAddresses.length === 0) {
        console.log('📧 No valid email addresses found for event:', eventId);
        return new Response(
          JSON.stringify({ message: 'No valid email addresses found for this event' }),
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
        .eq('id', event.user_id)
        .single();

      const language = profileData?.language || 'en';
      
      // Format event and reminder times
      const eventTime = formatReminderTimeForLocale(event.start_date, language);
      const reminderTime = formatReminderTimeForLocale(event.reminder_at, language);

      // Get localized email content
      const { subject, body: emailBody } = getEventEmailContent(
        language, 
        event.title, 
        eventTime,
        reminderTime,
        event.event_notes
      );

      let emailsSent = 0;
      const emailPromises = emailAddresses.map(async (recipient) => {
        try {
          const emailResult = await resend.emails.send({
            from: 'SmartBookly <noreply@smartbookly.com>',
            to: [recipient.email],
            subject: subject,
            html: emailBody
          });

          if (emailResult.error) {
            console.error(`Failed to send email to ${recipient.email}:`, emailResult.error);
            return false;
          }

          console.log(`✅ Event reminder email sent to ${recipient.email} (${recipient.name}) in language ${language}`);
          return true;
        } catch (error) {
          console.error(`Error sending email to ${recipient.email}:`, error);
          return false;
        }
      });

      const results = await Promise.all(emailPromises);
      emailsSent = results.filter(result => result === true).length;

      // Mark the event as email sent and disable future sends
      await supabase
        .from('events')
        .update({ 
          reminder_sent_at: new Date().toISOString(),
          email_reminder_enabled: false
        })
        .eq('id', event.id);

      return new Response(
        JSON.stringify({
          message: 'Event reminder emails sent successfully',
          emailsSent: emailsSent,
          totalRecipients: emailAddresses.length,
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
    
    console.log('📅 Querying for due event reminders...');
    
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

    console.log(`📅 Found ${dueEvents?.length || 0} due events with email reminders`);

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
    let totalEventsProcessed = 0;

    for (const event of dueEvents) {
      try {
        // Process each event using the same logic as above
        const response = await handler(new Request(req.url, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({ eventId: event.id })
        }));

        if (response.ok) {
          const result = await response.json();
          totalEmailsSent += result.emailsSent || 0;
          totalEventsProcessed++;
        }

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Event reminder email summary: ${totalEmailsSent} emails sent for ${totalEventsProcessed} events`);

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent: totalEmailsSent,
        eventsProcessed: totalEventsProcessed,
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
