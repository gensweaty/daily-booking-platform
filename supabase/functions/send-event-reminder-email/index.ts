
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
const formatEventTimeForLocale = (eventTimeISO: string, lang: string): string => {
  console.log("Original event time ISO string:", eventTimeISO);
  
  const date = new Date(eventTimeISO);
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

// Multi-language email content for event reminders
const getEventReminderEmailContent = (
  language: string, 
  eventTitle: string, 
  eventTime: string, 
  eventNotes?: string,
  paymentStatus?: string,
  paymentAmount?: number,
  clientName?: string
) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = `📅 ღონისძიების შეხსენება: ${eventTitle}`;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">ღონისძიების შეხსენება</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          მოგესალმებით! გახსენებთ ღონისძიებაზე: <strong>${eventTitle}</strong>
        </p>
        ${clientName ? `<p style="font-size: 14px; color: #666;"><strong>კლიენტი:</strong> ${clientName}</p>` : ''}
        <p style="font-size: 14px; color: #666;">
          <strong>დრო:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>შენიშვნები:</strong> ${eventNotes}</p>` : ''}
        ${paymentStatus ? `<p style="font-size: 14px; color: #666;"><strong>გადახდის სტატუსი:</strong> ${paymentStatus === 'fully_paid' ? 'სრულად გადახდილი' : paymentStatus === 'partly_paid' ? 'ნაწილობრივ გადახდილი' : 'არ არის გადახდილი'}</p>` : ''}
        ${paymentAmount ? `<p style="font-size: 14px; color: #666;"><strong>თანხა:</strong> ${paymentAmount} ₾</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">🗓️ არ დაგავიწყდეს თქვენი ღონისძიება!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          SmartBookly-დან მიღებული შეხსენება
        </p>
      </div>
    `;
  } else if (language === 'es') {
    subject = `📅 Recordatorio de Evento: ${eventTitle}`;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Recordatorio de Evento</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          ¡Hola! Este es un recordatorio de tu evento: <strong>${eventTitle}</strong>
        </p>
        ${clientName ? `<p style="font-size: 14px; color: #666;"><strong>Cliente:</strong> ${clientName}</p>` : ''}
        <p style="font-size: 14px; color: #666;">
          <strong>Programado para:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notas:</strong> ${eventNotes}</p>` : ''}
        ${paymentStatus ? `<p style="font-size: 14px; color: #666;"><strong>Estado del Pago:</strong> ${paymentStatus === 'fully_paid' ? 'Pagado completamente' : paymentStatus === 'partly_paid' ? 'Pagado parcialmente' : 'No pagado'}</p>` : ''}
        ${paymentAmount ? `<p style="font-size: 14px; color: #666;"><strong>Cantidad:</strong> €${paymentAmount}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">🗓️ ¡No olvides tu evento!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Recordatorio de SmartBookly
        </p>
      </div>
    `;
  } else {
    subject = `📅 Event Reminder: ${eventTitle}`;
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Event Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Hello! This is a reminder for your event: <strong>${eventTitle}</strong>
        </p>
        ${clientName ? `<p style="font-size: 14px; color: #666;"><strong>Client:</strong> ${clientName}</p>` : ''}
        <p style="font-size: 14px; color: #666;">
          <strong>Scheduled for:</strong> ${eventTime}
        </p>
        ${eventNotes ? `<p style="font-size: 14px; color: #666;"><strong>Notes:</strong> ${eventNotes}</p>` : ''}
        ${paymentStatus ? `<p style="font-size: 14px; color: #666;"><strong>Payment Status:</strong> ${paymentStatus === 'fully_paid' ? 'Fully Paid' : paymentStatus === 'partly_paid' ? 'Partially Paid' : 'Not Paid'}</p>` : ''}
        ${paymentAmount ? `<p style="font-size: 14px; color: #666;"><strong>Amount:</strong> $${paymentAmount}</p>` : ''}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #333;">🗓️ Don't forget your event!</p>
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

      // Check if email reminder is enabled and has recipient email
      if (!event.email_reminder_enabled || !event.social_network_link) {
        console.log('📧 Email reminder not enabled or no recipient email for event:', eventId);
        return new Response(
          JSON.stringify({ message: 'Email reminder not enabled or no recipient email' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      const recipientEmail = event.social_network_link;
      const deduplicationKey = `${event.id}_${recipientEmail}`;

      // Check if we've recently sent this email (prevent duplicates)
      const recentSendTime = recentlySentEmails.get(deduplicationKey);
      if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
        console.log(`⏭️ Skipping duplicate email for event ${event.id}`);
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
        .eq('id', event.user_id)
        .single();

      const language = profileData?.language || 'en';
      
      // Format event time using the new function with proper locale and timezone
      const formattedTime = formatEventTimeForLocale(event.start_date, language);

      // Get localized email content
      const { subject, body: emailBody } = getEventReminderEmailContent(
        language, 
        event.title || event.user_surname || 'Event',
        formattedTime, 
        event.event_notes,
        event.payment_status,
        event.payment_amount,
        event.user_surname
      );

      // Send email
      const emailResult = await resend.emails.send({
        from: 'SmartBookly <noreply@smartbookly.com>',
        to: [recipientEmail],
        subject: subject,
        html: emailBody
      });

      if (emailResult.error) {
        console.error(`Failed to send email for event ${event.id}:`, emailResult.error);
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      console.log(`✅ Reminder email sent for event ${event.id} to ${recipientEmail} in language ${language}`);
      
      // Mark the event reminder as sent and disable future sends
      await supabase
        .from('events')
        .update({ 
          reminder_sent_at: new Date().toISOString(),
          email_reminder_enabled: false
        })
        .eq('id', event.id);

      // Track in deduplication map
      recentlySentEmails.set(deduplicationKey, Date.now());

      return new Response(
        JSON.stringify({
          message: 'Event reminder email sent successfully',
          emailsSent: 1,
          eventId: event.id,
          language: language
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // If no eventId provided, process all due event reminders (batch processing)
    const now = new Date().toISOString();
    
    console.log('📅 Querying for due event reminders...');
    
    // Find events with due reminders that haven't been sent yet
    const { data: dueEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .lte('reminder_at', now)
      .eq('email_reminder_enabled', true)
      .is('reminder_sent_at', null)
      .is('deleted_at', null)
      .not('social_network_link', 'is', null);

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

    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const event of dueEvents) {
      try {
        if (!event.social_network_link) {
          console.log(`⏭️ Skipping event ${event.id} - no recipient email`);
          emailsSkipped++;
          continue;
        }

        const recipientEmail = event.social_network_link;
        const deduplicationKey = `${event.id}_${recipientEmail}`;

        // Check if we've recently sent this email
        const recentSendTime = recentlySentEmails.get(deduplicationKey);
        if (recentSendTime && Date.now() - recentSendTime < 10 * 60 * 1000) {
          console.log(`⏭️ Skipping duplicate email for event ${event.id}`);
          emailsSkipped++;
          continue;
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

        // Get localized email content
        const { subject, body: emailBody } = getEventReminderEmailContent(
          language, 
          event.title || event.user_surname || 'Event',
          formattedTime, 
          event.event_notes,
          event.payment_status,
          event.payment_amount,
          event.user_surname
        );

        // Send email
        const emailResult = await resend.emails.send({
          from: 'SmartBookly <noreply@smartbookly.com>',
          to: [recipientEmail],
          subject: subject,
          html: emailBody
        });

        if (emailResult.error) {
          console.error(`Failed to send email for event ${event.id}:`, emailResult.error);
          continue;
        }

        console.log(`✅ Reminder email sent for event ${event.id} to ${recipientEmail} in language ${language}`);
        
        // Mark the event reminder as sent
        await supabase
          .from('events')
          .update({ 
            reminder_sent_at: new Date().toISOString(),
            email_reminder_enabled: false
          })
          .eq('id', event.id);

        // Track in deduplication map
        recentlySentEmails.set(deduplicationKey, Date.now());
        
        emailsSent++;

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Event reminder email summary: ${emailsSent} sent, ${emailsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        message: 'Event reminder emails processed',
        emailsSent,
        emailsSkipped,
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
